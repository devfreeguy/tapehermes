import { createHash } from 'node:crypto'
import { validateManifest } from '@tapeapi/sdk'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { delegate, fakeUpstream, newWallet, resetState, signDelegation, startTestApp, type TestApp } from './helpers/app.js'

let t: TestApp
let holder: ReturnType<typeof newWallet>
let token: string
const SITE = '1.2.396.tape'
const SITE_REGISTRY = '0xd6efb7adcc9c83dc4924ad56f6a8e4e969b9adb6'
const fx = { url: 'https://data.upstream-api.com/v1/rate', params: { from: 'string' }, query: { from: 'from' }, pick: { base: 'base' }, returns: { base: 'string' } }
const api = (m: string, p: string, body?: unknown, tk = token) => t.api.call(m, p, { token: tk, body })
const message = (days?: number) => api('GET', `/api/sites/${SITE}/delegation/message${days === undefined ? '' : `?days=${days}`}`)

beforeAll(async () => { t = await startTestApp() })
afterAll(async () => { await t.stop() })
beforeEach(async () => {
  await resetState(t.prisma, t.redis); t.cache.clear(); t.chain.sites.clear(); t.chain.down = false
  t.setHosted(fakeUpstream())
  holder = newWallet(); t.chain.set(SITE, holder.address)
  token = await t.api.signIn(holder)
  await api('POST', '/api/sites', { name: SITE })
  await api('POST', `/api/sites/${SITE}/routes`, { name: 'paid', config: fx, priceUsd: '0.002' })
  await api('POST', `/api/sites/${SITE}/routes`, { name: 'free', config: fx })
})

describe('B1: the message to sign', () => {
  it('is the exact EIP-712 Delegation for this container and signer, 30 days by default', async () => {
    const r = await message()
    expect(r.status).toBe(200)
    const site = await t.prisma.site.findUniqueOrThrow({ where: { name: SITE } })
    const { typedData, expires, days } = r.body
    expect(days).toBe(30)
    expect(typedData.primaryType).toBe('Delegation')
    expect(typedData.domain).toMatchObject({ name: 'TapeAPI', version: '1', chainId: 196 })
    expect(typedData.domain.verifyingContract).toMatch(/^0x[0-9a-fA-F]{40}$/)
    expect(typedData.message.container.toLowerCase()).toBe(site.container)
    expect(typedData.message.signer.toLowerCase()).toBe(site.signerAddress)
    expect(typedData.message.expires).toBe(expires)
    expect(typedData.types.EIP712Domain).toBeTruthy() // wallets need it for eth_signTypedData_v4
    const secs = expires - Math.floor(Date.now() / 1000)
    expect(secs).toBeGreaterThan(29 * 86400)
    expect(secs).toBeLessThanOrEqual(30 * 86400)
  })

  it('accepts 1 to 366 days and refuses anything else', async () => {
    for (const d of [1, 7, 366]) expect((await message(d)).status).toBe(200)
    for (const d of [0, 367, -3, 1000]) expect((await message(d)).status).toBe(400)
    expect((await message('abc' as never)).status).toBe(400)
  })

  it('is for the owner only', async () => {
    const other = await t.api.signIn(newWallet())
    expect((await api('GET', `/api/sites/${SITE}/delegation/message`, undefined, other)).status).toBe(404)
  })
})

describe('B2: the signature check', () => {
  it('stores a signature that recovers to the current on-chain holder', async () => {
    const r = await delegate(t, token, holder, SITE)
    expect(r.status).toBe(200)
    const row = await t.prisma.site.findUniqueOrThrow({ where: { name: SITE } })
    expect(row.delegationSig).toMatch(/^0x[0-9a-f]{130}$/)
    expect(row.delegationExpires!.getTime()).toBeGreaterThan(Date.now())
  })

  it('refuses a signature from another wallet, and stores nothing', async () => {
    const r = await delegate(t, token, newWallet(), SITE)
    expect(r.status).toBe(400)
    expect(r.body.code).toBe('DELEGATION_SIGNATURE_MISMATCH')
    expect((await t.prisma.site.findUniqueOrThrow({ where: { name: SITE } })).delegationSig).toBeNull()
  })

  it('refuses a good signature presented with a different expiry', async () => {
    const m = (await message(30)).body
    const signature = await signDelegation(holder, m)
    const r = await api('PUT', `/api/sites/${SITE}/delegation`, { signature, expires: m.expires + 86400 })
    expect(r.status).toBe(400)
    expect(r.body.code).toBe('DELEGATION_SIGNATURE_MISMATCH')
  })

  it('refuses a holder signature made for a different site (container and signer differ)', async () => {
    const other = '1.2.397.tape'
    t.chain.set(other, holder.address)
    await api('POST', '/api/sites', { name: other })
    const m2 = (await api('GET', `/api/sites/${other}/delegation/message`)).body
    const signature = await signDelegation(holder, m2)
    const r = await api('PUT', `/api/sites/${SITE}/delegation`, { signature, expires: m2.expires })
    expect(r.status).toBe(400)
  })

  it('refuses malformed signatures, past expiries and expiries beyond 366 days', async () => {
    const m = (await message()).body
    expect((await api('PUT', `/api/sites/${SITE}/delegation`, { signature: '0x1234', expires: m.expires })).status).toBe(400)
    const sig = await signDelegation(holder, m)
    expect((await api('PUT', `/api/sites/${SITE}/delegation`, { signature: sig, expires: Math.floor(Date.now() / 1000) - 10 })).status).toBe(400)
    expect((await api('PUT', `/api/sites/${SITE}/delegation`, { signature: sig, expires: Math.floor(Date.now() / 1000) + 400 * 86400 })).status).toBe(400)
  })

  it('refuses when the wallet is no longer the holder, even with a valid signature', async () => {
    const m = (await message()).body
    const signature = await signDelegation(holder, m)
    t.chain.set(SITE, newWallet().address)
    expect((await api('PUT', `/api/sites/${SITE}/delegation`, { signature, expires: m.expires })).status).toBe(403)
  })
})

