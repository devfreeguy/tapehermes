// TapeHermes helper: one self-contained file a TapeOut site bundles in (outside scripts are blocked on TapeOut sites).
// It calls a TapeHermes route, handles "402 payment required" with the visitor's wallet (window.ethereum only),
// retries, and verifies that the answer was signed by the site's signer (TAP-13) and that the signer is the one
// the site holder delegated (TAP-11). It says which source it read the manifest from.
//
//   const hermes = createHermes()                       // on a TapeOut site: manifest from this site's own origin
//   const r = await hermes.call('fxRate', { from: 'USD' })
//   r.result, r.paid, r.transaction, r.trust
import { checksumAddress, delegationSigner, responseSigner, HUB_196 } from './lite.js'

const MANIFEST_PATH = '/.well-known/tapeapi.json'
const PAY_DECIMALS = 6 // USDT0 on X Layer

/** Who signed this answer, and does it match the manifest signer, container and request id? The same test the helper runs on every call. */
function checkAnswer(m, { envelope: env, method, params, id }) {
  let signer = null
  try { signer = responseSigner({ container: env.container, id: env.id, method, params, ok: env.ok, body: env.ok ? env.result : env.error, ts: env.ts }, env.sig) } catch { /* unreadable signature */ }
  const ok = !!signer && lc(signer) === lc(m.signer) && lc(env.container) === lc(m.container) && env.id === id
  return { ok, signer, expected: m.signer }
}

export class HermesError extends Error {
  constructor(code, message, details) { super(message); this.name = 'HermesError'; this.code = code; this.details = details }
}
const fail = (code, message, details) => { throw new HermesError(code, message, details) }

const b64 = (s) => btoa(unescape(encodeURIComponent(s)))
const unb64 = (s) => decodeURIComponent(escape(atob(s)))
const rnd = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('')
const lc = (a) => String(a).toLowerCase()
/** "0.002" -> 2000n (6 decimals). Returns null for anything that is not a plain decimal. */
const toUnits = (usd) => {
  const m = /^(\d+)(?:\.(\d{1,6}))?$/.exec(String(usd))
  return m ? BigInt(m[1]) * 10n ** BigInt(PAY_DECIMALS) + BigInt((m[2] || '').padEnd(PAY_DECIMALS, '0')) : null
}

/**
 * @param {object} [o]
 * @param {object} [o.ethereum]       EIP-1193 wallet (default window.ethereum)
 * @param {string} [o.expectedSigner] if set, the manifest signer must be exactly this address
 * @param {string} [o.rpcUrl]         JSON-RPC URL of X Layer (196) used to check the holder; else the wallet is asked if it is on 196
 * @param {boolean} [o.requireHolderCheck] refuse to call when the holder could not be checked on chain
 * @param {string} [o.maxPriceUsd]    never pay more than this for one call
 * @param {{siteUrl:string}} [o.dev] DEVELOPMENT ONLY: read the manifest and call routes through our server (e.g. http://127.0.0.1:3000/sites/1.2.396.tape) instead of the site's own origin
 * @param {typeof fetch} [o.fetch]
 */
