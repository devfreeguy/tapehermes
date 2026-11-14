import { Inject, Injectable } from '@nestjs/common'
import { APP_CONFIG, type AppConfig } from '../config/app-config.js'
import { PrismaService } from '../database/prisma.service.js'
import { ProviderCache } from '../providers/provider-cache.service.js'
import { RateLimiter } from '../ratelimit/rate-limiter.service.js'
import { RedisService } from '../redis/redis.service.js'
import { jsonResponse } from './fetch-bridge.js'
import { PAYMENT_GATE, type PaymentGate } from './payment-gate.js'

type LogResult = 'OK' | 'ERROR' | 'RATE_LIMITED' | 'REFUSED'
const METHOD_PATH = /^\/tapeapi\/v1\/([A-Za-z_][A-Za-z0-9_]{0,63})$/
const notFound = () => jsonResponse(404, { ok: false, error: { code: 'NOT_FOUND', message: 'unknown site' } })

/**
 * The call pipeline, in this order (the order is the guarantee that a visitor is never charged for a failed call):
 *   site lookup, rate limit, payment gate (verify only), worker + signing (the site provider), settle (only after a
 *   successful answer), log. Visitor data kept: nothing. The IP is only ever seen as a salted hash.
 */
@Injectable()
export class CallsService {
  constructor(
    private readonly cache: ProviderCache, private readonly limiter: RateLimiter, private readonly redis: RedisService,
    private readonly prisma: PrismaService, @Inject(PAYMENT_GATE) private readonly gate: PaymentGate,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async handle(siteName: string, request: Request, ip: string): Promise<Response> {
    const started = Date.now()
    let site
    try { site = await this.cache.get(siteName) } catch { return jsonResponse(503, { ok: false, error: { code: 'UNAVAILABLE', message: 'site is temporarily unavailable' } }) }
    if (!site) return notFound()
    if (site.refusing === 'NO_ROUTES') return jsonResponse(404, { ok: false, error: { code: 'NOT_FOUND', message: 'this site has no routes yet' } })
    if (site.refusing || !site.provider) return jsonResponse(503, { ok: false, error: { code: site.refusing ?? 'UNAVAILABLE', message: site.refusing === 'DELEGATION_EXPIRED' ? 'this site delegation has expired; the owner must sign a new one' : 'this site has no delegation from its holder yet' } })

    const path = new URL(request.url).pathname.replace(/\/+$/, '') || '/'
    const m = METHOD_PATH.exec(path)
    const routeName = m && request.method === 'POST' ? m[1] : null
    const subject = this.limiter.subject(ip)
    const rule = routeName ? site.routes.get(routeName) : undefined
    const log = (result: LogResult, errorCode: string | null, extra: { paid?: boolean; paymentTx?: string | null } = {}) => {
      if (!routeName) return
      void this.prisma.callLog.create({
        data: {
          siteId: site.siteId, routeName, result, errorCode, paid: extra.paid ?? false, paymentTx: extra.paymentTx ?? null,
          priceUsd: (rule?.priceUsd ?? 0).toFixed(6), durationMs: Date.now() - started,
        },
      }).catch(() => undefined) // a log failure never fails a call
    }

    if (!routeName) return site.provider.handleRequest(request, { clientIp: subject })

    // 1. rate limit: before the facilitator or the worker are touched
    let blocked: { retryAfterSeconds: number } | null = null
    try {
      const siteWide = await this.limiter.hit(`site:${site.siteId}`, 'all', this.config.siteCallsPerMin, 60)
      if (!siteWide.allowed) blocked = siteWide
      else {
        // A bare x402 challenge (priced route, no payment header) costs us nothing, so it has its own bigger bucket.
        // Only real attempts count against the route limit, and they are counted BEFORE the facilitator is asked.
        const challenge = (rule?.priceUsd ?? 0) > 0 && !request.headers.has('payment-signature') && !request.headers.has('x-payment')
        const perRoute = challenge
          ? await this.limiter.hit(`challenge:${site.siteId}:${routeName}`, subject, Math.max(300, (rule?.rateLimitPerMin ?? 60) * 5), 60)
          : await this.limiter.hit(`route:${site.siteId}:${routeName}`, subject, rule?.rateLimitPerMin ?? 60, 60)
        if (!perRoute.allowed) blocked = perRoute
      }
    } catch {
      return jsonResponse(503, { ok: false, error: { code: 'UNAVAILABLE', message: 'temporarily unavailable' } }) // fail closed: protect the upstream
    }
    if (blocked) {
      // One log row per window and route at most, so a flood cannot fill the table.
      const first = await this.redis.client.set(this.redis.keys.cache(`rl-logged:${site.siteId}:${routeName}:${Math.floor(Date.now() / 60000)}`), '1', 'EX', 90, 'NX').catch(() => null)
      if (first) log('RATE_LIMITED', 'RATE_LIMITED')
      return jsonResponse(429, { ok: false, error: { code: 'RATE_LIMITED', message: `too many requests; retry in ${blocked.retryAfterSeconds}s`, data: { retryAfterS: blocked.retryAfterSeconds } } }, { 'retry-after': String(blocked.retryAfterSeconds) })
    }

    // 2. payment gate: answers 402 or VERIFIES the payment. Nothing is charged here.
    const decision = await this.gate.authorize({
      siteId: site.siteId, siteName: site.name, routeName, priceUsd: rule?.priceUsd ?? 0, payoutAddress: site.payoutAddress, request: request.clone(),
    })
    if (!decision.allow) {
      if (!decision.silent) log('REFUSED', decision.errorCode)
      return decision.response
    }

    // 3. the worker and the signature: the outside call happens here
    let response: Response
    try { response = await site.provider.handleRequest(request, { clientIp: subject }) } catch (e) {
      if (decision.paid) await decision.release()
      throw e
    }
    const code = await this.errorCodeOf(response)
    const answered = response.ok && !code

    if (!decision.paid) { log(answered ? 'OK' : 'ERROR', code); return response }

    // 4. settle ONLY for a successful answer. A failed or refused call is returned as is and nothing is charged.
    if (!answered) { await decision.release(); log('ERROR', code); return response } // no settle: the same payment may be retried
    const settled = await decision.settle()
    if (!settled.ok) { log('ERROR', settled.errorCode); return settled.response } // the answer is withheld, never given away free
    log('OK', null, { paid: true, paymentTx: settled.paymentTx })
    const headers = new Headers(response.headers)
    for (const [k, v] of Object.entries(settled.headers)) headers.set(k, v)
    return new Response(response.body, { status: response.status, headers })
  }

  private async errorCodeOf(response: Response): Promise<string | null> {
    try {
      const j = (await response.clone().json()) as any
      if (j?.ok === false) return j?.error?.code ?? 'ERROR'
      return response.ok ? null : (j?.error?.code ?? 'ERROR')
    } catch { return response.ok ? 'ERROR' : 'ERROR' }
  }
}
