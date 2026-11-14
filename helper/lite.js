// The few pieces the helper needs, built ONLY on the audited @noble/curves (secp256k1) and @noble/hashes (keccak).
// No hand-written cryptography lives here. test/helper-lite.spec.ts checks every function against the SDK (@tapeapi/sdk)
// on random and hostile inputs.
import { secp256k1 } from '@noble/curves/secp256k1'
import { keccak_256 } from '@noble/hashes/sha3'
import { canonicalJSON } from '@tapeapi/sdk/canon'

const enc = new TextEncoder()
const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
const unhex = (h) => {
  const s = h.startsWith('0x') ? h.slice(2) : h
  if (s.length % 2 || /[^0-9a-fA-F]/.test(s)) throw new Error('bad hex')
  return Uint8Array.from(s.match(/../g) || [], (x) => parseInt(x, 16))
}
const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let p = 0; for (const x of a) { o.set(x, p); p += x.length } return o }
const word = (n) => unhex(BigInt(n).toString(16).padStart(64, '0'))
const addrWord = (a) => cat(new Uint8Array(12), unhex(a))
const big = (b) => BigInt('0x' + (hex(b) || '0'))

// ---- secp256k1 recover (noble) ----
const N = secp256k1.CURVE.n

/** Address (lowercase 0x...) that signed `digest` (32 bytes) with a 65-byte signature. Same rules as the SDK recoverAddress. */
export function recover(digest, signature) {
  const sig = unhex(signature)
  if (sig.length !== 65) throw new Error('signature must be 65 bytes')
  let v = sig[64]
  if (v === 0 || v === 1) v += 27
  if (v !== 27 && v !== 28) throw new Error('bad v')
  const r = big(sig.subarray(0, 32)), s = big(sig.subarray(32, 64))
  if (!s || s >= N || !r || r >= N) throw new Error('r/s out of range')
  if (s > N >> 1n) throw new Error('high-s signature')
  const pub = secp256k1.Signature.fromCompact(sig.subarray(0, 64)).addRecoveryBit(v - 27).recoverPublicKey(digest).toRawBytes(false)
  return '0x' + hex(keccak_256(pub.subarray(1)).subarray(12))
}

// ---- addresses ----
export function checksumAddress(a) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(a)) throw new Error(`bad address ${a}`)
  const low = a.slice(2).toLowerCase()
  const h = hex(keccak_256(enc.encode(low)))
  let out = '0x'
  for (let i = 0; i < 40; i++) out += parseInt(h[i], 16) >= 8 ? low[i].toUpperCase() : low[i]
  return out
}

const personal = (d) => keccak_256(cat(enc.encode('\x19Ethereum Signed Message:\n32'), d))

// ---- TAP-13 signed answer (TAPI-1/resp/v2) ----
/** Who signed this answer envelope. `env` = { container, id, method, params, ok, body, ts }. */
export function responseSigner({ container, id, method, params, ok, body, ts }, signature) {
  const t = new Uint8Array(8)
  new DataView(t.buffer).setBigUint64(0, BigInt(ts))
  const digest = keccak_256(cat(
    enc.encode('TAPI-1/resp/v2'), unhex(container), keccak_256(enc.encode(id)),
    keccak_256(enc.encode(canonicalJSON({ method, params: params ?? {} }))), Uint8Array.of(ok ? 1 : 0),
    keccak_256(enc.encode(canonicalJSON(body))), t,
  ))
  return recover(personal(digest), signature)
}

// ---- TAP-11 delegation (EIP-712, domain "TapeAPI" v1 anchored on the DeWEB hub) ----
// Hub of X Layer (196) from the SDK chain table. test/helper-lite.spec.ts fails if the SDK ever changes it.
export const HUB_196 = '0xe61A9C7213a6Aa616C246a2B569e555B417b25ee'
const h256 = (s) => keccak_256(enc.encode(s))
const DOMAIN_TYPEHASH = h256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
const DELEGATION_TYPEHASH = h256('Delegation(address container,address signer,uint64 expires)')

/** The address that signed a delegation of `signer` for `container` until unix time `expires`. */
export function delegationSigner(chainId, hub, container, signer, expires, signature) {
  const ds = keccak_256(cat(DOMAIN_TYPEHASH, h256('TapeAPI'), h256('1'), word(chainId), addrWord(hub)))
  const sh = keccak_256(cat(DELEGATION_TYPEHASH, addrWord(container), addrWord(signer), word(expires)))
  return recover(keccak_256(cat(Uint8Array.of(0x19, 0x01), ds, sh)), signature)
}
