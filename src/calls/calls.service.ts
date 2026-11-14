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
 * The free-route pipeline, in this order: site lookup, rate limit, payment gate (Phase 2 seam), worker + signing
 * (the site provider), log. Visitor data kept: nothing. The IP is only ever seen as a salted hash.
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
    if (site.refusing || !site.provider) return jsonResponse(503, { ok: false, error: { code: 'DELEGATION_NOT_ENFORCEABLE', message: 'this site cannot answer yet: its delegation is not enforceable in this build' } })

    const path = new URL(request.url).pathname.replace(/\/+$/, '') || '/'
    const m = METHOD_PATH.exec(path)
    const routeName = m && request.method === 'POST' ? m[1] : null
    const subject = this.limiter.subject(ip)
    const log = (result: LogResult, errorCode: string | null, extra: { paid?: boolean; paymentTx?: string | null } = {}) => {
      if (!routeName) return
      void this.prisma.callLog.create({
        data: { siteId: site.siteId, routeName, result, errorCode, paid: extra.paid ?? false, paymentTx: extra.paymentTx ?? null, durationMs: Date.now() - started },
      }).catch(() => undefined) // a log failure never fails a call
    }

    if (routeName) {
      const rule = site.routes.get(routeName)
      let blocked: { scope: string; retryAfterSeconds: number } | null = null
      try {
        const siteWide = await this.limiter.hit(`site:${site.siteId}`, 'all', this.config.siteCallsPerMin, 60)
        if (!siteWide.allowed) blocked = { scope: 'site', retryAfterSeconds: siteWide.retryAfterSeconds }
        else {
          const perRoute = await this.limiter.hit(`route:${site.siteId}:${routeName}`, subject, rule?.rateLimitPerMin ?? 60, 60)
          if (!perRoute.allowed) blocked = { scope: 'route', retryAfterSeconds: perRoute.retryAfterSeconds }
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

      const decision = await this.gate.authorize({
        siteId: site.siteId, siteName: site.name, routeName, priceUsd: rule?.priceUsd ?? 0,
        payoutAddress: (await this.payout(site.siteId)) ?? '', request: request.clone(),
      })
      if (!decision.allow) { log('REFUSED', decision.errorCode); return decision.response }

      const response = await site.provider.handleRequest(request, { clientIp: subject })
      const code = await this.errorCodeOf(response)
      log(response.ok && !code ? 'OK' : 'ERROR', code, { paid: decision.paid, paymentTx: decision.paymentTx ?? null })
      return response
    }
    return site.provider.handleRequest(request, { clientIp: subject })
  }

  private async payout(siteId: string): Promise<string | null> {
    const s = await this.prisma.site.findUnique({ where: { id: siteId }, select: { payoutAddress: true } })
    return s?.payoutAddress ?? null
  }

  private async errorCodeOf(response: Response): Promise<string | null> {
    if (response.ok) return null
    try { return ((await response.clone().json()) as any)?.error?.code ?? 'ERROR' } catch { return 'ERROR' }
  }
}
