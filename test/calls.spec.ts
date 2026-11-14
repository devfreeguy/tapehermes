import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { verifyEnvelope, type Envelope } from '../src/sites/verify-envelope.js'
import { fakeUpstream, newWallet, resetState, startTestApp, type TestApp } from './helpers/app.js'

let t: TestApp
let token: string
let up: ReturnType<typeof fakeUpstream>
const SITE = '1.2.396.tape'
const SECRET = 'sk-live-never-in-output-77c1'
const fx = { url: 'https://data.upstream-api.com/v1/rate', params: { from: 'string' }, query: { from: 'from' }, headers: { 'x-api-key': '${UP_KEY}' }, pick: { base: 'base', rates: 'rates' }, returns: { base: 'string', rates: 'object' } }

beforeAll(async () => { t = await startTestApp({ siteCallsPerMin: 1000 }) })
afterAll(async () => { await t.stop() })

beforeEach(async () => {
  await resetState(t.prisma, t.redis); t.cache.clear(); t.chain.sites.clear()
  up = fakeUpstream({ base: 'USD', date: '2026-01-01', rates: { EUR: 0.9 } })
  t.setHosted(up)
  const w = newWallet(); t.chain.set(SITE, w.address)
  token = await t.api.signIn(w)
  await t.api.call('POST', '/api/sites', { token, body: { name: SITE } })
  await t.api.call('PUT', `/api/sites/${SITE}/secrets/UP_KEY`, { token, body: { value: SECRET } })
  await t.api.call('POST', `/api/sites/${SITE}/routes`, { token, body: { name: 'fxRate', config: fx, rateLimitPerMin: 3 } })
})

