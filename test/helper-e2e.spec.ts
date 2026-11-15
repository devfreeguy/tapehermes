import { execSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { PrivateKeyAccount } from 'viem/accounts'
import { delegate, fakeUpstream, newWallet, resetState, startTestApp, type TestApp } from './helpers/app.js'
import { attachFacilitator, MOCK_TX } from './helpers/x402.js'

const SITE = '1.2.396.tape'
const RPC = 'https://rpc.helper-test.invalid/'
const fx = { url: 'https://data.upstream-api.com/v1/rate', params: { from: 'string' }, required: ['from'], query: { from: 'from' }, pick: { base: 'base', rates: 'rates' }, returns: { base: 'string', rates: 'object' } }
let H: { createHermes: (o?: any) => { call: (m: string, p?: object) => Promise<any>; manifest: () => Promise<any>; verify: (proof: any) => Promise<any> }; HermesError: new (...a: any[]) => Error & { code: string; details: any } }

/** An EIP-1193 wallet backed by a viem account: signs typed data like MetaMask would. Starts on X Layer MAINNET. */
function fakeWallet(account: PrivateKeyAccount, startChain = 196) {
  let chain = startChain
  const log: string[] = []
  return {
    log,
    request: async ({ method, params }: { method: string; params?: any[] }) => {
      log.push(method)
      if (method === 'eth_requestAccounts') return [account.address]
      if (method === 'eth_chainId') return '0x' + chain.toString(16)
      if (method === 'wallet_switchEthereumChain') { chain = parseInt(params![0].chainId, 16); return null }
      if (method === 'eth_signTypedData_v4') {
        const t = JSON.parse(params![1])
        const { EIP712Domain: _d, ...types } = t.types
        const m = t.message
        return account.signTypedData({ domain: t.domain, types, primaryType: t.primaryType, message: { ...m, value: BigInt(m.value), validAfter: BigInt(m.validAfter), validBefore: BigInt(m.validBefore) } } as never)
      }
      throw new Error(`unexpected wallet call ${method}`)
    },
  }
}

beforeAll(async () => {
  execSync('pnpm helper:build', { stdio: 'pipe' }) // always test the file we ship
  H = await import(pathToFileURL(resolve('helper/dist/tapehermes.min.js')).href + `?t=${Date.now()}`)
})

describe('the helper against a development server (manifest read from our endpoint)', () => {
  let t: TestApp
  let up: ReturnType<typeof fakeUpstream>
  let fac: ReturnType<typeof attachFacilitator>
  const buyer = newWallet()
  const dev = () => ({ siteUrl: `${t.base}/sites/${SITE}` })
  let ownerToken = ''

  beforeAll(async () => { t = await startTestApp({ siteCallsPerMin: 1000 }) })
  afterAll(async () => { await t.stop() })
  beforeEach(async () => {
    await resetState(t.prisma, t.redis); t.cache.clear(); t.chain.sites.clear()
    up = fakeUpstream(); t.setHosted(up); fac = attachFacilitator(t)
    const owner = newWallet(); t.chain.set(SITE, owner.address)
    const tk = await t.api.signIn(owner)
    ownerToken = tk
    await t.api.call('POST', '/api/sites', { token: tk, body: { name: SITE } })
    await t.api.call('POST', `/api/sites/${SITE}/routes`, { token: tk, body: { name: 'paid', config: fx, priceUsd: '0.002' } })
    await t.api.call('POST', `/api/sites/${SITE}/routes`, { token: tk, body: { name: 'free', config: fx } })
  })

  it('calls a free route, verifies the signed answer, and says where it read the manifest', async () => {
    const w = fakeWallet(buyer)
    const r = await H.createHermes({ ethereum: w, dev: dev() }).call('free', { from: 'USD' })
    expect(r.result).toEqual({ base: 'USD', rates: { EUR: 0.9 } })
    expect(r.verified).toBe(true)
    expect(r.paid).toBe(false)
    expect(r.trust.source).toBe('endpoint (DEVELOPMENT ONLY)')
    expect(r.trust.dev).toBe(true)
    expect(w.log).toEqual([]) // a free call never touches the wallet
  })

  it('pays a priced route: 402, switch chain, sign, retry, settle once, verified answer, settlement transaction', async () => {
    const w = fakeWallet(buyer)
    const r = await H.createHermes({ ethereum: w, dev: dev() }).call('paid', { from: 'USD' })
    expect(r).toMatchObject({ paid: true, verified: true, price: '0.002', transaction: MOCK_TX })
    expect(r.result.base).toBe('USD')
    expect(w.log).toEqual(['eth_requestAccounts', 'eth_chainId', 'wallet_switchEthereumChain', 'eth_signTypedData_v4'])
    expect([fac.verifyCalls, fac.settleCalls, up.hits.length]).toEqual([1, 1, 1])
  })

  it('refuses to pay when the price asked differs from the manifest price (nothing signed, nothing settled)', async () => {
    const w = fakeWallet(buyer)
    const hermes = H.createHermes({ ethereum: w, dev: dev() })
    await hermes.manifest() // the manifest price (0.002) is read and cached
    await t.prisma.route.updateMany({ where: { name: 'paid' }, data: { priceUsd: '0.9' } })
    t.cache.clear() // the server now asks for more than the manifest the page saw
    await expect(hermes.call('paid', { from: 'USD' })).rejects.toMatchObject({ code: 'PRICE_MISMATCH' })
    expect(w.log).not.toContain('eth_signTypedData_v4')
    expect(fac.settleCalls).toBe(0)
  })

  it('maxPriceUsd stops a payment above the limit', async () => {
    const w = fakeWallet(buyer)
    await expect(H.createHermes({ ethereum: w, dev: dev(), maxPriceUsd: '0.001' }).call('paid', { from: 'USD' })).rejects.toMatchObject({ code: 'PRICE_TOO_HIGH' })
    expect(w.log).not.toContain('eth_signTypedData_v4')
    expect(fac.settleCalls).toBe(0)
  })

  it('a failing outside call raises a signed error and nothing is paid', async () => {
    t.setHosted({ resolve: up.resolve, fetch: (async () => new Response('boom', { status: 500 })) as never })
    await expect(H.createHermes({ ethereum: fakeWallet(buyer), dev: dev() }).call('paid', { from: 'USD' })).rejects.toMatchObject({ code: 'INTERNAL', details: { signed: true } })
    expect(fac.settleCalls).toBe(0)
  })

  it('a payment service outage is reported as such, retryable, and the wallet is NOT prompted again', async () => {
    fac.script.throwOnVerify = true
    const w = fakeWallet(buyer)
    const hermes = H.createHermes({ ethereum: w, dev: dev() })
    await expect(hermes.call('paid', { from: 'USD' })).rejects.toMatchObject({ code: 'PAYMENT_SERVICE_UNAVAILABLE', details: { retryable: true, paid: false, status: 503, signed: false } })
    // exactly one signature was asked for, and nothing after the 503
    expect(w.log).toEqual(['eth_requestAccounts', 'eth_chainId', 'wallet_switchEthereumChain', 'eth_signTypedData_v4'])
    expect(fac.settleCalls).toBe(0)
    expect(up.hits).toHaveLength(0)
    // the visitor tries again on purpose once the service is back: that is a new call and asks once more
    fac.script.throwOnVerify = false
    const ok = await hermes.call('paid', { from: 'USD' })
    expect(ok.paid).toBe(true)
    expect(w.log.filter((m: string) => m === 'eth_signTypedData_v4')).toHaveLength(2)
  })

  it('an unsigned refusal before any payment (rate limit) is reported with its own code and never touches the wallet', async () => {
    await t.api.call('PATCH', `/api/sites/${SITE}/routes/free`, { token: ownerToken, body: { rateLimitPerMin: 1 } })
    const w = fakeWallet(buyer)
    const hermes = H.createHermes({ ethereum: w, dev: dev() })
    await hermes.call('free', { from: 'USD' })
    await expect(hermes.call('free', { from: 'USD' })).rejects.toMatchObject({ code: 'RATE_LIMITED', details: { retryable: true, status: 429 } })
    expect(w.log).toEqual([])
  })

  it('an unsigned success is never accepted', async () => {
    const forge = (async (url: string, init?: RequestInit) => {
      if (!String(url).includes('/tapeapi/v1/')) return fetch(url, init)
      return new Response(JSON.stringify({ id: 'x', ok: true, result: { rates: { EUR: 1000 } } }), { status: 200 })
    }) as never
    await expect(H.createHermes({ ethereum: fakeWallet(buyer), dev: dev(), fetch: forge }).call('free', { from: 'USD' })).rejects.toMatchObject({ code: 'BAD_SIGNATURE' })
  })

  it('reports a rejected payment', async () => {
    fac.script.failVerify = true
    await expect(H.createHermes({ ethereum: fakeWallet(buyer), dev: dev() }).call('paid', { from: 'USD' })).rejects.toMatchObject({ code: 'PAYMENT_REJECTED' })
    expect(fac.settleCalls).toBe(0)
  })

  it('refuses an answer that is not signed by the site signer, and does not return it', async () => {
    const tamper = (async (url: string, init?: RequestInit) => {
      const r = await fetch(url, init)
      if (!String(url).includes('/tapeapi/v1/')) return r
      const body = await r.json() as any
      if (body.ok) body.result = { base: 'USD', rates: { EUR: 1000 } } // a man in the middle edits the answer
      return new Response(JSON.stringify(body), { status: r.status, headers: r.headers })
    }) as never
    await expect(H.createHermes({ ethereum: fakeWallet(buyer), dev: dev(), fetch: tamper }).call('free', { from: 'USD' })).rejects.toMatchObject({ code: 'BAD_SIGNATURE' })
  })

  it('hands back the proof of an answer, and verify() accepts it unchanged and rejects any change', async () => {
    const hermes = H.createHermes({ ethereum: fakeWallet(buyer), dev: dev() })
    const r = await hermes.call('free', { from: 'USD' })
    expect(Object.keys(r.proof).sort()).toEqual(['envelope', 'id', 'method', 'params'])
    expect(r.proof.envelope.sig).toMatch(/^0x[0-9a-f]{130}$/)
    const good = await hermes.verify(r.proof)
    expect(good).toMatchObject({ ok: true })
    expect(good.signer.toLowerCase()).toBe(good.expected.toLowerCase())
    const clone = () => JSON.parse(JSON.stringify(r.proof))
    const edited = clone(); edited.envelope.result.rates.EUR = 1000
    expect((await hermes.verify(edited)).ok).toBe(false)
    const otherParams = clone(); otherParams.params = { from: 'EUR' }
    expect((await hermes.verify(otherParams)).ok).toBe(false)
    const otherId = clone(); otherId.id = 'another'
    expect((await hermes.verify(otherId)).ok).toBe(false)
    const noSig = clone(); noSig.envelope.sig = '0x00'
    expect((await hermes.verify(noSig)).ok).toBe(false) // an unreadable signature is a fail, not a crash
  })

  it('expectedSigner must match the manifest signer', async () => {
    const wrong = newWallet().address
    await expect(H.createHermes({ ethereum: fakeWallet(buyer), dev: dev(), expectedSigner: wrong }).call('free', { from: 'USD' })).rejects.toMatchObject({ code: 'SIGNER_MISMATCH' })
    const site = await t.prisma.site.findFirstOrThrow()
    const ok = await H.createHermes({ ethereum: fakeWallet(buyer), dev: dev(), expectedSigner: site.signerAddress }).call('free', { from: 'USD' })
    expect(ok.verified).toBe(true)
  })

  it('unknown method and a missing wallet are clear errors', async () => {
    await expect(H.createHermes({ ethereum: fakeWallet(buyer), dev: dev() }).call('nope')).rejects.toMatchObject({ code: 'NO_SUCH_METHOD' })
    ;(globalThis as any).ethereum = undefined
    await expect(H.createHermes({ dev: dev() }).call('paid', { from: 'USD' })).rejects.toMatchObject({ code: 'NO_WALLET' })
  })
})

describe('the helper on a TapeOut site (manifest from the site own origin, delegation checked)', () => {
  let t: TestApp
  let holder: PrivateKeyAccount
  const buyer = newWallet()
  let gatewayMode: string | null = 'client'
  let ownerOnChain: string

  // What the gateway does for the site: /.well-known/... is served from the site, with its mode headers.
  const siteFetch = (async (input: string, init?: RequestInit) => {
    const u = String(input)
    if (u === RPC) { // the chain: ownerOf(tokenId)
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: '0x' + '0'.repeat(24) + ownerOnChain.slice(2).toLowerCase() }), { headers: { 'content-type': 'application/json' } })
    }
    const real = u.startsWith('/') ? `${t.base}/sites/${SITE}${u}` : u.replace('https://api.tapehermes.test', t.base)
    const r = await fetch(real, init)
    if (!u.startsWith('/.well-known')) return r
    const headers = new Headers(r.headers)
    if (gatewayMode) { headers.set('x-tape-mode', gatewayMode); headers.set('x-tape-verified', '1') }
    return new Response(await r.text(), { status: r.status, headers })
  }) as never

  beforeAll(async () => { t = await startTestApp({ devSkipDelegation: false, siteCallsPerMin: 1000 }) })
  afterAll(async () => { await t.stop() })
  beforeEach(async () => {
    await resetState(t.prisma, t.redis); t.cache.clear(); t.chain.sites.clear(); gatewayMode = 'client'
    t.setHosted(fakeUpstream()); attachFacilitator(t)
    holder = newWallet(); t.chain.set(SITE, holder.address); ownerOnChain = holder.address
    const tk = await t.api.signIn(holder)
    await t.api.call('POST', '/api/sites', { token: tk, body: { name: SITE } })
    await t.api.call('POST', `/api/sites/${SITE}/routes`, { token: tk, body: { name: 'paid', config: fx, priceUsd: '0.002' } })
    await t.api.call('POST', `/api/sites/${SITE}/routes`, { token: tk, body: { name: 'free', config: fx } })
    expect((await delegate(t, tk, holder, SITE)).status).toBe(200)
  })
  const make = (extra: object = {}) => H.createHermes({ ethereum: fakeWallet(buyer, 1952), fetch: siteFetch, rpcUrl: RPC, ...extra })

  it('reads the manifest from the site origin, verifies the delegation and the holder on chain, and pays', async () => {
    const r = await make().call('paid', { from: 'USD' })
    expect(r).toMatchObject({ paid: true, verified: true, transaction: MOCK_TX })
    expect(r.trust).toMatchObject({ source: 'site-origin', delegation: 'signature-valid', holderCheck: 'verified', dev: false, gateway: { mode: 'client', verified: true } })
    expect(r.trust.holder.toLowerCase()).toBe(holder.address.toLowerCase())
    expect(new Date(r.trust.expiresAt).getTime()).toBeGreaterThan(Date.now())
  })

  it('says when the gateway read the file on its server (the compatibility tier)', async () => {
    gatewayMode = 'server'
    expect((await make().call('free', { from: 'USD' })).trust.gateway.mode).toBe('server')
  })

  it('refuses when the delegation was not signed by the current on-chain holder', async () => {
    ownerOnChain = newWallet().address // the NFT was sold; the old delegation no longer counts
    await expect(make().call('free', { from: 'USD' })).rejects.toMatchObject({ code: 'DELEGATION_NOT_FROM_HOLDER' })
  })

  it('without a way to read the chain it still verifies the signature but reports the holder as unchecked; requireHolderCheck refuses', async () => {
    const noRpc = { rpcUrl: undefined, ethereum: fakeWallet(buyer, 1952) }
    const r = await make(noRpc).call('free', { from: 'USD' })
    expect(r.trust.holderCheck).toBe('unchecked')
    expect(r.trust.delegation).toBe('signature-valid')
    await expect(make({ ...noRpc, requireHolderCheck: true }).call('free', { from: 'USD' })).rejects.toMatchObject({ code: 'HOLDER_UNCHECKED' })
  })

  it('refuses a tampered delegation (signature no longer matches the signer)', async () => {
    const bad = (async (input: string, init?: RequestInit) => {
      const r = await (siteFetch as any)(input, init)
      if (!String(input).startsWith('/.well-known')) return r
      const m = await r.json(); m.signer = newWallet().address
      return new Response(JSON.stringify(m), { status: 200, headers: r.headers })
    }) as never
    await expect(make({ fetch: bad }).call('free', { from: 'USD' })).rejects.toMatchObject({ code: expect.stringMatching(/DELEGATION_NOT_FROM_HOLDER|DELEGATION_INVALID/) })
  })

  it('refuses an expired delegation', async () => {
    const old = (async (input: string, init?: RequestInit) => {
      const r = await (siteFetch as any)(input, init)
      if (!String(input).startsWith('/.well-known')) return r
      const m = await r.json(); m.delegation.expires = Math.floor(Date.now() / 1000) - 5
      return new Response(JSON.stringify(m), { status: 200, headers: r.headers })
    }) as never
    await expect(make({ fetch: old }).call('free', { from: 'USD' })).rejects.toMatchObject({ code: 'DELEGATION_EXPIRED' })
  })

  it('does not fall back to our endpoint when the site has no manifest, and says so', async () => {
    const none = (async (input: string, init?: RequestInit) => (String(input).startsWith('/.well-known') ? new Response('not found', { status: 404 }) : (siteFetch as any)(input, init))) as never
    await expect(make({ fetch: none }).call('free', { from: 'USD' })).rejects.toMatchObject({ code: 'MANIFEST_UNAVAILABLE' })
  })

  it('refuses a development manifest when it came from the site origin', async () => {
    const strictOff = await startTestApp({ devSkipDelegation: true })
    try {
      const w = newWallet(); strictOff.chain.set(SITE, w.address)
      const tk = await strictOff.api.signIn(w)
      await strictOff.api.call('POST', '/api/sites', { token: tk, body: { name: SITE } })
      await strictOff.api.call('POST', `/api/sites/${SITE}/routes`, { token: tk, body: { name: 'free', config: fx } })
      const devFetch = (async (input: string, init?: RequestInit) => fetch(String(input).startsWith('/') ? `${strictOff.base}/sites/${SITE}${input}` : String(input), init)) as never
      await expect(H.createHermes({ ethereum: fakeWallet(buyer, 1952), fetch: devFetch }).call('free', { from: 'USD' })).rejects.toMatchObject({ code: 'DEV_MANIFEST' })
    } finally { await strictOff.stop() }
  })
})
