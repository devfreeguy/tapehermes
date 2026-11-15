import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config/app-config.js'
import { delegate, fakeUpstream, newWallet, resetState, startTestApp, type TestApp } from './helpers/app.js'

const SITE = '1.2.396.tape'
const ORIGIN = 'https://dashboard.example.org'
const fx = { url: 'https://data.upstream-api.com/v1/rate', params: { from: 'string' }, query: { from: 'from' }, headers: { 'x-api-key': '${UP_KEY}', 'x-auth-token': 'Bearer ${UP_KEY}' } }
let t: TestApp
let holder: ReturnType<typeof newWallet>
let token: string
const api = (m: string, p: string, body?: unknown, tk = token) => t.api.call(m, p, { token: tk, body })

beforeAll(async () => { t = await startTestApp({ corsOrigins: [ORIGIN, 'http://localhost:3001'], siteCallsPerMin: 1000 }) })
afterAll(async () => { await t.stop() })
beforeEach(async () => {
  await resetState(t.prisma, t.redis); t.cache.clear(); t.chain.sites.clear(); t.chain.manifests.clear(); t.chain.down = false
  holder = newWallet(); t.chain.set(SITE, holder.address)
  token = await t.api.signIn(holder)
  await api('POST', '/api/sites', { name: SITE })
})

describe('CORS for the management API', () => {
  const ask = (origin: string | null, method = 'GET', path = '/api/auth/me') => fetch(`${t.base}${path}`, { method, headers: { ...(origin ? { origin } : {}), ...(method === 'OPTIONS' ? { 'access-control-request-method': 'PUT', 'access-control-request-headers': 'authorization,content-type' } : {}) } })

  it('gives an allowed origin exact-origin headers, never a wildcard, and no credentials mode', async () => {
    const r = await ask(ORIGIN)
    expect(r.status).toBe(401) // the call itself still needs a session
    expect(r.headers.get('access-control-allow-origin')).toBe(ORIGIN)
    expect(r.headers.get('vary')).toContain('Origin')
    expect(r.headers.get('access-control-allow-credentials')).toBeNull()
    expect((await ask('http://localhost:3001')).headers.get('access-control-allow-origin')).toBe('http://localhost:3001')
  })

  it('answers the preflight for an allowed origin with the Authorization header allowed', async () => {
    const r = await ask(ORIGIN, 'OPTIONS', `/api/sites/${SITE}/secrets/X`)
    expect(r.status).toBe(204)
    expect(r.headers.get('access-control-allow-headers')!.toLowerCase()).toContain('authorization')
    expect(r.headers.get('access-control-allow-methods')).toContain('PATCH')
  })

  it('gives any other origin no headers at all, so the browser blocks the call', async () => {
    for (const o of ['https://evil.example.org', 'https://dashboard.example.org.evil.org', 'http://dashboard.example.org', 'null']) {
      const r = await ask(o)
      expect(r.headers.get('access-control-allow-origin')).toBeNull()
      expect((await ask(o, 'OPTIONS')).headers.get('access-control-allow-origin')).toBeNull()
    }
    expect((await ask(null)).headers.get('access-control-allow-origin')).toBeNull()
  })

  it('refuses unsafe CORS_ORIGINS at startup', () => {
    const base = { ...process.env, UNSAFE_DEV_SKIP_DELEGATION: '1' }
    for (const bad of ['*', 'https://a.example.org/path', 'https://a.example.org/', 'http://dashboard.example.org', 'ftp://x.org', 'dashboard']) {
      expect(() => loadConfig({ ...base, CORS_ORIGINS: bad })).toThrow(/CORS_ORIGINS/)
    }
    expect(() => loadConfig({ ...base, NODE_ENV: 'production', UNSAFE_DEV_SKIP_DELEGATION: '0', PUBLIC_BASE_URL: 'https://api.example.org', CORS_ORIGINS: 'http://localhost:3001' })).toThrow(/CORS_ORIGINS/)
    expect(loadConfig({ ...base, CORS_ORIGINS: `${ORIGIN},http://localhost:3001` }).corsOrigins).toEqual([ORIGIN, 'http://localhost:3001'])
    expect(loadConfig({ ...base, CORS_ORIGINS: '' }).corsOrigins).toEqual([])
  })
})

