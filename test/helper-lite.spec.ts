import { randomBytes } from 'node:crypto'
import { CHAINS, sig } from '@tapeapi/sdk'
import { abi } from '@tapeapi/sdk'
import { describe, expect, it } from 'vitest'
import * as lite from '../helper/lite.js'

const hex = (b: Uint8Array) => '0x' + Buffer.from(b).toString('hex')
const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n
const same = (digest: Uint8Array, signature: string) => {
  const mine = lite.recover(digest, signature).toLowerCase()
  const theirs = sig.recoverAddress(digest, signature).toLowerCase()
  expect(mine).toBe(theirs)
  return mine
}
/** both implementations must refuse the same input */
const bothRefuse = (digest: Uint8Array, signature: string) => {
  expect(() => sig.recoverAddress(digest, signature)).toThrow()
  expect(() => lite.recover(digest, signature)).toThrow()
}

describe('helper/lite.js agrees with the SDK (the helper must verify exactly what the SDK verifies)', () => {
  it('recovers the same address for 120 random keys and digests', () => {
    for (let i = 0; i < 120; i++) {
      const pk = sig.randomPrivateKey(), digest = randomBytes(32)
      const signature = sig.signDigest(digest, pk)
      expect(same(digest, signature)).toBe(sig.privateKeyToAddress(pk).toLowerCase())
    }
  })

  it('reads v of 0 and 1 as 27 and 28, like the SDK', () => {
    const pk = sig.randomPrivateKey(), digest = randomBytes(32)
    const signature = sig.signDigest(digest, pk)
    const b = Buffer.from(signature.slice(2), 'hex'); b[64] -= 27
    same(digest, '0x' + b.toString('hex'))
  })

  it('refuses what the SDK refuses: high s, bad v, zero or oversized r and s, wrong length, r not on the curve', () => {
    const pk = sig.randomPrivateKey(), digest = randomBytes(32)
    const good = Buffer.from(sig.signDigest(digest, pk).slice(2), 'hex')
    const withS = (s: bigint) => { const b = Buffer.from(good); b.set(Buffer.from(s.toString(16).padStart(64, '0'), 'hex'), 32); return '0x' + b.toString('hex') }
    const sVal = BigInt('0x' + good.subarray(32, 64).toString('hex'))
    bothRefuse(digest, withS(N - sVal)) // the malleable twin
    bothRefuse(digest, withS(0n))
    bothRefuse(digest, withS(N))
    const bv = Buffer.from(good); bv[64] = 29; bothRefuse(digest, '0x' + bv.toString('hex'))
    const r0 = Buffer.from(good); r0.fill(0, 0, 32); bothRefuse(digest, '0x' + r0.toString('hex'))
    bothRefuse(digest, '0x' + good.subarray(0, 64).toString('hex')) // 64 bytes
    bothRefuse(digest, '0x' + good.toString('hex') + '00') // 66 bytes
    expect(() => lite.recover(digest, '0xzz')).toThrow()
    // an x with no curve point: scan for one
    const P = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn
    const powmod = (b: bigint, e: bigint) => { let r = 1n; b %= P; for (; e > 0n; e >>= 1n) { if (e & 1n) r = (r * b) % P; b = (b * b) % P } return r }
    for (let x = 2n; x < 60n; x++) {
      if (powmod(x ** 3n + 7n, (P - 1n) / 2n) !== 1n) {
        const b = Buffer.from(good); b.set(Buffer.from(x.toString(16).padStart(64, '0'), 'hex'), 0)
        bothRefuse(digest, '0x' + b.toString('hex')); break
      }
    }
  })

  it('a signature over another digest recovers to a different address in both', () => {
    const pk = sig.randomPrivateKey(), digest = randomBytes(32)
    const signature = sig.signDigest(digest, pk)
    const other = randomBytes(32)
    expect(lite.recover(other, signature).toLowerCase()).toBe(sig.recoverAddress(other, signature).toLowerCase())
    expect(lite.recover(other, signature).toLowerCase()).not.toBe(sig.privateKeyToAddress(pk).toLowerCase())
  })

  it('checksums addresses like the SDK', () => {
    for (let i = 0; i < 60; i++) {
      const a = hex(randomBytes(20))
      expect(lite.checksumAddress(a)).toBe(abi.checksumAddress(a))
      expect(lite.checksumAddress(a.toUpperCase().replace('0X', '0x'))).toBe(abi.checksumAddress(a))
    }
    expect(() => lite.checksumAddress('0x12')).toThrow()
  })

  it('verifies TAP-13 answer envelopes exactly as sig.recoverResponseSigner does, incl. errors, unicode and nesting', () => {
    const pk = sig.randomPrivateKey()
    const cases = [
      { ok: true, body: { a: 1, b: ['x', { c: null }] }, params: { from: 'USD' } },
      { ok: true, body: { rates: { EUR: 0.9 }, 'ключ': 'значение ✓' }, params: {} },
      { ok: false, body: { code: 'INTERNAL', message: 'x' }, params: { n: 5 } },
      { ok: true, body: 'plain', params: { z: [], y: {} } },
    ]
    for (const c of cases) {
      const env = { container: hex(randomBytes(20)), id: randomBytes(8).toString('hex'), method: 'fxRate', params: c.params, ok: c.ok, body: c.body, ts: Math.floor(Date.now() / 1000) }
      const signature = sig.signResponse(env, pk)
      expect(lite.responseSigner(env, signature).toLowerCase()).toBe(sig.privateKeyToAddress(pk).toLowerCase())
      // a changed body, id or method is a different signer
      expect(lite.responseSigner({ ...env, body: { tampered: true } }, signature).toLowerCase()).not.toBe(sig.privateKeyToAddress(pk).toLowerCase())
      expect(lite.responseSigner({ ...env, method: 'other' }, signature).toLowerCase()).not.toBe(sig.privateKeyToAddress(pk).toLowerCase())
    }
  })

  it('recovers a delegation exactly as the SDK digest does, and the hub constant is the SDK one', () => {
    expect(lite.HUB_196).toBe(CHAINS[196].hub)
    const pk = sig.randomPrivateKey()
    for (let i = 0; i < 20; i++) {
      const container = abi.checksumAddress(hex(randomBytes(20))), signer = abi.checksumAddress(hex(randomBytes(20))), expires = 1_800_000_000 + i
      const signature = sig.signDigest(sig.delegationDigest(196, CHAINS[196].hub, { container, signer, expires }), pk)
      expect(lite.delegationSigner(196, lite.HUB_196, container, signer, expires, signature).toLowerCase()).toBe(sig.privateKeyToAddress(pk).toLowerCase())
      expect(lite.delegationSigner(196, lite.HUB_196, container, signer, expires + 1, signature).toLowerCase()).not.toBe(sig.privateKeyToAddress(pk).toLowerCase())
    }
  })
})
