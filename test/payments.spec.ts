import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buyerFetch } from '../src/payments/buyer-fetch.js'
import { verifyEnvelope, type Envelope } from '../src/sites/verify-envelope.js'
import { fakeUpstream, newWallet, resetState, startTestApp, type TestApp } from './helpers/app.js'
import { attachFacilitator, gateOf, MOCK_TX } from './helpers/x402.js'

let t: TestApp
let token: string
let up: ReturnType<typeof fakeUpstream>
let fac: ReturnType<typeof attachFacilitator>
let payout: ReturnType<typeof newWallet>
const buyer = newWallet()
const SITE = '1.2.396.tape'
const fx = { url: 'https://data.upstream-api.com/v1/rate', params: { from: 'string' }, required: ['from'], query: { from: 'from' }, pick: { base: 'base', rates: 'rates' }, returns: { base: 'string', rates: 'object' } }
const body = (params: object = { from: 'USD' }) => JSON.stringify({ id: `p-${Math.random()}`, params })
const url = (route = 'paid', site = SITE) => `${t.base}/sites/${site}/tapeapi/v1/${route}`
const post = (route = 'paid', params?: object, site = SITE) => fetch(url(route, site), { method: 'POST', headers: { 'content-type': 'application/json' }, body: body(params) })
const pay = (route = 'paid', params?: object, site = SITE) => buyerFetch(buyer)(url(route, site), { method: 'POST', headers: { 'content-type': 'application/json' }, body: body(params) })
const flush = () => new Promise((r) => setTimeout(r, 200))
const logs = () => t.prisma.callLog.findMany({ orderBy: { at: 'asc' } })
const requirement = (res: Response) => JSON.parse(Buffer.from(res.headers.get('payment-required')!, 'base64').toString()).accepts[0]

beforeAll(async () => { t = await startTestApp({ siteCallsPerMin: 1000 }) })
afterAll(async () => { await t.stop() })

beforeEach(async () => {
  await resetState(t.prisma, t.redis); t.cache.clear(); t.chain.sites.clear()
  up = fakeUpstream(); t.setHosted(up)
  fac = attachFacilitator(t)
  payout = newWallet()
  const owner = newWallet(); t.chain.set(SITE, owner.address)
  token = await t.api.signIn(owner)
  await t.api.call('POST', '/api/sites', { token, body: { name: SITE } })
  await t.api.call('PUT', `/api/sites/${SITE}/payout`, { token, body: { payoutAddress: payout.address } })
  await t.api.call('POST', `/api/sites/${SITE}/routes`, { token, body: { name: 'paid', config: fx, priceUsd: '0.002' } })
  await t.api.call('POST', `/api/sites/${SITE}/routes`, { token, body: { name: 'free', config: fx } })
})

describe('the 402 challenge', () => {
  it('asks for the route price, to the site payout address, on the configured network, and charges nothing', async () => {
    const r = await post()
    expect(r.status).toBe(402)
    const req = requirement(r)
    expect(req.payTo.toLowerCase()).toBe(payout.address.toLowerCase())
    expect(req.amount).toBe('2000') // $0.002 in 6-decimal USDT0
    expect(req.network).toBe('eip155:1952')
    expect(req.asset.toLowerCase()).toBe('0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c')
    expect(up.hits).toHaveLength(0)
    expect(fac.settleCalls).toBe(0)
    await flush()
    expect(await logs()).toHaveLength(0) // a bare challenge is not logged
  })

  it('takes price from the route and receiver from the site: a changed price and payout apply at once', async () => {
    await t.api.call('PATCH', `/api/sites/${SITE}/routes/paid`, { token, body: { priceUsd: '0.05' } })
    const other = newWallet()
    await t.api.call('PUT', `/api/sites/${SITE}/payout`, { token, body: { payoutAddress: other.address } })
    const req = requirement(await post())
    expect(req.amount).toBe('50000')
    expect(req.payTo.toLowerCase()).toBe(other.address.toLowerCase())
  })

  it('gives each site its own receiver', async () => {
    const SITE2 = '1.2.397.tape'
    const w2 = newWallet(), payout2 = newWallet(); t.chain.set(SITE2, w2.address)
    const tk2 = await t.api.signIn(w2)
    await t.api.call('POST', '/api/sites', { token: tk2, body: { name: SITE2 } })
    await t.api.call('PUT', `/api/sites/${SITE2}/payout`, { token: tk2, body: { payoutAddress: payout2.address } })
    await t.api.call('POST', `/api/sites/${SITE2}/routes`, { token: tk2, body: { name: 'paid', config: fx, priceUsd: '0.001' } })
    expect(requirement(await post('paid', undefined, SITE2)).payTo.toLowerCase()).toBe(payout2.address.toLowerCase())
    expect(requirement(await post()).payTo.toLowerCase()).toBe(payout.address.toLowerCase())
  })
})

