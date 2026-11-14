import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { delegate, newWallet, resetState, startTestApp, fakeUpstream, type TestApp } from './helpers/app.js'

let t: TestApp
beforeAll(async () => { t = await startTestApp() })
afterAll(async () => { await t.stop() })
beforeEach(async () => { await resetState(t.prisma, t.redis); t.chain.down = false; t.chain.sites.clear(); t.cache.clear() })

const SITE = '1.2.396.tape'
const route = { name: 'fxRate', config: { url: 'https://data.upstream-api.com/v1/rate', params: { from: 'string' }, query: { from: 'from' }, headers: { 'x-api-key': '${UP_KEY}' } } }

describe('registering a site (ownership check)', () => {
  it('lets the current holder register, and defaults the payout address to the holder', async () => {
    const holder = newWallet(); t.chain.set(SITE, holder.address)
    const token = await t.api.signIn(holder)
    const r = await t.api.call('POST', '/api/sites', { token, body: { name: SITE } })
    expect(r.status).toBe(200)
    expect(r.body.created).toBe(true)
    expect(r.body.site.holder).toBe(holder.address.toLowerCase())
    expect(r.body.site.payoutAddress).toBe(holder.address.toLowerCase())
    expect(r.body.site.signer).toMatch(/^0x[0-9a-f]{40}$/)
    expect(r.text).not.toMatch(/signerKey|privateKey/i)
  })

  it('compares addresses in one normalized form (chain checksum case vs lowercase session)', async () => {
    const holder = newWallet(); t.chain.set(SITE, holder.address.toUpperCase().replace('0X', '0x'))
    const token = await t.api.signIn(holder)
    expect((await t.api.call('POST', '/api/sites', { token, body: { name: SITE } })).status).toBe(200)
  })

  it('refuses a wallet that is not the holder (403) and stores nothing', async () => {
    const holder = newWallet(), other = newWallet(); t.chain.set(SITE, holder.address)
    const token = await t.api.signIn(other)
    const r = await t.api.call('POST', '/api/sites', { token, body: { name: SITE } })
    expect(r.status).toBe(403)
    expect(r.body.code).toBe('NOT_HOLDER')
    expect(await t.prisma.site.count()).toBe(0)
  })

  it('answers a clean 404 for an unknown site, and for a malformed name', async () => {
    const token = await t.api.signIn(newWallet())
    for (const name of ['9.9.999.tape', 'not-a-site', '../etc/passwd']) {
      const r = await t.api.call('POST', '/api/sites', { token, body: { name } })
      expect(r.status).toBe(404)
      expect(r.body.code).toBe('SITE_NOT_FOUND')
    }
  })

  it('answers 503 (not a guess) when the chain cannot be read', async () => {
    const holder = newWallet(); t.chain.set(SITE, holder.address); t.chain.down = true
    const token = await t.api.signIn(holder)
    const r = await t.api.call('POST', '/api/sites', { token, body: { name: SITE } })
    expect(r.status).toBe(503)
    expect(await t.prisma.site.count()).toBe(0)
  })

  it('requires sign-in', async () => {
    expect((await t.api.call('POST', '/api/sites', { body: { name: SITE } })).status).toBe(401)
  })

  it('registering twice as the same owner is a no-op that keeps the same signer', async () => {
    const holder = newWallet(); t.chain.set(SITE, holder.address)
    const token = await t.api.signIn(holder)
    const a = await t.api.call('POST', '/api/sites', { token, body: { name: SITE } })
    const b = await t.api.call('POST', '/api/sites', { token, body: { name: SITE } })
    expect(b.body.created).toBe(false)
    expect(b.body.takeover).toBe(false)
    expect(b.body.site.signer).toBe(a.body.site.signer)
  })

  it('does not show a site to a wallet that does not own it', async () => {
    const holder = newWallet(); t.chain.set(SITE, holder.address)
    await t.api.call('POST', '/api/sites', { token: await t.api.signIn(holder), body: { name: SITE } })
    const other = await t.api.signIn(newWallet())
    expect((await t.api.call('GET', `/api/sites/${SITE}`, { token: other })).status).toBe(404)
    expect((await t.api.call('GET', '/api/sites', { token: other })).body).toEqual([])
  })
})

