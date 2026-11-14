import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { paymentIdentity } from '../src/calls/x402-payment-gate.js'
import { buyerFetch } from '../src/payments/buyer-fetch.js'
import { fakeUpstream, newWallet, resetState, startTestApp, type TestApp } from './helpers/app.js'
import { attachFacilitator, MOCK_TX } from './helpers/x402.js'

let t: TestApp
let up: ReturnType<typeof fakeUpstream>
let fac: ReturnType<typeof attachFacilitator>
const buyer = newWallet()
const SITE = '1.2.396.tape'
const fx = { url: 'https://data.upstream-api.com/v1/rate', params: { from: 'string' }, required: ['from'], query: { from: 'from' }, pick: { base: 'base', rates: 'rates' }, returns: { base: 'string', rates: 'object' } }
const body = () => JSON.stringify({ id: `r-${Math.random()}`, params: { from: 'USD' } })
const route = () => `${t.base}/sites/${SITE}/tapeapi/v1/paid`
const flush = () => new Promise((r) => setTimeout(r, 200))
const logs = () => t.prisma.callLog.findMany({ orderBy: { at: 'asc' } })
const fiveHundred = () => ({ resolve: up.resolve, fetch: (async () => new Response('boom', { status: 500 })) as never })

/** One real buyer attempt (402, sign, retry); returns the payment header that was sent and the final response. */
async function attempt() {
  const real = globalThis.fetch
  let header = ''
  globalThis.fetch = ((u: any, init?: any) => {
    const h = new Headers(u instanceof Request ? u.headers : init?.headers) // the buyer library may pass a Request
    if (h.get('payment-signature')) header = h.get('payment-signature')!
    return real(u, init)
  }) as never
  try {
    const response = await buyerFetch(buyer)(route(), { method: 'POST', headers: { 'content-type': 'application/json' }, body: body() })
    return { header, response }
  } finally { globalThis.fetch = real }
}
/** Send a payment header yourself, as a replaying client would. */
const withHeader = (header: string) => fetch(route(), { method: 'POST', headers: { 'content-type': 'application/json', 'payment-signature': header }, body: body() })
const paymentKeys = async () => (await t.redis.client.keys(t.redis.keys.all())).filter((k) => k.includes(':payment:'))
const code = async (r: Response) => ((await r.json()) as any).error?.code

beforeAll(async () => { t = await startTestApp({ siteCallsPerMin: 1000 }) })
afterAll(async () => { await t.stop() })
beforeEach(async () => {
  await resetState(t.prisma, t.redis); t.cache.clear(); t.chain.sites.clear()
  up = fakeUpstream(); t.setHosted(up); fac = attachFacilitator(t)
  const owner = newWallet(); t.chain.set(SITE, owner.address)
  const tk = await t.api.signIn(owner)
  await t.api.call('POST', '/api/sites', { token: tk, body: { name: SITE } })
  await t.api.call('POST', `/api/sites/${SITE}/routes`, { token: tk, body: { name: 'paid', config: fx, priceUsd: '0.002' } })
})

describe('facilitator outage is a 503, never a 402', () => {
  it('settle that cannot be confirmed: 503, answer withheld, and the payment stays used (the money may have moved)', async () => {
    fac.script.throwOnSettle = true
    const { header, response } = await attempt()
    expect(response.status).toBe(503)
    const text = await response.text()
    expect(JSON.parse(text).error.code).toBe('PAYMENT_SERVICE_UNAVAILABLE')
    expect(text).not.toContain('EUR')
    fac.script.throwOnSettle = false
    const again = await withHeader(header)
    expect(again.status).toBe(402)
    expect(await code(again)).toBe('PAYMENT_ALREADY_USED')
    expect(up.hits).toHaveLength(1)
  })
})