describe('renaming a secret', () => {
  const VALUE = 'sk-rename-value-31'
  beforeEach(async () => {
    t.setHosted(fakeUpstream())
    await api('PUT', `/api/sites/${SITE}/secrets/UP_KEY`, { value: VALUE })
    await api('POST', `/api/sites/${SITE}/routes`, { name: 'fx', config: fx })
  })

  it('moves the value to the new name, updates every route header that used it, and the next call still works', async () => {
    const up = fakeUpstream(); t.setHosted(up)
    const r = await api('PATCH', `/api/sites/${SITE}/secrets/UP_KEY`, { name: 'RATES_KEY' })
    expect(r.status).toBe(200)
    expect(r.body.name).toBe('RATES_KEY')
    expect(r.text).not.toContain(VALUE)
    expect((await api('GET', `/api/sites/${SITE}/secrets`)).body.map((s: any) => s.name)).toEqual(['RATES_KEY'])
    const route = (await api('GET', `/api/sites/${SITE}/routes`)).body[0]
    expect(route.config.headers).toEqual({ 'x-api-key': '${RATES_KEY}', 'x-auth-token': 'Bearer ${RATES_KEY}' })
    const res = await fetch(`${t.base}/sites/${SITE}/tapeapi/v1/fx`, { method: 'POST', body: JSON.stringify({ id: 'r1', params: { from: 'USD' } }) })
    expect(res.status).toBe(200)
    expect(up.hits[0].headers['x-api-key']).toBe(VALUE)
    expect(up.hits[0].headers['x-auth-token']).toBe(`Bearer ${VALUE}`)
    expect(await t.prisma.secret.count()).toBe(1)
    expect(JSON.stringify(await t.prisma.$queryRawUnsafe('SELECT * FROM "Secret"'))).not.toContain(VALUE)
  })

  it('refuses a taken name (409), a bad name (400), an unknown secret (404) and another owner (404); the same name is a no-op', async () => {
    await api('PUT', `/api/sites/${SITE}/secrets/OTHER`, { value: 'x' })
    expect((await api('PATCH', `/api/sites/${SITE}/secrets/UP_KEY`, { name: 'OTHER' })).status).toBe(409)
    expect((await api('PATCH', `/api/sites/${SITE}/secrets/UP_KEY`, { name: 'lower-case' })).status).toBe(400)
    expect((await api('PATCH', `/api/sites/${SITE}/secrets/NOPE`, { name: 'NEW_ONE' })).status).toBe(404)
    expect((await api('PATCH', `/api/sites/${SITE}/secrets/UP_KEY`, { name: 'UP_KEY' })).status).toBe(200)
    const other = await t.api.signIn(newWallet())
    expect((await api('PATCH', `/api/sites/${SITE}/secrets/UP_KEY`, { name: 'STOLEN' }, other)).status).toBe(404)
    expect((await api('GET', `/api/sites/${SITE}/routes`)).body[0].config.headers['x-api-key']).toBe('${UP_KEY}') // nothing changed
  })
})

