import { createHash } from 'node:crypto'
import { Inject, Injectable, Optional } from '@nestjs/common'
import {
  x402HTTPResourceServer,
  type HTTPAdapter, type HTTPRequestContext, type HTTPResponseInstructions, type x402ResourceServer,
} from '@okxweb3/x402-core/server'
import { APP_CONFIG, type AppConfig } from '../config/app-config.js'
import { RedisService } from '../redis/redis.service.js'
import { outageScope } from './facilitator-watch.js'
import { jsonResponse } from './fetch-bridge.js'
import type { GateDecision, GateRequest, PaymentGate, SettleOutcome } from './payment-gate.js'

export const X402_RESOURCE_SERVER = Symbol('X402_RESOURCE_SERVER')

/** What the dynamic price and payTo functions read: one object per request, so nothing is shared between visitors. */
class RequestAdapter implements HTTPAdapter {
  constructor(readonly req: GateRequest, readonly path: string, readonly url: string, readonly priceUsd: string, readonly payTo: string) {}
  getHeader(name: string) { return this.req.request.headers.get(name) ?? undefined }
  getMethod() { return this.req.request.method }
  getPath() { return this.path }
  getUrl() { return this.url }
  getAcceptHeader() { return 'application/json' } // always JSON: never the HTML paywall page
  getUserAgent() { return this.req.request.headers.get('user-agent') ?? '' }
}

const ROUTE = 'POST /sites/:site/tapeapi/v1/:method'
export const OUTAGE_CODE = 'PAYMENT_SERVICE_UNAVAILABLE'
const MARGIN_S = 30 // keep the record a little past the authorization's own end
const MAX_TTL_S = 86_400 // a hostile far-future validBefore cannot pin a Redis key for longer than a day
const fromInstructions = (r: HTTPResponseInstructions): Response =>
  new Response(JSON.stringify(r.body ?? {}), { status: r.status, headers: { 'content-type': 'application/json', ...r.headers } })

/**
 * What identifies one payment: the EIP-3009 authorization is unique by (network, asset, payer, nonce). The key is a
 * hash of that identity, NOT of the header text: the same authorization can be re-encoded (whitespace, field order,
 * extra members) into a different header, so a header hash would let a replay through. Returns null when the header
 * is not a payment this server can recognise (it is then refused: with no identity there is no replay protection).
 */
export function paymentIdentity(header: string | undefined | null, nowS = Math.floor(Date.now() / 1000)): { hash: string; ttlSeconds: number } | null {
  if (!header || header.length > 8192) return null
  try {
    const p = JSON.parse(Buffer.from(header, 'base64').toString('utf8'))
    const a = p?.payload?.authorization
    const network = p?.accepted?.network, asset = p?.accepted?.asset
    if (![network, asset, a?.from, a?.nonce].every((x) => typeof x === 'string' && x.length > 0 && x.length < 200)) return null
    const validBefore = Number(a.validBefore)
    if (!Number.isFinite(validBefore)) return null
    const hash = createHash('sha256').update([network, asset, a.from, a.nonce].map((x: string) => x.toLowerCase()).join('|')).digest('hex')
    return { hash, ttlSeconds: Math.min(MAX_TTL_S, Math.max(5, Math.ceil(validBefore - nowS) + MARGIN_S)) }
  } catch { return null }
}

/**
 * x402 payments, our own gate on the OKX seller kit core (the same classes the Express middleware uses):
 * processHTTPRequest = answer 402 or VERIFY (no charge); processSettlement = SETTLE (the charge, sync mode: the
 * answer waits for the transfer to be confirmed on chain). Price comes from the route, the receiver from the site payout address.
 *
 * Replay protection: before the facilitator is asked, the payment identity is claimed in Redis (SET NX, lifetime from the
 * authorization own validity window). A second use is refused before verify and before the outside call. The claim is
 * released when the call ends without a settle (verify failed, outage, the outside call failed, an explicit settle
 * failure) so the visitor can retry with the same payment. It is kept after a successful settle, and also after a settle
 * whose outcome is unknown (an exception): the money may have moved, so the payment must not buy a second answer.
 */
