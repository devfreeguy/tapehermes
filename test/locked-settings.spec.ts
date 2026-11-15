import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildSiteManifest } from '../src/manifest/manifest-builder.js'
import { callerParams, declaredParams, lockedProblems } from '../src/worker/locked-settings.js'
import { hostedMethods } from '../src/worker/hosted-methods.js'
import { fakeUpstream, newWallet, resetState, startTestApp, type TestApp } from './helpers/app.js'
import { attachFacilitator } from './helpers/x402.js'
import { buyerFetch } from '../src/payments/buyer-fetch.js'

// An AI-style text call: the owner fixes the model, the instructions and the output cap; the visitor sends one short input.
const ai = {
  url: 'https://api.llm-provider.com/v1/respond', method: 'POST',
  params: { input: 'string' }, required: ['input'],
  body: { model: 'model', instructions: 'instructions', max_output_tokens: 'max_output_tokens', input: 'input' },
  headers: { authorization: 'Bearer ${LLM_KEY}' },
  locked: { model: 'small-model-1', instructions: 'Answer in one short sentence.', max_output_tokens: 60 },
  limits: { input: { maxLength: 40 } },
  pick: { text: 'text' }, returns: { text: 'string' },
}
const build = (method: object, secrets: Record<string, string> = { LLM_KEY: 'k-secret' }) => {
  const up = fakeUpstream({ text: 'ok' })
  const { handlers } = hostedMethods({ methods: { ai: method } }, secrets, up)
  return { call: handlers.ai as (p: unknown) => Promise<any>, up }
}
const sent = (up: ReturnType<typeof fakeUpstream>) => JSON.parse(up.hits[0].body!)