describe('a successful paid call', () => {
  it('verifies, calls the outside service once, settles once, returns the signed answer and logs the transaction', async () => {
    const r = await pay()
    expect(r.status).toBe(200)
    const env = (await r.json()) as Envelope
    const site = await t.prisma.site.findUniqueOrThrow({ where: { name: SITE } })
    expect(verifyEnvelope(env, 'paid', { from: 'USD' }, site.signerAddress)).toBe(true)
    const settle = JSON.parse(Buffer.from(r.headers.get('payment-response')!, 'base64').toString())
    expect(settle.success).toBe(true)
    expect(settle.transaction).toBe(MOCK_TX)
    expect([fac.verifyCalls, fac.settleCalls, up.hits.length]).toEqual([1, 1, 1])
    await flush()
    const rows = await logs()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ routeName: 'paid', result: 'OK', paid: true, paymentTx: MOCK_TX, errorCode: null })
    expect(rows[0].priceUsd.toString()).toBe('0.002')
  })

  it('a free route on the same site is never paid for and never touches the facilitator', async () => {
    const r = await post('free')
    expect(r.status).toBe(200)
    expect([fac.verifyCalls, fac.settleCalls]).toEqual([0, 0])
    await flush()
    expect((await logs())[0]).toMatchObject({ paid: false, paymentTx: null })
    expect((await logs())[0].priceUsd.toString()).toBe('0')
  })
})

describe('a visitor is never charged when the call does not succeed (settle count stays 0)', () => {
  const notCharged = async () => {
    await flush()
    expect(fac.settleCalls).toBe(0)
    for (const row of await logs()) expect(row).toMatchObject({ paid: false, paymentTx: null })
  }

  it('the outside call fails (upstream 500)', async () => {
    t.setHosted({ resolve: up.resolve, fetch: (async () => new Response('boom', { status: 500 })) as never })
    const r = await pay()
    expect(r.status).toBeGreaterThanOrEqual(500)
    expect(r.headers.get('payment-response')).toBeNull()
    expect(fac.verifyCalls).toBe(1) // it was verified, then NOT settled
    await notCharged()
    expect((await logs())[0]).toMatchObject({ result: 'ERROR', errorCode: 'INTERNAL' })
  })

  it('the outside call is refused by the worker policy (host resolves to a private address)', async () => {
    t.setHosted({ resolve: async () => ['10.0.0.5'], fetch: up.fetch })
    const r = await pay()
    expect(r.status).toBeGreaterThanOrEqual(500)
    expect(up.hits).toHaveLength(0)
    await notCharged()
  })

  it('the request itself is bad (missing required parameter)', async () => {
    const r = await pay('paid', {})
    expect(r.status).toBe(400)
    expect(up.hits).toHaveLength(0)
    await notCharged()
  })

  it('the upstream answers 4xx', async () => {
    t.setHosted({ resolve: up.resolve, fetch: (async () => new Response('{"e":1}', { status: 404, headers: { 'content-type': 'application/json' } })) as never })
    const r = await pay()
    expect(r.status).toBeGreaterThanOrEqual(400)
    await notCharged()
  })

  it('the upstream answers something that is not JSON', async () => {
    t.setHosted({ resolve: up.resolve, fetch: (async () => new Response('<html>', { status: 200 })) as never })
    const r = await pay()
    expect(r.status).toBeGreaterThanOrEqual(500)
    await notCharged()
  })

  it('the site is disabled (404 before anything else)', async () => {
    await t.api.call('PATCH', `/api/sites/${SITE}/status`, { token, body: { status: 'DISABLED' } })
    const r = await pay()
    expect(r.status).toBe(404)
    expect(fac.verifyCalls).toBe(0)
    await notCharged()
  })
})

describe('rate limit comes before the facilitator', () => {
  it('a throttled paid call is refused with 429 and the facilitator is not called at all', async () => {
    await t.api.call('PATCH', `/api/sites/${SITE}/routes/paid`, { token, body: { rateLimitPerMin: 1 } })
    expect((await pay()).status).toBe(200)
    const before = [fac.verifyCalls, fac.settleCalls]
    const r = await pay()
    expect(r.status).toBe(429)
    expect([fac.verifyCalls, fac.settleCalls]).toEqual(before)
    expect(up.hits).toHaveLength(1)
  })
})