@Injectable()
export class X402PaymentGate implements PaymentGate {
  private http: x402HTTPResourceServer | null = null
  private init: Promise<void> | null = null

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly redis: RedisService,
    @Optional() @Inject(X402_RESOURCE_SERVER) server: x402ResourceServer | null,
  ) {
    this.useResourceServer(server)
  }

  /** Swap the facilitator side (the tests use a counting mock). Production sets it once, from the environment. */
  useResourceServer(server: x402ResourceServer | null): void {
    this.init = null
    this.http = server
      ? new x402HTTPResourceServer(server, {
          [ROUTE]: {
            accepts: {
              scheme: 'exact', network: this.config.x402Network,
              price: (ctx: HTTPRequestContext) => `$${(ctx.adapter as RequestAdapter).priceUsd}`,
              payTo: (ctx: HTTPRequestContext) => (ctx.adapter as RequestAdapter).payTo,
            },
            description: 'TapeHermes route call',
          },
        } as never)
      : null
  }

  private ready(): Promise<void> {
    if (!this.init) this.init = this.http!.initialize().catch((e) => { this.init = null; throw e })
    return this.init
  }

  private refuse(status: number, code: string, message: string, headers: Record<string, string> = {}): GateDecision & { allow: false } {
    return { allow: false, errorCode: code, response: jsonResponse(status, { ok: false, error: { code, message } }, headers) }
  }
  /** 503 with a stable code: the facilitator could not be reached. Never a 402 (a 402 would make a client sign again). */
  private outage(message = 'the payment service cannot be reached; nothing was charged, try again shortly') {
    return this.refuse(503, OUTAGE_CODE, message, { 'retry-after': '5' })
  }

  async authorize(req: GateRequest): Promise<GateDecision> {
    if (req.priceUsd <= 0) return { allow: true, paid: false }
    // Fail closed: a priced route never runs without a working payment path.
    if (!this.http) return this.refuse(503, 'PAYMENTS_NOT_CONFIGURED', 'paid routes are not available on this server')
    const path = `/sites/${req.siteName}/tapeapi/v1/${req.routeName}`
    const adapter = new RequestAdapter(req, path, `${this.config.publicBaseUrl}${path}`, req.priceUsd.toFixed(6).replace(/0+$/, '').replace(/\.$/, ''), req.payoutAddress)
    const header = adapter.getHeader('payment-signature') ?? adapter.getHeader('x-payment')
    const context: HTTPRequestContext = { adapter, path, method: 'POST', paymentHeader: header }

    // Replay protection first: claim the payment before anything else is asked or run.
    let claimKey: string | null = null
    let released = false
    const release = async () => { if (claimKey && !released) { released = true; await this.redis.client.del(claimKey).catch(() => undefined) } }
    if (header) {
      const id = paymentIdentity(header)
      if (!id) return this.refuse(402, 'PAYMENT_INVALID', 'the payment could not be read')
      claimKey = this.redis.keys.payment(id.hash)
      let claimed: 'OK' | null
      try { claimed = await this.redis.client.set(claimKey, '1', 'EX', id.ttlSeconds, 'NX') } catch { return this.outage('payment checks are temporarily unavailable; nothing was charged') }
      if (!claimed) { claimKey = null; return this.refuse(402, 'PAYMENT_ALREADY_USED', 'this payment was already used; sign a new one') }
    }

    const scope = { down: false }
    let result
    try {
      result = await outageScope.run(scope, async () => { await this.ready(); return this.http!.processHTTPRequest(context) })
    } catch {
      await release()
      return this.outage()
    }
    if (scope.down) { await release(); return this.outage() } // verify could not reach the facilitator: never a 402
    if (result.type === 'no-payment-required') return { allow: true, paid: false }
    if (result.type === 'payment-error') {
      await release() // a payment that did not verify can be corrected and retried
      const noHeader = !header
      return { allow: false, response: fromInstructions(result.response), errorCode: noHeader ? 'PAYMENT_REQUIRED' : 'PAYMENT_INVALID', silent: noHeader }
    }
    const { paymentPayload, paymentRequirements, declaredExtensions } = result
    let settled = false
    return {
      allow: true, paid: true,
      release,
      settle: async (): Promise<SettleOutcome> => {
        if (settled) return { ok: false, errorCode: 'SETTLE_TWICE', response: jsonResponse(500, { ok: false, error: { code: 'INTERNAL', message: 'internal error' } }) }
        settled = true
        const s = { down: false }
        try {
          const out = await outageScope.run(s, () => this.http!.processSettlement(paymentPayload, paymentRequirements, declaredExtensions, { request: context, responseBody: Buffer.alloc(0), responseHeaders: {} }))
          if (out.success) return { ok: true, headers: out.headers, paymentTx: out.transaction ?? null }
          // The core turns a facilitator exception into success:false too, so the outage flag tells the two apart:
          if (s.down) throw new Error('settle outcome unknown')
          await release() // the facilitator itself said no: nothing moved, the same payment may be retried
          return { ok: false, errorCode: 'SETTLE_FAILED', response: fromInstructions(out.response) }
        } catch {
          // Unknown outcome (timeout, 5xx): the transfer may have happened. Keep the claim and say so plainly.
          return { ok: false, errorCode: OUTAGE_CODE, response: this.outage('the payment could not be confirmed; check your wallet before paying again').response }
        }
      },
    }
  }
}