describe('call log: route filter and summary', () => {
  beforeEach(async () => {
    const site = await t.prisma.site.findUniqueOrThrow({ where: { name: SITE } })
    const row = (routeName: string, result: 'OK' | 'ERROR' | 'RATE_LIMITED' | 'REFUSED', extra: object = {}) => ({ siteId: site.id, routeName, result, durationMs: 5, ...extra })
    await t.prisma.callLog.createMany({
      data: [
        row('fx', 'OK'), row('fx', 'OK'), row('fx', 'ERROR', { errorCode: 'INTERNAL' }), row('fx', 'RATE_LIMITED'),
        row('ai', 'OK', { paid: true, paymentTx: '0x' + 'ab'.repeat(32), priceUsd: '0.010000' }),
        row('ai', 'OK', { paid: true, paymentTx: '0x' + 'cd'.repeat(32), priceUsd: '0.010000' }),
        row('ai', 'REFUSED', { errorCode: 'PAYMENT_INVALID' }),
        row('ai', 'OK', { at: new Date(Date.now() - 30 * 86_400_000) }), // outside a 7 day window
      ],
    })
  })

  it('filters the list to one route, newest first, and pages with before', async () => {
    const all = (await api('GET', `/api/sites/${SITE}/logs?limit=100`)).body
    expect(all).toHaveLength(8)
    const fxRows = (await api('GET', `/api/sites/${SITE}/logs?route=fx`)).body
    expect(fxRows).toHaveLength(4)
    expect(fxRows.every((r: any) => r.routeName === 'fx')).toBe(true)
    const page = (await api('GET', `/api/sites/${SITE}/logs?route=ai&limit=2`)).body
    expect(page).toHaveLength(2)
    const older = (await api('GET', `/api/sites/${SITE}/logs?route=ai&before=${encodeURIComponent(page[1].at)}`)).body
    expect(older.every((r: any) => new Date(r.at) < new Date(page[1].at))).toBe(true)
    expect((await api('GET', `/api/sites/${SITE}/logs?route=bad%20name!`)).status).toBe(400)
  })

  it('summarises counts per route and result, paid calls and paid dollars, for the chosen days only', async () => {
    const s = (await api('GET', `/api/sites/${SITE}/logs/summary?days=7`)).body
    expect(s.days).toBe(7)
    expect(s.routes.fx).toMatchObject({ calls: 4, OK: 2, ERROR: 1, RATE_LIMITED: 1, REFUSED: 0, paidCalls: 0, paidUsd: '0' })
    expect(s.routes.ai).toMatchObject({ calls: 3, OK: 2, REFUSED: 1, paidCalls: 2 })
    expect(Number(s.routes.ai.paidUsd)).toBeCloseTo(0.02, 6)
    expect(s.totals).toMatchObject({ calls: 7, paidCalls: 2 })
    const wide = (await api('GET', `/api/sites/${SITE}/logs/summary?days=90`)).body
    expect(wide.routes.ai.calls).toBe(4)
    expect((await api('GET', `/api/sites/${SITE}/logs/summary?days=0`)).status).toBe(400)
  })

  it('is for the owner only and holds nothing about visitors', async () => {
    const other = await t.api.signIn(newWallet())
    expect((await api('GET', `/api/sites/${SITE}/logs/summary`, undefined, other)).status).toBe(404)
    expect((await api('GET', `/api/sites/${SITE}/logs?route=fx`, undefined, other)).status).toBe(404)
    const row = (await api('GET', `/api/sites/${SITE}/logs?limit=1`)).body[0]
    expect(Object.keys(row).sort()).toEqual(['at', 'durationMs', 'errorCode', 'paid', 'paymentTx', 'priceUsd', 'result', 'routeName'])
  })
})

describe('is the on-chain manifest out of date?', () => {
  const status = async () => (await api('GET', `/api/sites/${SITE}/manifest/status`)).body
  beforeEach(async () => {
    await api('POST', `/api/sites/${SITE}/routes`, { name: 'paid', config: { url: 'https://data.upstream-api.com/v1/rate', params: { from: 'string' }, query: { from: 'from' } }, priceUsd: '0.002' })
  })
  const publish = async () => {
    const p = (await api('GET', `/api/sites/${SITE}/manifest`)).body
    const site = await t.prisma.site.findUniqueOrThrow({ where: { name: SITE } })
    t.chain.manifests.set(site.container, p.sha256)
    return p.sha256 as string
  }

  it('is not-ready until there is something publishable', async () => {
    const s = await status()
    expect(s.state).toBe('not-ready')
    expect(s.expected).toBeNull()
    expect(s.problems.join(' ')).toContain('DELEGATION_REQUIRED')
  })

  it('walks through not-published, current and out-of-date as the owner publishes and then changes things', async () => {
    await delegate(t, token, holder, SITE)
    expect(await status()).toMatchObject({ state: 'not-published', onChain: null })

    const hash = await publish() // the owner published exactly what we built
    expect(await status()).toMatchObject({ state: 'current', expected: { sha256: hash }, onChain: { sha256: hash } })

    await api('PATCH', `/api/sites/${SITE}/routes/paid`, { priceUsd: '0.05' }) // a price changes
    const afterPrice = await status()
    expect(afterPrice.state).toBe('out-of-date')
    expect(afterPrice.onChain.sha256).toBe(hash)
    expect(afterPrice.expected.sha256).not.toBe(hash)

    await publish()
    expect((await status()).state).toBe('current')

    await delegate(t, token, holder, SITE, 60) // renewing the delegation changes the manifest too
    expect((await status()).state).toBe('out-of-date')
  })

  it('treats a manifest published by hand (other bytes) as out of date, and a chain outage as 503', async () => {
    await delegate(t, token, holder, SITE)
    const site = await t.prisma.site.findUniqueOrThrow({ where: { name: SITE } })
    t.chain.manifests.set(site.container, '0x' + 'ee'.repeat(32))
    expect((await status()).state).toBe('out-of-date')
    t.chain.down = true
    expect((await api('GET', `/api/sites/${SITE}/manifest/status`)).status).toBe(503)
  })

  it('is for the owner only', async () => {
    const other = await t.api.signIn(newWallet())
    expect((await api('GET', `/api/sites/${SITE}/manifest/status`, undefined, other)).status).toBe(404)
  })
})
