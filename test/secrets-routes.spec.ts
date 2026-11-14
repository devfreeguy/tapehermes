import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { newWallet, resetState, startTestApp, type TestApp } from './helpers/app.js'

let t: TestApp
let token: string
const SITE = '1.2.396.tape'
const VALUE = 'sk-live-super-secret-value-9f3a'
const base = { url: 'https://data.upstream-api.com/v1/rate', params: { from: 'string' }, query: { from: 'from' } }

beforeAll(async () => { t = await startTestApp() })
afterAll(async () => { await t.stop() })
beforeEach(async () => {
  await resetState(t.prisma, t.redis); t.cache.clear(); t.chain.sites.clear()
  const w = newWallet(); t.chain.set(SITE, w.address)
  token = await t.api.signIn(w)
  await t.api.call('POST', '/api/sites', { token, body: { name: SITE } })
})
const put = (name: string, value = VALUE) => t.api.call('PUT', `/api/sites/${SITE}/secrets/${name}`, { token, body: { value } })
const addRoute = (name: string, config: unknown, extra: Record<string, unknown> = {}) => t.api.call('POST', `/api/sites/${SITE}/routes`, { token, body: { name, config, ...extra } })

describe('secrets', () => {
  it('saves a value and never shows it again, in any response', async () => {
    const saved = await put('UP_KEY')
    expect(saved.status).toBe(200)
    const list = await t.api.call('GET', `/api/sites/${SITE}/secrets`, { token })
    const site = await t.api.call('GET', `/api/sites/${SITE}`, { token })
    for (const r of [saved, list, site]) expect(r.text).not.toContain(VALUE)
    expect(list.body).toEqual([expect.objectContaining({ name: 'UP_KEY' })])
    expect(Object.keys(list.body[0]).sort()).toEqual(['createdAt', 'name', 'updatedAt'])
  })

  it('stores only ciphertext in the database', async () => {
    await put('UP_KEY')
    const row = await t.prisma.secret.findFirstOrThrow()
    expect(row.valueEnc).not.toContain(VALUE)
    expect(row.valueEnc.startsWith('v1.')).toBe(true)
    expect(JSON.stringify(await t.prisma.$queryRawUnsafe('SELECT * FROM "Secret"'))).not.toContain(VALUE)
  })

  it('replaces a value (upsert) and refuses bad names and empty values', async () => {
    await put('UP_KEY', 'one'); await put('UP_KEY', 'two')
    expect(await t.prisma.secret.count()).toBe(1)
    expect((await put('lower-case')).status).toBe(400)
    expect((await put('UP_KEY', '')).status).toBe(400)
  })

  it('error replies for a bad secret do not echo the submitted value', async () => {
    const r = await t.api.call('PUT', `/api/sites/${SITE}/secrets/bad-name`, { token, body: { value: VALUE } })
    expect(r.status).toBe(400)
    expect(r.text).not.toContain(VALUE)
  })

  it('belongs to its site owner only', async () => {
    await put('UP_KEY')
    const other = await t.api.signIn(newWallet())
    expect((await t.api.call('GET', `/api/sites/${SITE}/secrets`, { token: other })).status).toBe(404)
    expect((await t.api.call('PUT', `/api/sites/${SITE}/secrets/X`, { token: other, body: { value: 'v' } })).status).toBe(404)
  })

  it('cannot be deleted while a route uses it', async () => {
    await put('UP_KEY')
    await addRoute('fxRate', { ...base, headers: { 'x-api-key': '${UP_KEY}' } })
    const r = await t.api.call('DELETE', `/api/sites/${SITE}/secrets/UP_KEY`, { token })
    expect(r.status).toBe(409)
    expect(r.body.code).toBe('SECRET_IN_USE')
    await t.api.call('DELETE', `/api/sites/${SITE}/routes/fxRate`, { token })
    expect((await t.api.call('DELETE', `/api/sites/${SITE}/secrets/UP_KEY`, { token })).status).toBe(204)
  })
})

describe('routes (settings only, header-only secrets)', () => {
  it('creates, lists, updates and deletes a valid route', async () => {
    await put('UP_KEY')
    const c = await addRoute('fxRate', { ...base, headers: { 'x-api-key': '${UP_KEY}' } }, { priceUsd: '0.002', rateLimitPerMin: 10 })
    expect(c.status).toBe(201)
    expect(c.body.priceUsd).toBe('0.002')
    expect((await t.api.call('GET', `/api/sites/${SITE}/routes`, { token })).body).toHaveLength(1)
    const u = await t.api.call('PATCH', `/api/sites/${SITE}/routes/fxRate`, { token, body: { enabled: false } })
    expect(u.body.enabled).toBe(false)
    expect((await t.api.call('DELETE', `/api/sites/${SITE}/routes/fxRate`, { token })).status).toBe(204)
  })

  it.each([
    ['http', { ...base, url: 'http://data.upstream-api.com/x' }],
    ['a non-443 port', { ...base, url: 'https://data.upstream-api.com:8443/x' }],
    ['an IP literal', { ...base, url: 'https://10.0.0.1/x' }],
    ['a disallowed header', { ...base, headers: { cookie: 'a=b' } }],
    ['a secret that does not exist', { ...base, headers: { 'x-api-key': '${NOT_SAVED}' } }],
    ['a secret in the URL', { ...base, url: 'https://data.upstream-api.com/${UP_KEY}' }],
    ['a secret in the query', { ...base, defaults: { from: '${UP_KEY}' } }],
    ['unknown settings (code is not a setting)', { ...base, script: 'return 1' }],
  ])('refuses %s', async (_n, config) => {
    await put('UP_KEY')
    const r = await addRoute('bad', config)
    expect(r.status).toBe(400)
    expect(await t.prisma.route.count()).toBe(0)
  })

  it('refuses a fourth upstream host across the whole site', async () => {
    for (const h of ['a', 'b', 'c']) expect((await addRoute(`r${h}`, { ...base, url: `https://${h}.upstream-api.com/x` })).status).toBe(201)
    expect((await addRoute('rd', { ...base, url: 'https://d.upstream-api.com/x' })).status).toBe(400)
  })

  it('refuses a duplicate name and a bad name', async () => {
    await addRoute('fxRate', base)
    expect((await addRoute('fxRate', base)).status).toBe(409)
    expect((await addRoute('bad name!', base)).status).toBe(400)
  })

  it('belongs to its site owner only', async () => {
    const other = await t.api.signIn(newWallet())
    expect((await t.api.call('POST', `/api/sites/${SITE}/routes`, { token: other, body: { name: 'x', config: base } })).status).toBe(404)
  })
})