describe('B3: expiry status', () => {
  const status = async () => (await api('GET', `/api/sites/${SITE}`)).body.delegation
  it('is none, then valid, then expiring at 7 days, then expired', async () => {
    expect(await status()).toMatchObject({ stored: false, status: 'none', expiresAt: null, daysLeft: null })
    await delegate(t, token, holder, SITE, 30)
    expect(await status()).toMatchObject({ stored: true, status: 'valid' })
    expect((await status()).daysLeft).toBeGreaterThanOrEqual(29)
    await delegate(t, token, holder, SITE, 8)
    expect((await status()).status).toBe('valid')
    await delegate(t, token, holder, SITE, 7)
    expect(await status()).toMatchObject({ status: 'expiring' })
    await t.prisma.site.update({ where: { name: SITE }, data: { delegationExpires: new Date(Date.now() - 1000) } })
    expect(await status()).toMatchObject({ status: 'expired', daysLeft: 0 })
  })
})

describe('C1: the manifest built from routes and delegation', () => {
  it('without a delegation it shows what is missing and is not publishable', async () => {
    const r = await api('GET', `/api/sites/${SITE}/manifest`)
    expect(r.status).toBe(200)
    expect(r.body.publishable).toBe(false)
    expect(r.body.problems.join(' ')).toContain('DELEGATION_REQUIRED')
    expect(r.body.manifest.delegation).toBeNull()
  })

  it('with a delegation it is a valid TAP-11 manifest a live client accepts, with prices in the tapehermes member', async () => {
    await delegate(t, token, holder, SITE)
    const r = await api('GET', `/api/sites/${SITE}/manifest`)
    expect(r.body.publishable).toBe(true)
    const m = r.body.manifest
    const site = await t.prisma.site.findUniqueOrThrow({ where: { name: SITE } })
    expect(m.signer).toBe(site.signerAddress)
    expect(m.container).toBe(site.container)
    expect(m.dev).toBeUndefined()
    expect(m.delegation.expires).toBe(Math.floor(site.delegationExpires!.getTime() / 1000))
    expect(m.delegation.sig).toBe(site.delegationSig)
    expect(m.methods.map((x: any) => [x.name, x.priceBEM])).toEqual([['free', '0'], ['paid', '0']]) // every route free in priceBEM
    expect(m.payment.escrow).toBeUndefined()
    expect(m.tapehermes).toEqual({ v: 1, currency: 'USD', x402: { network: 'eip155:1952' }, price: { free: '0', paid: '0.002' } })
    expect(JSON.stringify(m)).not.toMatch(/"payTo"/)
    // the same validator the SDK uses for a live (non-dev) resolution, delegation required
    expect(() => validateManifest(JSON.parse(JSON.stringify(m)), { requireDelegation: true })).not.toThrow()
    expect(r.body.size).toBe(Buffer.byteLength(JSON.stringify(m)))
    expect(r.body.sha256).toBe(`0x${createHash('sha256').update(JSON.stringify(m)).digest('hex')}`)
  })

  it('follows route changes: price, disabled route, new route', async () => {
    await delegate(t, token, holder, SITE)
    await api('PATCH', `/api/sites/${SITE}/routes/paid`, { priceUsd: '0.05' })
    await api('PATCH', `/api/sites/${SITE}/routes/free`, { enabled: false })
    const m = (await api('GET', `/api/sites/${SITE}/manifest`)).body.manifest
    expect(m.methods.map((x: any) => x.name)).toEqual(['paid'])
    expect(m.tapehermes.price).toEqual({ paid: '0.05' })
  })

  it('an expired delegation makes it unpublishable', async () => {
    await delegate(t, token, holder, SITE)
    await t.prisma.site.update({ where: { name: SITE }, data: { delegationExpires: new Date(Date.now() - 1000) } })
    const r = await api('GET', `/api/sites/${SITE}/manifest`)
    expect(r.body.publishable).toBe(false)
    expect(r.body.problems.join(' ')).toContain('DELEGATION_EXPIRED')
  })
})