const callSite = (method = 'fxRate', params: object = { from: 'USD' }, site = SITE) =>
  fetch(`${t.base}/sites/${site}/tapeapi/v1/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: `c-${Math.random()}`, params }) })
const logs = () => t.prisma.callLog.findMany({ orderBy: { at: 'asc' } })
const flush = () => new Promise((r) => setTimeout(r, 150)) // the log write is fire-and-forget

describe('free route, full pipeline', () => {
  it('answers through the worker with a signed envelope that verifies against the site signer, and logs the call', async () => {
    const res = await callSite()
    expect(res.status).toBe(200)
    const env = (await res.json()) as Envelope & { result: any }
    expect(env.ok).toBe(true)
    expect(env.result).toEqual({ base: 'USD', rates: { EUR: 0.9 } })
    const site = await t.prisma.site.findUniqueOrThrow({ where: { name: SITE } })
    expect(verifyEnvelope(env, 'fxRate', { from: 'USD' }, site.signerAddress)).toBe(true)
    expect(verifyEnvelope(env, 'fxRate', { from: 'EUR' }, site.signerAddress)).toBe(false) // bound to the request

    // the worker called the upstream once, with the secret in its header and nowhere else
    expect(up.hits).toHaveLength(1)
    expect(up.hits[0].headers['x-api-key']).toBe(SECRET)
    expect(up.hits[0].url).not.toContain(SECRET)

    await flush()
    const rows = await logs()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ routeName: 'fxRate', result: 'OK', paid: false, paymentTx: null, errorCode: null })
    expect(rows[0].durationMs).toBeGreaterThanOrEqual(0)
    expect(Object.keys(rows[0]).sort()).toEqual(['at', 'durationMs', 'errorCode', 'id', 'paid', 'paymentTx', 'priceUsd', 'result', 'routeName', 'siteId']) // no visitor fields
  })

  it('serves the manifest of the site with its own signer and endpoint', async () => {
    const m = await (await fetch(`${t.base}/sites/${SITE}/.well-known/tapeapi.json`)).json() as any
    const site = await t.prisma.site.findUniqueOrThrow({ where: { name: SITE } })
    expect(m.signer.toLowerCase()).toBe(site.signerAddress)
    expect(m.methods.map((x: any) => x.name)).toEqual(['fxRate'])
    expect(m.endpoints.live[0]).toContain(`/sites/${SITE}/tapeapi/v1`)
  })

  it('never lets the secret reach the response, the logs, the database rows or Redis', async () => {
    const res = await callSite()
    const text = await res.text()
    await flush()
    expect(text).not.toContain(SECRET)
    expect(JSON.stringify(await logs())).not.toContain(SECRET)
    expect(JSON.stringify(await t.prisma.$queryRawUnsafe('SELECT * FROM "Site"'))).not.toContain(SECRET)
    expect(JSON.stringify(await t.prisma.$queryRawUnsafe('SELECT * FROM "Route"'))).not.toContain(SECRET)
    const keys = await t.redis.client.keys(t.redis.keys.all())
    for (const k of keys) expect(`${k}=${await t.redis.client.get(k).catch(() => '')}`).not.toContain(SECRET)
  })

  it('answers 404 for an unknown site and an unknown method is a signed error, not a crash', async () => {
    expect((await callSite('fxRate', {}, '9.9.999.tape')).status).toBe(404)
    const r = await callSite('nope')
    expect(r.status).toBeGreaterThanOrEqual(400)
    expect(r.status).toBeLessThan(500)
    await flush()
    expect((await logs()).at(-1)?.result).toBe('ERROR')
  })

  it('logs an upstream failure as ERROR with the code only', async () => {
    t.setHosted({ resolve: up.resolve, fetch: (async () => new Response('boom', { status: 500 })) as never })
    const r = await callSite()
    expect(r.status).toBeGreaterThanOrEqual(500)
    await flush()
    const row = (await logs()).at(-1)!
    expect(row.result).toBe('ERROR')
    expect(row.errorCode).toBe('INTERNAL')
  })
})

describe('rate limit', () => {
  it('answers 429 over the route limit, logs it once, and keeps no raw IP anywhere', async () => {
    for (let i = 0; i < 3; i++) expect((await callSite()).status).toBe(200)
    const blocked = await callSite()
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('retry-after')).toBeTruthy()
    expect(up.hits).toHaveLength(3) // the 4th never reached the worker
    await callSite(); await callSite()
    await flush()
    expect((await logs()).filter((r) => r.result === 'RATE_LIMITED')).toHaveLength(1)

    const keys = await t.redis.client.keys(t.redis.keys.all())
    expect(keys.some((k) => k.includes(':rate:'))).toBe(true)
    for (const k of keys) { expect(k).not.toMatch(/127\.0\.0\.1|::1|::ffff/); expect(await t.redis.client.get(k).catch(() => '')).not.toMatch(/127\.0\.0\.1|::ffff/) }
    const rate = keys.find((k) => k.includes(':rate:route'))!
    expect(await t.redis.client.ttl(rate)).toBeLessThanOrEqual(65) // short TTL
    expect(JSON.stringify(await logs())).not.toMatch(/127\.0\.0\.1|::ffff/)
  })

  it('applies the per-site cap across routes and visitors', async () => {
    const small = await startTestApp({ siteCallsPerMin: 2 })
    try {
      small.setHosted(up)
      const w = newWallet(); small.chain.set(SITE, w.address)
      const tk = await small.api.signIn(w)
      await small.api.call('POST', '/api/sites', { token: tk, body: { name: SITE } })
      await small.api.call('PUT', `/api/sites/${SITE}/secrets/UP_KEY`, { token: tk, body: { value: SECRET } })
      await small.api.call('POST', `/api/sites/${SITE}/routes`, { token: tk, body: { name: 'fxRate', config: fx, rateLimitPerMin: 100 } })
      const go = () => fetch(`${small.base}/sites/${SITE}/tapeapi/v1/fxRate`, { method: 'POST', body: JSON.stringify({ id: String(Math.random()), params: { from: 'USD' } }) })
      expect((await go()).status).toBe(200); expect((await go()).status).toBe(200)
      expect((await go()).status).toBe(429)
    } finally { await small.stop() }
  })
})

describe('paid routes fail closed without payment credentials', () => {
  it('refuses a route with a price (503), never calls the upstream, and logs REFUSED', async () => {
    await t.api.call('POST', `/api/sites/${SITE}/routes`, { token, body: { name: 'premium', config: fx, priceUsd: '0.01' } })
    const r = await callSite('premium')
    expect(r.status).toBe(503)
    expect(((await r.json()) as any).error.code).toBe('PAYMENTS_NOT_CONFIGURED')
    expect(up.hits).toHaveLength(0)
    await flush()
    expect((await logs()).at(-1)).toMatchObject({ routeName: 'premium', result: 'REFUSED', paid: false, paymentTx: null })
  })
})

describe('site state and the in-memory cache', () => {
  it('a disabled site answers 404 at once and its decrypted secrets leave memory', async () => {
    expect((await callSite()).status).toBe(200)
    expect(t.cache.has(SITE)).toBe(true)
    await t.api.call('PATCH', `/api/sites/${SITE}/status`, { token, body: { status: 'DISABLED' } })
    expect(t.cache.has(SITE)).toBe(false)
    expect((await callSite()).status).toBe(404)
    await t.api.call('PATCH', `/api/sites/${SITE}/status`, { token, body: { status: 'ACTIVE' } })
    expect((await callSite()).status).toBe(200)
  })

  it('rebuilds on any change: a changed secret is used by the next call', async () => {
    await callSite()
    await t.api.call('PUT', `/api/sites/${SITE}/secrets/UP_KEY`, { token, body: { value: 'rotated-value' } })
    await callSite()
    expect(up.hits.at(-1)!.headers['x-api-key']).toBe('rotated-value')
  })

  it('keeps at most providerCacheMax sites, evicting the least recently used', async () => {
    const small = await startTestApp({ providerCacheMax: 2 })
    try {
      small.setHosted(up)
      const w = newWallet()
      const tk = await small.api.signIn(w)
      const names = ['1.2.1.tape', '1.2.2.tape', '1.2.3.tape']
      for (const n of names) { small.chain.set(n, w.address); await small.api.call('POST', '/api/sites', { token: tk, body: { name: n } }) }
      await small.cache.get(names[0]); await small.cache.get(names[1])
      await small.cache.get(names[0]) // names[0] is now the most recent
      await small.cache.get(names[2]) // pushes out names[1]
      expect(small.cache.size()).toBe(2)
      expect(small.cache.has(names[0])).toBe(true)
      expect(small.cache.has(names[1])).toBe(false)
      expect(small.cache.has(names[2])).toBe(true)
    } finally { await small.stop() }
  })

  it('refuses to answer when dev mode is off and no delegation is stored', async () => {
    const strict = await startTestApp({ devSkipDelegation: false })
    try {
      const w = newWallet(); strict.chain.set(SITE, w.address)
      const tk = await strict.api.signIn(w)
      await strict.api.call('POST', '/api/sites', { token: tk, body: { name: SITE } })
      const r = await fetch(`${strict.base}/sites/${SITE}/tapeapi/v1/x`, { method: 'POST', body: '{}' })
      expect(r.status).toBe(503)
      expect(((await r.json()) as any).error.code).toBe('DELEGATION_REQUIRED')
    } finally { await strict.stop() }
  })
})

describe('logs and health', () => {
  it('lists calls for the owner only, with no visitor data', async () => {
    await callSite(); await flush()
    const mine = await t.api.call('GET', `/api/sites/${SITE}/logs`, { token })
    expect(mine.body).toHaveLength(1)
    expect(Object.keys(mine.body[0]).sort()).toEqual(['at', 'durationMs', 'errorCode', 'paid', 'paymentTx', 'priceUsd', 'result', 'routeName'])
    const other = await t.api.signIn(newWallet())
    expect((await t.api.call('GET', `/api/sites/${SITE}/logs`, { token: other })).status).toBe(404)
  })

  it('reports health of the database and Redis', async () => {
    const h = await t.api.call('GET', '/health')
    expect(h.status).toBe(200)
    expect(h.body).toEqual({ ok: true, database: 'up', redis: 'up' })
  })
})

describe('startup safety', () => {
  it('refuses to start in production with the dev switch on', async () => {
    const { loadConfig } = await import('../src/config/app-config.js')
    expect(() => loadConfig({ ...process.env, NODE_ENV: 'production', UNSAFE_DEV_SKIP_DELEGATION: '1' })).toThrow(/production/)
  })
  it('names a missing variable without printing any value', async () => {
    const { loadConfig } = await import('../src/config/app-config.js')
    try { loadConfig({ ...process.env, VAULT_MASTER_KEY: undefined }); expect.unreachable() } catch (e) {
      expect((e as Error).message).toContain('VAULT_MASTER_KEY')
      expect((e as Error).message).not.toContain(process.env.RATE_LIMIT_SALT!)
    }
  })
})

describe('a site with no routes yet', () => {
  it('answers a clean 404, not an error', async () => {
    await t.api.call('DELETE', `/api/sites/${SITE}/routes/fxRate`, { token })
    const r = await fetch(`${t.base}/sites/${SITE}/.well-known/tapeapi.json`)
    expect(r.status).toBe(404)
    expect(((await r.json()) as any).error.message).toContain('no routes')
  })
})

describe('startup safety: base URL', () => {
  it('refuses an http PUBLIC_BASE_URL when the dev switch is off', async () => {
    const { loadConfig } = await import('../src/config/app-config.js')
    expect(() => loadConfig({ ...process.env, UNSAFE_DEV_SKIP_DELEGATION: '0', PUBLIC_BASE_URL: 'http://127.0.0.1:3000' })).toThrow(/https/)
    expect(() => loadConfig({ ...process.env, UNSAFE_DEV_SKIP_DELEGATION: '0', PUBLIC_BASE_URL: 'https://api.example.org' })).not.toThrow()
  })
})
