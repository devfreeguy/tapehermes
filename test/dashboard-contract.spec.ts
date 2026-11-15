// @ts-nocheck
// Contract test: the DASHBOARD's own code (API client, zod schemas, plain-words errors, wallet converters) against the REAL backend.
// It is the proof that what the pages parse is what the server sends, and that a wallet signature made from the
// dashboard's converted typed data is accepted by the backend. Excluded from the backend type check (it imports dashboard code).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { explainError } from '../dashboard/copy/errors'
import { createApiClient } from '../dashboard/lib/api/client'
import { ApiError } from '../dashboard/lib/api/errors'
import { toSendParams } from '../dashboard/lib/wallet/tx'
import { toSignableTypedData } from '../dashboard/lib/wallet/typed-data'
import { fakeUpstream, newWallet, resetState, startTestApp, type TestApp } from './helpers/app.js'

const SITE = '1.2.396.tape'
let t: TestApp
let owner: ReturnType<typeof newWallet>
let token: string | null
let api: ReturnType<typeof createApiClient>

beforeAll(async () => { t = await startTestApp({ corsOrigins: ['http://localhost:3001'], siteCallsPerMin: 1000 }) })
afterAll(async () => { await t.stop() })
beforeEach(async () => {
  await resetState(t.prisma, t.redis); t.cache.clear(); t.chain.sites.clear(); t.chain.manifests.clear(); t.chain.down = false
  t.setHosted(fakeUpstream({ base: 'USD', rates: { EUR: 0.9 } }))
  owner = newWallet(); token = null
  t.chain.set(SITE, owner.address)
  api = createApiClient({ baseUrl: t.base, getToken: () => token })
})

/** Exactly what the dashboard's sign-in hook does with the wallet. */
async function signIn() {
  const { message } = await api.auth.message(owner.address)
  const s = await api.auth.verify(message, await owner.signMessage({ message }))
  token = s.token
  return s
}