describe('takeover at registration', () => {
  it('reassigns the site to the new on-chain holder and deletes the old secrets, routes, logs and signer key', async () => {
    const alice = newWallet(), bob = newWallet(); t.chain.set(SITE, alice.address)
    const a = await t.api.signIn(alice)
    const first = await t.api.call('POST', '/api/sites', { token: a, body: { name: SITE } })
    expect((await t.api.call('PUT', `/api/sites/${SITE}/secrets/UP_KEY`, { token: a, body: { value: 'alice-secret' } })).status).toBe(200)
    expect((await t.api.call('POST', `/api/sites/${SITE}/routes`, { token: a, body: route })).status).toBe(201)
    const before = await t.prisma.site.findUniqueOrThrow({ where: { name: SITE } })
    await t.prisma.callLog.create({ data: { siteId: before.id, routeName: 'fxRate', result: 'OK', durationMs: 5 } })
    await t.api.call('PUT', `/api/sites/${SITE}/payout`, { token: a, body: { payoutAddress: alice.address } })

    // the NFT is sold: the chain now says Bob is the holder
    t.chain.set(SITE, bob.address)
    // Alice (no longer holder) cannot re-register
    expect((await t.api.call('POST', '/api/sites', { token: a, body: { name: SITE } })).status).toBe(403)

    const b = await t.api.signIn(bob)
    const r = await t.api.call('POST', '/api/sites', { token: b, body: { name: SITE } })
    expect(r.status).toBe(200)
    expect(r.body.takeover).toBe(true)

    const after = await t.prisma.site.findUniqueOrThrow({ where: { name: SITE }, include: { owner: true } })
    expect(after.owner.wallet).toBe(bob.address.toLowerCase())
    expect(after.holder).toBe(bob.address.toLowerCase())
    expect(after.payoutAddress).toBe(bob.address.toLowerCase())
    expect(after.signerAddress).not.toBe(first.body.site.signer)
    expect(after.signerKeyEnc).not.toBe(before.signerKeyEnc)
    expect(after.delegationSig).toBeNull()
    expect(await t.prisma.secret.count({ where: { siteId: after.id } })).toBe(0)
    expect(await t.prisma.route.count({ where: { siteId: after.id } })).toBe(0)
    expect(await t.prisma.callLog.count({ where: { siteId: after.id } })).toBe(0)

    // Alice lost all access; Bob sees an empty site
    expect((await t.api.call('GET', `/api/sites/${SITE}`, { token: a })).status).toBe(404)
    expect((await t.api.call('GET', `/api/sites/${SITE}/secrets`, { token: a })).status).toBe(404)
    expect((await t.api.call('GET', `/api/sites/${SITE}/secrets`, { token: b })).body).toEqual([])
    expect((await t.api.call('GET', `/api/sites/${SITE}/routes`, { token: b })).body).toEqual([])
  })

  it('evicts the old owner decrypted secrets from memory at once', async () => {
    const alice = newWallet(), bob = newWallet(); t.chain.set(SITE, alice.address)
    const a = await t.api.signIn(alice)
    await t.api.call('POST', '/api/sites', { token: a, body: { name: SITE } })
    await t.api.call('PUT', `/api/sites/${SITE}/secrets/UP_KEY`, { token: a, body: { value: 'alice-secret' } })
    await t.api.call('POST', `/api/sites/${SITE}/routes`, { token: a, body: route })
    t.setHosted(fakeUpstream())
    expect(await t.cache.get(SITE)).not.toBeNull()
    expect(t.cache.has(SITE)).toBe(true)
    t.chain.set(SITE, bob.address)
    await t.api.call('POST', '/api/sites', { token: await t.api.signIn(bob), body: { name: SITE } })
    expect(t.cache.has(SITE)).toBe(false)
  })
})

describe('delegation save re-checks the holder on chain', () => {
  const setup = async () => {
    const holder = newWallet(); t.chain.set(SITE, holder.address)
    const token = await t.api.signIn(holder)
    await t.api.call('POST', '/api/sites', { token, body: { name: SITE } })
    return { holder, token }
  }

  it('stores a delegation signed by the current holder', async () => {
    const { holder, token } = await setup()
    const r = await delegate(t, token, holder, SITE)
    expect(r.status).toBe(200)
    expect(r.body.delegation.stored).toBe(true)
  })

  it('refuses (403) and stores nothing when the chain says the wallet is no longer the holder', async () => {
    const { holder, token } = await setup()
    t.chain.set(SITE, newWallet().address)
    const r = await delegate(t, token, holder, SITE)
    expect(r.status).toBe(403)
    expect((await t.prisma.site.findUniqueOrThrow({ where: { name: SITE } })).delegationSig).toBeNull()
  })

  it('answers 503 when the chain cannot be read', async () => {
    const { holder, token } = await setup()
    t.chain.down = true
    expect((await delegate(t, token, holder, SITE)).status).toBe(503)
  })
})

describe('payout address', () => {
  it('is stored normalized and can be changed by the owner', async () => {
    const holder = newWallet(), payout = newWallet(); t.chain.set(SITE, holder.address)
    const token = await t.api.signIn(holder)
    await t.api.call('POST', '/api/sites', { token, body: { name: SITE } })
    const r = await t.api.call('PUT', `/api/sites/${SITE}/payout`, { token, body: { payoutAddress: payout.address } })
    expect(r.body.payoutAddress).toBe(payout.address.toLowerCase())
    expect((await t.api.call('PUT', `/api/sites/${SITE}/payout`, { token, body: { payoutAddress: '0x12' } })).status).toBe(400)
  })
})