export function createHermes(o = {}) {
  const f = o.fetch || ((...a) => fetch(...a))
  const wallet = () => o.ethereum || globalThis.ethereum || fail('NO_WALLET', 'no wallet found (window.ethereum)')
  let loaded = null

  async function rpc(method, params) {
    if (o.rpcUrl) {
      const r = await (await f(o.rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })).json()
      if (r.error) throw new Error(r.error.message)
      return r.result
    }
    const eth = wallet()
    if (BigInt(await eth.request({ method: 'eth_chainId' })) !== 196n) return null // wallet is elsewhere: cannot check
    return eth.request({ method, params })
  }

  /** Is `address` the owner of the circuit NFT? true / false, or null when it could not be checked. */
  async function isHolder(manifest, address) {
    try {
      const out = await rpc('eth_call', [{ to: manifest.circuits, data: '0x6352211e' + BigInt(manifest.tokenId).toString(16).padStart(64, '0') }, 'latest'])
      return out ? lc('0x' + out.slice(-40)) === lc(address) : null
    } catch { return null }
  }

  async function loadManifest() {
    const dev = o.dev && o.dev.siteUrl && o.dev.siteUrl.replace(/\/+$/, '')
    const url = dev ? dev + MANIFEST_PATH : MANIFEST_PATH
    let res
    try { res = await f(url, { headers: { accept: 'application/json' } }) } catch (e) { fail('MANIFEST_UNAVAILABLE', `could not read ${url}: ${e.message}`) }
    if (!res.ok) fail('MANIFEST_UNAVAILABLE', `${url} answered ${res.status}; there is no published manifest${dev ? '' : ' on this site'}`)
    const manifest = await res.json().catch(() => fail('MANIFEST_UNAVAILABLE', `${url} is not JSON`))
    const mode = res.headers.get('x-tape-mode')
    const trust = {
      source: dev ? 'endpoint (DEVELOPMENT ONLY)' : 'site-origin',
      gateway: { mode: mode || null, verified: res.headers.has('x-tape-verified') ? res.headers.get('x-tape-verified') === '1' : null },
      manifestSigner: manifest.signer, dev: manifest.dev === true, delegation: 'none', holderCheck: 'not-needed', expiresAt: null,
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(manifest.signer || '')) fail('MANIFEST_INVALID', 'the manifest has no valid signer')
    if (o.expectedSigner && lc(o.expectedSigner) !== lc(manifest.signer)) fail('SIGNER_MISMATCH', 'the manifest signer is not the expected signer', { expected: o.expectedSigner, got: manifest.signer })
    if (manifest.dev === true) {
      if (!dev) fail('DEV_MANIFEST', 'this site publishes a development manifest (no holder delegation); refusing to trust it')
      trust.delegation = 'dev-manifest (not enforced)'
      return { manifest, trust }
    }
    const d = manifest.delegation
    if (!d || !Number.isInteger(d.expires) || typeof d.sig !== 'string') fail('NO_DELEGATION', 'the manifest has no holder delegation')
    if (d.expires <= Date.now() / 1000) fail('DELEGATION_EXPIRED', 'the holder delegation has expired')
    let holder
    try { holder = delegationSigner(196, HUB_196, manifest.container, manifest.signer, d.expires, d.sig) } catch { fail('DELEGATION_INVALID', 'the delegation signature could not be read') }
    trust.expiresAt = new Date(d.expires * 1000).toISOString()
    const holds = await isHolder(manifest, holder)
    if (holds === false) fail('DELEGATION_NOT_FROM_HOLDER', 'the delegation was not signed by the current holder of this site', { signedBy: holder })
    if (holds === null && o.requireHolderCheck) fail('HOLDER_UNCHECKED', 'could not check the holder on chain (give rpcUrl, or put the wallet on X Layer)')
    trust.delegation = 'signature-valid'
    trust.holderCheck = holds === true ? 'verified' : 'unchecked'
    trust.holder = holder
    return { manifest, trust }
  }

  const manifest = () => (loaded ||= loadManifest().catch((e) => { loaded = null; throw e }))

  async function pay(required, method, price) {
    const accept = (required.accepts || []).find((a) => a.scheme === 'exact' && /^eip155:\d+$/.test(a.network))
    if (!accept) fail('NO_PAYMENT_OPTION', 'the site asks for a payment this helper cannot make')
    const units = BigInt(accept.amount)
    if (price != null) {
      const expected = toUnits(price)
      if (expected === null || units !== expected) fail('PRICE_MISMATCH', 'the price asked differs from the price in the manifest; not paying', { asked: accept.amount, manifest: price })
    }
    if (o.maxPriceUsd != null && units > toUnits(o.maxPriceUsd)) fail('PRICE_TOO_HIGH', `the price exceeds maxPriceUsd (${o.maxPriceUsd}); not paying`)
    const eth = wallet()
    const chainId = Number(accept.network.split(':')[1])
    const [from] = await eth.request({ method: 'eth_requestAccounts' })
    if (BigInt(await eth.request({ method: 'eth_chainId' })) !== BigInt(chainId)) {
      await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x' + chainId.toString(16) }] }).catch(() => fail('WRONG_CHAIN', `switch the wallet to chain ${chainId} and try again`))
    }
    const now = Math.floor(Date.now() / 1000)
    const authorization = {
      from: checksumAddress(from), to: checksumAddress(accept.payTo), value: accept.amount,
      validAfter: String(now - 5), validBefore: String(now + (accept.maxTimeoutSeconds || 60)), nonce: '0x' + rnd(32),
    }
    const typed = {
      domain: { name: accept.extra.name, version: accept.extra.version, chainId, verifyingContract: checksumAddress(accept.asset) },
      types: {
        EIP712Domain: [{ name: 'name', type: 'string' }, { name: 'version', type: 'string' }, { name: 'chainId', type: 'uint256' }, { name: 'verifyingContract', type: 'address' }],
        TransferWithAuthorization: [
          { name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'value', type: 'uint256' },
          { name: 'validAfter', type: 'uint256' }, { name: 'validBefore', type: 'uint256' }, { name: 'nonce', type: 'bytes32' },
        ],
      },
      primaryType: 'TransferWithAuthorization', message: authorization,
    }
    const signature = await eth.request({ method: 'eth_signTypedData_v4', params: [from, JSON.stringify(typed)] })
    return b64(JSON.stringify({ x402Version: required.x402Version, payload: { authorization, signature }, resource: required.resource, accepted: accept }))
  }

  async function call(method, params = {}) {
    const { manifest: m, trust } = await manifest()
    const entry = (m.methods || []).find((x) => x.name === method) || fail('NO_SUCH_METHOD', `the site has no method "${method}"`)
    const price = m.tapehermes && m.tapehermes.currency === 'USD' && m.tapehermes.price ? m.tapehermes.price[method] : undefined
    const root = o.dev && o.dev.siteUrl ? o.dev.siteUrl.replace(/\/+$/, '') + '/tapeapi/v1' : m.endpoints.live[0].replace(/\/+$/, '')
    const url = root + '/' + entry.name
    const id = rnd(16)
    const body = JSON.stringify({ id, params })
    const send = (extra) => f(url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', ...extra }, body })
    let res = await send({})
    let paid = false
    if (res.status === 402) {
      const hdr = res.headers.get('payment-required')
      if (!hdr) fail('PAYMENT_REQUIRED', 'payment required but the page cannot read the payment header (CORS)')
      const header = await pay(JSON.parse(unb64(hdr)), method, price && price !== '0' ? price : undefined)
      res = await send({ 'payment-signature': header })
      if (res.status === 402) fail('PAYMENT_REJECTED', 'the payment was not accepted', await res.json().catch(() => null))
      paid = res.ok
    }
    const settle = res.headers.get('payment-response')
    const settled = settle ? JSON.parse(unb64(settle)) : null
    const env = await res.json().catch(() => fail('BAD_ANSWER', `the site answered ${res.status} with something that is not JSON`))
    // An UNSIGNED error is the server refusing or being down (429, 503 payment service, ...): report it as it is.
    // The wallet is never asked again here: one signature per call() at most, and a visitor retries on purpose.
    if (!env.sig && env.ok !== true) {
      const e = env.error || {}
      fail(e.code || `HTTP_${res.status}`, e.message || `the site answered ${res.status}`, { signed: false, status: res.status, retryable: res.status >= 500 || res.status === 429, paid: false })
    }
    const check = checkAnswer(m, { envelope: env, method, params, id })
    if (!check.ok) fail('BAD_SIGNATURE', 'the answer is not signed by this site signer; it was NOT used', { transaction: settled && settled.transaction })
    if (!env.ok) fail((env.error && env.error.code) || 'ERROR', (env.error && env.error.message) || 'the site returned an error', { signed: true })
    return { result: env.result, id, method, signer: m.signer, verified: true, paid, price: price || '0', transaction: (settled && settled.transaction) || null, trust, proof: { envelope: env, method, params, id } }
  }

  /** Check an answer again, for example one the page has since changed. Returns { ok, signer, expected } and never throws. */
  async function verify(proof) {
    const { manifest: m } = await manifest()
    return checkAnswer(m, proof)
  }

  return { call, manifest, verify, version: 1 }
}
if (typeof window !== 'undefined') window.TapeHermes = { createHermes, HermesError }