describe('dashboard code against the real backend', () => {
  it('signs in the way the dashboard does, and the session works', async () => {
    const s = await signIn()
    expect(s.wallet).toBe(owner.address.toLowerCase())
    expect((await api.auth.me()).wallet).toBe(owner.address.toLowerCase())
    await api.auth.logout()
    await expect(api.auth.me()).rejects.toMatchObject({ status: 401 })
  })

  it('goes from sign-in to a publishable manifest: register, secret, route, delegation signed with the converted typed data, status, publish transactions', async () => {
    await signIn()
    const registered = await api.sites.register(SITE)
    expect(registered).toMatchObject({ created: true, takeover: false })
    expect((await api.sites.list()).map((s) => s.name)).toEqual([SITE])

    await api.secrets.put(SITE, 'UP_KEY', 'sk-contract-value')
    expect(await api.secrets.list(SITE)).toEqual([expect.objectContaining({ name: 'UP_KEY' })])
    expect(JSON.stringify(await api.secrets.list(SITE))).not.toContain('sk-contract-value')

    await api.routes.create(SITE, {
      name: 'ai', priceUsd: '0.01', enabled: true, rateLimitPerMin: 30,
      config: {
        url: 'https://api.llm-provider.com/v1/respond', method: 'POST', params: { input: 'string' }, required: ['input'],
        body: { model: 'model', input: 'input', max_output_tokens: 'max_output_tokens' }, headers: { authorization: 'Bearer ${UP_KEY}' },
        locked: { model: 'small-1', max_output_tokens: 60 }, limits: { input: { maxLength: 100 } }, pick: { base: 'base' },
      },
    })
    expect((await api.routes.list(SITE))[0]).toMatchObject({ name: 'ai', priceUsd: '0.01' })

    // not publishable until the holder signs
    expect(await api.manifest.status(SITE)).toMatchObject({ state: 'not-ready', expected: null })
    expect((await api.manifest.preview(SITE)).publishable).toBe(false)

    // the delegation: message from the server, converted by the dashboard, signed by a real wallet, accepted by the server
    const m = await api.sites.delegationMessage(SITE, 30)
    const signable = toSignableTypedData(m.typedData)
    const signature = await owner.signTypedData(signable)
    const saved = await api.sites.saveDelegation(SITE, signature, m.expires)
    expect(saved.delegation).toMatchObject({ stored: true, status: 'valid' })

    const preview = await api.manifest.preview(SITE)
    expect(preview).toMatchObject({ publishable: true, problems: [] })
    expect(preview.manifest.tapehermes).toMatchObject({ currency: 'USD', price: { ai: '0.01' } })
    expect(JSON.stringify(preview.manifest)).not.toContain('small-1') // locked values are the owner's, not published

    expect(await api.manifest.status(SITE)).toMatchObject({ state: 'not-published', onChain: null })
    const tx = await api.manifest.publishTx(SITE)
    expect(tx.from).toBe(owner.address.toLowerCase())
    for (const x of tx.txs) {
      const p = toSendParams(x)
      expect(p.to.toLowerCase()).toBe('0xd6efb7adcc9c83dc4924ad56f6a8e4e969b9adb6') // the SiteRegistry on X Layer
      expect(p.value).toBe(0n)
      expect(p.data.startsWith('0x')).toBe(true)
    }

    // the owner "publishes": the chain now holds exactly what we built
    const site = await t.prisma.site.findUniqueOrThrow({ where: { name: SITE } })
    t.chain.manifests.set(site.container, tx.sha256Hash)
    expect(await api.manifest.status(SITE)).toMatchObject({ state: 'current' })

    // a price changes after publishing: the dashboard must show out of date
    await api.routes.update(SITE, 'ai', { priceUsd: '0.05' })
    expect((await api.manifest.status(SITE)).state).toBe('out-of-date')
  })

  it('renames a secret and the route that used it follows', async () => {
    await signIn(); await api.sites.register(SITE)
    await api.secrets.put(SITE, 'UP_KEY', 'v')
    await api.routes.create(SITE, { name: 'fx', priceUsd: '0', enabled: true, rateLimitPerMin: 60, config: { url: 'https://data.upstream-api.com/v1/rate', headers: { 'x-api-key': '${UP_KEY}' } } })
    await api.secrets.rename(SITE, 'UP_KEY', 'RATES_KEY')
    expect((await api.routes.list(SITE))[0].config.headers).toEqual({ 'x-api-key': '${RATES_KEY}' })
    await expect(api.secrets.remove(SITE, 'RATES_KEY')).rejects.toMatchObject({ code: 'SECRET_IN_USE', details: { routes: ['fx'] } })
  })

  it('shows the call log and summary through the same schemas', async () => {
    await signIn(); await api.sites.register(SITE)
    await api.routes.create(SITE, { name: 'fx', priceUsd: '0', enabled: true, rateLimitPerMin: 60, config: { url: 'https://data.upstream-api.com/v1/rate' } })
    await fetch(`${t.base}/sites/${SITE}/tapeapi/v1/fx`, { method: 'POST', body: JSON.stringify({ id: 'c1', params: {} }) })
    await new Promise((r) => setTimeout(r, 250))
    const rows = await api.logs.list(SITE, { route: 'fx' })
    expect(rows[0]).toMatchObject({ routeName: 'fx', result: 'OK', paid: false })
    const sum = await api.logs.summary(SITE, 7)
    expect(sum.routes.fx).toMatchObject({ calls: 1, OK: 1 })
    expect(sum.totals.calls).toBe(1)
  })

  it('turns the real refusals into plain words', async () => {
    await signIn(); await api.sites.register(SITE)
    const base = { name: 'x', priceUsd: '0', enabled: true, rateLimitPerMin: 60 }
    const refuse = (config) => api.routes.create(SITE, { ...base, config }).catch((e) => e)
    const cases = [
      [{ url: 'http://data.upstream-api.com/x' }, 'must start with https://'],
      [{ url: 'https://data.upstream-api.com:8443/x' }, 'Remove the port number'],
      [{ url: 'https://10.0.0.1/x' }, 'not an IP address'],
      [{ url: 'https://data.upstream-api.com/x', headers: { cookie: 'a=b' } }, 'The header "cookie" is not allowed'],
      [{ url: 'https://data.upstream-api.com/x', headers: { authorization: '${MISSING}' } }, 'A secret is missing'],
      [{ url: 'https://data.upstream-api.com/${KEY}' }, 'Secrets go in headers only'],
      [{ url: 'https://data.upstream-api.com/x', body: { a: 'a' }, method: 'POST', params: { a: 'string' }, locked: { color: 'red' } }, 'locked setting "color"'],
    ]
    for (const [config, words] of cases) {
      const e = await refuse(config)
      expect(e).toBeInstanceOf(ApiError)
      const plain = explainError(e)
      expect(plain.title + ' ' + plain.message, JSON.stringify(config)).toContain(words)
      expect(plain.message).not.toMatch(/upstream https?:|adapter /) // the raw adapter wording stays in the details fold
    }
  })

  it('maps wrong-holder and bad-delegation answers, and an expired session', async () => {
    await signIn(); await api.sites.register(SITE)
    const m = await api.sites.delegationMessage(SITE, 30)
    const stranger = newWallet()
    const bad = await api.sites.saveDelegation(SITE, await stranger.signTypedData(toSignableTypedData(m.typedData)), m.expires).catch((e) => e)
    expect(explainError(bad).title).toBe('The signature is not from the holder')
    t.chain.set(SITE, newWallet().address) // the site was sold
    const moved = await api.sites.saveDelegation(SITE, await owner.signTypedData(toSignableTypedData(m.typedData)), m.expires).catch((e) => e)
    expect(explainError(moved).title).toBe('This wallet is not the holder')
    token = 'not-a-real-token'
    expect(explainError(await api.sites.list().catch((e) => e)).title).toBe('Please sign in again')
  })

  it('is reachable from the dashboard origin and from no other (browser CORS)', async () => {
    const ok = await fetch(`${t.base}/api/auth/me`, { headers: { origin: 'http://localhost:3001' } })
    expect(ok.headers.get('access-control-allow-origin')).toBe('http://localhost:3001')
    const no = await fetch(`${t.base}/api/auth/me`, { headers: { origin: 'https://evil.example.org' } })
    expect(no.headers.get('access-control-allow-origin')).toBeNull()
  })
})