describe('replay protection (a payment buys one answer)', () => {
  it('a replay after a successful call is refused, with zero outside calls and no facilitator call', async () => {
    const { header, response } = await attempt()
    expect(response.status).toBe(200)
    const [verifies, settles, hits] = [fac.verifyCalls, fac.settleCalls, up.hits.length]
    const replay = await withHeader(header)
    expect(replay.status).toBe(402)
    expect(await code(replay)).toBe('PAYMENT_ALREADY_USED')
    expect([fac.verifyCalls, fac.settleCalls, up.hits.length]).toEqual([verifies, settles, hits]) // refused before verify and before the handler
    expect(hits).toBe(1)
    await flush()
    expect((await logs()).at(-1)).toMatchObject({ result: 'REFUSED', errorCode: 'PAYMENT_ALREADY_USED', paid: false })
  })

  it('the same authorization re-encoded into a different header text is still refused', async () => {
    const { header } = await attempt()
    const p = JSON.parse(Buffer.from(header, 'base64').toString())
    const reencoded = Buffer.from(JSON.stringify({ extra: 'x', ...p }, null, 2)).toString('base64')
    expect(reencoded).not.toBe(header)
    expect(await code(await withHeader(reencoded))).toBe('PAYMENT_ALREADY_USED')
    expect(up.hits).toHaveLength(1)
  })

  it('a call that fails releases the payment: the same payment can be retried and settles once', async () => {
    t.setHosted(fiveHundred())
    const first = await attempt()
    expect(first.response.status).toBeGreaterThanOrEqual(500)
    expect(fac.settleCalls).toBe(0)
    expect(await paymentKeys()).toHaveLength(0) // released
    t.setHosted(up) // the outside service is back
    const retry = await withHeader(first.header)
    expect(retry.status).toBe(200)
    expect(JSON.parse(Buffer.from(retry.headers.get('payment-response')!, 'base64').toString()).transaction).toBe(MOCK_TX)
    expect([fac.settleCalls, up.hits.length]).toEqual([1, 1])
    expect(await paymentKeys()).toHaveLength(1) // used now
    expect((await withHeader(first.header)).status).toBe(402) // and a third use is refused
  })

  it('an invalid payment, an outage and an explicit settle failure each release the payment for a retry', async () => {
    for (const script of [{ failVerify: true }, { throwOnVerify: true }, { failSettle: true }] as const) {
      const f = attachFacilitator(t, { ...script })
      const used = (await paymentKeys()).length // payments already spent in earlier rounds stay recorded
      const first = await attempt()
      expect(first.response.status).toBeGreaterThanOrEqual(400)
      expect(await paymentKeys()).toHaveLength(used) // this one was released
      Object.assign(f.script, { failVerify: false, throwOnVerify: false, failSettle: false })
      expect((await withHeader(first.header)).status).toBe(200) // the same payment, now accepted
    }
  })

  it('two requests with the same payment at the same time: one is served, one is refused, one outside call', async () => {
    t.setHosted(fiveHundred())
    const { header } = await attempt() // a signed, unused payment (released after the failure)
    t.setHosted(up)
    const [a, b] = await Promise.all([withHeader(header), withHeader(header)])
    expect([a.status, b.status].sort()).toEqual([200, 402])
    expect(await code(a.status === 402 ? a : b)).toBe('PAYMENT_ALREADY_USED')
    expect([up.hits.length, fac.settleCalls]).toEqual([1, 1])
  })

  it('stores only a hash in Redis, with a lifetime taken from the authorization own validity window', async () => {
    const { header } = await attempt()
    const keys = await paymentKeys()
    expect(keys).toHaveLength(1)
    const p = JSON.parse(Buffer.from(header, 'base64').toString())
    const a = p.payload.authorization
    expect(keys[0].split(':payment:')[1]).toMatch(/^[0-9a-f]{64}$/)
    for (const secret of [a.from, a.nonce, p.payload.signature]) expect(keys[0].toLowerCase()).not.toContain(secret.toLowerCase().replace(/^0x/, ''))
    expect(await t.redis.client.get(keys[0])).toBe('1') // no header, address or nonce in the value either
    const ttl = await t.redis.client.ttl(keys[0])
    const window = Number(a.validBefore) - Math.floor(Date.now() / 1000)
    expect(ttl).toBeGreaterThan(0)
    expect(ttl).toBeLessThanOrEqual(window + 31) // validity window + 30 s margin (one second of clock slack)
    expect(ttl).toBeGreaterThan(window - 5)
  })

  it('a header that cannot be read is refused before the facilitator is asked, and leaves no record', async () => {
    const junk = ['not-base64-json', Buffer.from('{"a":1}').toString('base64'), Buffer.from(JSON.stringify({ payload: { authorization: {} } })).toString('base64')]
    for (const j of junk) {
      const r = await withHeader(j)
      expect(r.status).toBe(402)
      expect(await code(r)).toBe('PAYMENT_INVALID')
    }
    expect(fac.verifyCalls).toBe(0)
    expect(await paymentKeys()).toHaveLength(0)
    expect(up.hits).toHaveLength(0)
  })
})