describe('the facilitator side fails', () => {
  it('payment does not verify: the outside call never runs and nothing settles', async () => {
    fac.script.failVerify = true
    const r = await pay()
    expect(r.status).toBeGreaterThanOrEqual(400)
    expect(up.hits).toHaveLength(0)
    expect(fac.settleCalls).toBe(0)
    await flush()
    expect((await logs())[0]).toMatchObject({ result: 'REFUSED', errorCode: 'PAYMENT_INVALID', paid: false })
  })

  it('verify cannot reach the facilitator: 503 with a clear code, never a 402; outside call never runs; nothing is charged', async () => {
    fac.script.throwOnVerify = true
    const r = await pay()
    expect(r.status).toBe(503)
    expect(((await r.json()) as any).error.code).toBe('PAYMENT_SERVICE_UNAVAILABLE')
    expect(r.headers.get('retry-after')).toBeTruthy()
    expect(r.headers.get('payment-required')).toBeNull() // nothing that invites the client to sign again
    expect(up.hits).toHaveLength(0)
    expect(fac.settleCalls).toBe(0)
    await flush()
    expect((await logs())[0]).toMatchObject({ result: 'REFUSED', errorCode: 'PAYMENT_SERVICE_UNAVAILABLE', paid: false })
  })

  it('an invalid payment is still a 402 (not an outage)', async () => {
    fac.script.failVerify = true
    expect((await pay()).status).toBe(402)
  })

  it('settle fails after a good answer: the answer is withheld, nothing is logged as paid', async () => {
    fac.script.failSettle = true
    const r = await pay()
    expect(r.status).toBeGreaterThanOrEqual(400)
    const text = await r.text()
    expect(text).not.toContain('EUR') // the answer content never reached the visitor
    const failure = JSON.parse(Buffer.from(r.headers.get('payment-response')!, 'base64').toString())
    expect(failure.success).toBe(false) // the kit says so itself
    expect(fac.settleCalls).toBe(1)
    expect(up.hits).toHaveLength(1) // the known cost: the seller paid for one outside call (see PHASE2.md)
    await flush()
    expect((await logs())[0]).toMatchObject({ result: 'ERROR', errorCode: 'SETTLE_FAILED', paid: false, paymentTx: null })
  })
})

describe('without OKX credentials', () => {
  it('a priced route fails closed (503), free routes still work', async () => {
    gateOf(t).useResourceServer(null)
    const r = await post()
    expect(r.status).toBe(503)
    expect(((await r.json()) as any).error.code).toBe('PAYMENTS_NOT_CONFIGURED')
    expect(up.hits).toHaveLength(0)
    expect((await post('free')).status).toBe(200)
  })
})

describe('CORS for the payment flow', () => {
  const allowed = (r: Response) => r.headers.get('access-control-allow-headers')!.toLowerCase()
  const exposed = (r: Response) => r.headers.get('access-control-expose-headers')!.toLowerCase()

  it('the preflight allows the payment request header and answers for every site', async () => {
    for (const site of [SITE, 'no-such-site']) {
      const r = await fetch(url('paid', site), { method: 'OPTIONS', headers: { origin: 'https://1-2-396.tapekit.org', 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type,payment-signature' } })
      expect(r.status).toBe(204)
      expect(allowed(r)).toContain('payment-signature')
      expect(allowed(r)).toContain('x-payment')
      expect(allowed(r)).toContain('content-type')
      expect(r.headers.get('access-control-allow-origin')).toBe('*')
    }
  })

  it('every answer exposes the payment response headers: the 402, the paid 200, a free 200 and an error', async () => {
    const challenge = await post()
    const paid = await pay()
    const free = await post('free')
    const missing = await post('free', undefined, 'no-such-site')
    for (const r of [challenge, paid, free, missing]) {
      expect(exposed(r)).toContain('payment-required')
      expect(exposed(r)).toContain('payment-response')
      expect(exposed(r)).toContain('x-payment-response')
      expect(allowed(r)).toContain('payment-signature')
    }
    expect(challenge.headers.get('payment-required')).toBeTruthy() // the header the page needs to read is present
    expect(paid.headers.get('payment-response')).toBeTruthy()
  })
})