describe('locked settings (unit, in our layer before the adapter)', () => {
  it('a locked value is always sent, in the body, with the caller input beside it', async () => {
    const { call, up } = build(ai)
    await call({ input: 'hello' })
    expect(sent(up)).toEqual({ model: 'small-model-1', instructions: 'Answer in one short sentence.', max_output_tokens: 60, input: 'hello' })
    expect(up.hits[0].headers.authorization).toBe('Bearer k-secret')
  })

  it('a caller who tries to set a locked value is refused with zero outside calls, for every locked name', async () => {
    const { call, up } = build(ai)
    for (const k of ['model', 'instructions', 'max_output_tokens']) {
      await expect(call({ input: 'hi', [k]: 'x' })).rejects.toMatchObject({ code: 'BAD_REQUEST', message: expect.stringContaining('fixed by the site owner') })
    }
    // even when the caller sends exactly the locked value, or a falsy one
    await expect(call({ input: 'hi', model: 'small-model-1' })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await expect(call({ input: 'hi', max_output_tokens: 0 })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await expect(call({ input: 'hi', max_output_tokens: null })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    expect(up.hits).toHaveLength(0)
  })

  it('cannot be bypassed through odd keys such as __proto__ or a prototype-shaped body', async () => {
    const { call, up } = build(ai)
    await call(JSON.parse('{"input":"hi","__proto__":{"model":"evil"}}')).catch(() => undefined)
    if (up.hits.length) expect(sent(up).model).toBe('small-model-1')
  })

  it('unlocked parameters still work, and a defaulted unlocked parameter may still be overridden', async () => {
    const { call, up } = build({ ...ai, defaults: { temperature: 0.2 }, body: { ...ai.body, temperature: 'temperature' } })
    await call({ input: 'one' })
    expect(sent(up).temperature).toBe(0.2)
    await call({ input: 'two', temperature: 0.9 })
    expect(JSON.parse(up.hits[1].body!).temperature).toBe(0.9)
    expect(up.hits).toHaveLength(2)
  })

  it('a text limit is enforced before the outside call', async () => {
    const { call, up } = build(ai)
    await expect(call({ input: 'x'.repeat(41) })).rejects.toMatchObject({ code: 'BAD_REQUEST', message: expect.stringContaining('too long') })
    await expect(call({ input: 12345 })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    expect(up.hits).toHaveLength(0)
    await call({ input: 'x'.repeat(40) })
    expect(up.hits).toHaveLength(1)
  })

  it('works in the url too: a locked query value and a locked path segment', async () => {
    const q = build({ url: 'https://api.data-provider.com/v1/{kind}/list', params: { term: 'string' }, query: { term: 'term', limit: 'limit' }, locked: { limit: 5, kind: 'food' } })
    await q.call({ term: 'cheddar' })
    expect(q.up.hits[0].url).toBe('https://api.data-provider.com/v1/food/list?term=cheddar&limit=5')
    await expect(q.call({ term: 'x', limit: 500 })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await expect(q.call({ term: 'x', kind: '../admin' })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    expect(q.up.hits).toHaveLength(1)
  })

  it('sends a nested JSON value intact', async () => {
    const m = { url: 'https://api.llm-provider.com/v1/x', method: 'POST', params: { q: 'string' }, body: { q: 'q', opts: 'opts' }, locked: { opts: { deep: [1, { a: true }] } } }
    const { call, up } = build(m)
    await call({ q: 'z' })
    expect(sent(up).opts).toEqual({ deep: [1, { a: true }] })
  })

  it('the manifest does not advertise locked parameters', () => {
    const manifest = buildSiteManifest({
      site: { name: '1.2.3.tape', circuits: '0x' + '11'.repeat(20), tokenId: '1', container: '0x' + '22'.repeat(20), signerAddress: '0x' + '33'.repeat(20) },
      routes: [{ name: 'ai', config: { ...ai, params: undefined }, priceUsd: '0.01', enabled: true }],
      delegation: null, network: 'eip155:1952', publicBaseUrl: 'https://api.x.test', dev: true,
    })
    expect(Object.keys(manifest.methods[0].params)).toEqual(['input'])
    expect(JSON.stringify(manifest)).not.toContain('Answer in one short sentence')
  })

  it('callerParams lists only what a caller may send', () => {
    expect(callerParams(ai as never).sort()).toEqual(['input'])
    expect([...declaredParams(ai as never)].sort()).toEqual(['input', 'instructions', 'max_output_tokens', 'model'])
  })
})

describe('locked settings: save-time checks', () => {
  const problems = (m: object) => lockedProblems(m as never)
  it('accepts the good shape', () => { expect(problems(ai)).toEqual([]) })
  it('refuses a locked value that nothing sends', () => {
    expect(problems({ ...ai, locked: { ...ai.locked, color: 'red' } })[0]).toContain('"color"')
  })
  it('refuses a locked name that is also a default or a limit', () => {
    expect(problems({ ...ai, defaults: { model: 'x' } }).join(' ')).toContain('both locked and a default')
    expect(problems({ ...ai, limits: { ...ai.limits, model: { maxLength: 5 } } }).join(' ')).toContain('both locked and limited')
  })
  it('refuses a non-text value that goes into the url, and a body "*" without params', () => {
    expect(problems({ url: 'https://a.test/x', query: { n: 'n' }, locked: { n: { a: 1 } } })[0]).toContain('must be a text, number')
    expect(problems({ url: 'https://a.test/x', method: 'POST', body: '*', params: { a: 'string' }, locked: { b: 1 } }).join(' ')).toContain('listed in params')
  })
  it('refuses a limit on a parameter the route does not have', () => {
    expect(problems({ ...ai, limits: { nope: { maxLength: 3 } } })[0]).toContain('no such parameter')
  })
})

describe('locked settings through the whole pipeline', () => {
  let t: TestApp
  let token: string
  let up: ReturnType<typeof fakeUpstream>
  let fac: ReturnType<typeof attachFacilitator>
  const SITE = '1.2.396.tape'
  const buyer = newWallet()
  const call = (route: string, params: object) => fetch(`${t.base}/sites/${SITE}/tapeapi/v1/${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: `l-${Math.random()}`, params }) })
  const pay = (route: string, params: object) => buyerFetch(buyer)(`${t.base}/sites/${SITE}/tapeapi/v1/${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: `l-${Math.random()}`, params }) })

  beforeAll(async () => { t = await startTestApp({ siteCallsPerMin: 1000 }) })
  afterAll(async () => { await t.stop() })
  beforeEach(async () => {
    await resetState(t.prisma, t.redis); t.cache.clear(); t.chain.sites.clear()
    up = fakeUpstream({ text: 'a short answer' }); t.setHosted(up); fac = attachFacilitator(t)
    const w = newWallet(); t.chain.set(SITE, w.address)
    token = await t.api.signIn(w)
    await t.api.call('POST', '/api/sites', { token, body: { name: SITE } })
    await t.api.call('PUT', `/api/sites/${SITE}/secrets/LLM_KEY`, { token, body: { value: 'sk-never-shown' } })
  })
  const addRoute = (config: object, priceUsd = '0.01') => t.api.call('POST', `/api/sites/${SITE}/routes`, { token, body: { name: 'ai', config, priceUsd } })

  it('a locked value reaches the outside service on a paid call, the caller never sees it, and the call settles once', async () => {
    expect((await addRoute(ai)).status).toBe(201)
    const r = await pay('ai', { input: 'hello' })
    expect(r.status).toBe(200)
    const text = await r.text()
    expect(text).not.toContain('Answer in one short sentence')
    expect(sent(up)).toMatchObject({ model: 'small-model-1', max_output_tokens: 60, input: 'hello' })
    expect(fac.settleCalls).toBe(1)
    const manifest = await (await fetch(`${t.base}/sites/${SITE}/.well-known/tapeapi.json`)).json() as any
    expect(Object.keys(manifest.methods[0].params)).toEqual(['input'])
  })

  it('a caller override is refused with a signed 400, zero outside calls, and a paid visitor is NOT charged', async () => {
    await addRoute(ai)
    const r = await pay('ai', { input: 'hello', model: 'expensive-model' })
    expect(r.status).toBe(400)
    expect(up.hits).toHaveLength(0)
    expect(fac.settleCalls).toBe(0)
    const over = await pay('ai', { input: 'x'.repeat(100) })
    expect(over.status).toBe(400)
    expect([up.hits.length, fac.settleCalls]).toEqual([0, 0])
  })

  it('unlocked callers still work on the same route, and a free locked route works without payment', async () => {
    await addRoute(ai, '0')
    const r = await call('ai', { input: 'fine' })
    expect(r.status).toBe(200)
    expect(up.hits).toHaveLength(1)
  })

  it('the API refuses bad locked settings in plain words, and saves nothing', async () => {
    const bad = await addRoute({ ...ai, locked: { ...ai.locked, color: 'red' } })
    expect(bad.status).toBe(400)
    expect(bad.body.code).toBe('LOCKED_SETTING_INVALID')
    expect(bad.body.message).toContain('color')
    expect(await t.prisma.route.count()).toBe(0)
    const secret = await addRoute({ ...ai, locked: { ...ai.locked, instructions: 'use ${LLM_KEY}' } })
    expect(secret.status).toBe(400)
    expect(secret.body.code).toBe('SECRET_NOT_IN_HEADER')
  })

  it('changing a locked value on a saved route takes effect on the next call', async () => {
    await addRoute(ai, '0')
    await call('ai', { input: 'a' })
    await t.api.call('PATCH', `/api/sites/${SITE}/routes/ai`, { token, body: { config: { ...ai, locked: { ...ai.locked, max_output_tokens: 20 } } } })
    await call('ai', { input: 'b' })
    expect(JSON.parse(up.hits[1].body!).max_output_tokens).toBe(20)
  })
})