describe('refused payments cannot flood the call log', () => {
  it('many refused payments of the same kind in one window leave one log row; a different reason gets its own row', async () => {
    fac.script.failVerify = true
    for (let i = 0; i < 6; i++) expect((await attempt()).response.status).toBe(402)
    await flush()
    const invalid = (await logs()).filter((l) => l.errorCode === 'PAYMENT_INVALID')
    expect(invalid).toHaveLength(1)
    fac.script.failVerify = false
    const { header } = await attempt() // one good payment
    for (let i = 0; i < 4; i++) expect((await withHeader(header)).status).toBe(402)
    await flush()
    const rows = await logs()
    expect(rows.filter((l) => l.errorCode === 'PAYMENT_ALREADY_USED')).toHaveLength(1) // 4 replays, 1 row
    expect(rows.filter((l) => l.errorCode === 'PAYMENT_INVALID')).toHaveLength(1)
    expect(fac.verifyCalls).toBe(7) // 6 invalid + 1 good: the replays never reached the facilitator
  })
})

describe('paymentIdentity (the key and the lifetime)', () => {
  const header = (over: Record<string, unknown> = {}, accepted: Record<string, unknown> = {}) => Buffer.from(JSON.stringify({
    accepted: { network: 'eip155:1952', asset: '0xAAAA', ...accepted },
    payload: { authorization: { from: '0xAbC', nonce: '0xN1', validBefore: '1000100', ...over }, signature: '0xsig' },
  })).toString('base64')

  it('is a sha256 hex, case-insensitive on addresses, and changes with payer, nonce, asset or network', () => {
    const a = paymentIdentity(header(), 1_000_000)!
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(paymentIdentity(header({ from: '0xABC' }), 1_000_000)!.hash).toBe(a.hash)
    expect(paymentIdentity(header({ nonce: '0xN2' }), 1_000_000)!.hash).not.toBe(a.hash)
    expect(paymentIdentity(header({ from: '0xDEF' }), 1_000_000)!.hash).not.toBe(a.hash)
    expect(paymentIdentity(header({}, { asset: '0xBBBB' }), 1_000_000)!.hash).not.toBe(a.hash)
    expect(paymentIdentity(header({}, { network: 'eip155:196' }), 1_000_000)!.hash).not.toBe(a.hash)
  })

  it('lifetime is the time left in the validity window plus 30 s, at least 5 s, at most a day', () => {
    expect(paymentIdentity(header({ validBefore: '1000100' }), 1_000_000)!.ttlSeconds).toBe(130)
    expect(paymentIdentity(header({ validBefore: '999000' }), 1_000_000)!.ttlSeconds).toBe(5)
    expect(paymentIdentity(header({ validBefore: '99999999999' }), 1_000_000)!.ttlSeconds).toBe(86_400)
  })

  it('is null for anything that is not a payment this server recognises', () => {
    for (const bad of [undefined, null, '', 'zzz', Buffer.from('[]').toString('base64'), header({ nonce: undefined }), header({ validBefore: 'soon' }), 'A'.repeat(9000)]) {
      expect(paymentIdentity(bad as never)).toBeNull()
    }
  })
})