describe('C3: the unsigned publish transaction', () => {
  it('is refused until the site is publishable', async () => {
    const r = await api('POST', `/api/sites/${SITE}/manifest/publish-tx`)
    expect(r.status).toBe(409)
    expect(r.body.code).toBe('NOT_PUBLISHABLE')
  })

  it('returns unsigned transactions to the SiteRegistry for the holder wallet, and sends nothing', async () => {
    await delegate(t, token, holder, SITE)
    const r = await api('POST', `/api/sites/${SITE}/manifest/publish-tx`)
    expect(r.status).toBe(200)
    expect(r.body.from).toBe(holder.address.toLowerCase())
    expect(r.body.chainId).toBe(196)
    expect(r.body.key).toBe('.well-known/tapeapi.json')
    expect(r.body.txs.length).toBeGreaterThanOrEqual(1)
    for (const tx of r.body.txs) {
      expect(tx.to.toLowerCase()).toBe(SITE_REGISTRY)
      expect(tx.data).toMatch(/^0x[0-9a-f]+$/)
    }
    const preview = (await api('GET', `/api/sites/${SITE}/manifest`)).body
    expect(r.body.size).toBe(preview.size)
    expect(r.body.sha256Hash).toBe(preview.sha256)
    expect(r.body.note).toContain('Nothing has been sent')
  })

  it('refuses when the wallet is no longer the holder, or the stored delegation is not from the holder', async () => {
    await delegate(t, token, holder, SITE)
    t.chain.set(SITE, newWallet().address)
    expect((await api('POST', `/api/sites/${SITE}/manifest/publish-tx`)).status).toBe(403)
  })

  it('answers 503 when the chain cannot be read', async () => {
    await delegate(t, token, holder, SITE)
    t.chain.down = true
    expect((await api('POST', `/api/sites/${SITE}/manifest/publish-tx`)).status).toBe(503)
  })

  it('is for the owner only', async () => {
    await delegate(t, token, holder, SITE)
    const other = await t.api.signIn(newWallet())
    expect((await api('POST', `/api/sites/${SITE}/manifest/publish-tx`, undefined, other)).status).toBe(404)
  })
})

describe('the served manifest and the enforced path (dev switch off)', () => {
  it('dev mode serves the tapehermes member too (flagged dev, delegation not enforced)', async () => {
    const m = await (await fetch(`${t.base}/sites/${SITE}/.well-known/tapeapi.json`)).json() as any
    expect(m.dev).toBe(true)
    expect(m.tapehermes.currency).toBe('USD')
    expect(m.tapehermes.price.paid).toBe('0.002')
  })

  it('with the switch off a site answers nothing without a delegation, and serves a real one once signed', async () => {
    const strict = await startTestApp({ devSkipDelegation: false })
    try {
      strict.setHosted(fakeUpstream())
      const w = newWallet(); strict.chain.set(SITE, w.address)
      const tk = await strict.api.signIn(w)
      await strict.api.call('POST', '/api/sites', { token: tk, body: { name: SITE } })
      await strict.api.call('POST', `/api/sites/${SITE}/routes`, { token: tk, body: { name: 'free', config: fx } })
      const call = () => fetch(`${strict.base}/sites/${SITE}/tapeapi/v1/free`, { method: 'POST', body: JSON.stringify({ id: String(Math.random()), params: { from: 'USD' } }) })
      const none = await call()
      expect(none.status).toBe(503)
      expect(((await none.json()) as any).error.code).toBe('DELEGATION_REQUIRED')

      expect((await delegate(strict, tk, w, SITE)).status).toBe(200)
      const ok = await call()
      expect(ok.status).toBe(200)
      const manifest = await (await fetch(`${strict.base}/sites/${SITE}/.well-known/tapeapi.json`)).json() as any
      expect(manifest.dev).toBeUndefined()
      expect(manifest.delegation.sig).toMatch(/^0x/)
      expect(() => validateManifest(manifest, { requireDelegation: true })).not.toThrow()

      await strict.prisma.site.update({ where: { name: SITE }, data: { delegationExpires: new Date(Date.now() - 1000) } })
      strict.cache.clear()
      const expired = await call()
      expect(expired.status).toBe(503)
      expect(((await expired.json()) as any).error.code).toBe('DELEGATION_EXPIRED')
    } finally { await strict.stop() }
  })
})
