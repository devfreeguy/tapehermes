import { createHash } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createSiweMessage } from 'viem/siwe'
import { newWallet, startTestApp, type TestApp } from './helpers/app.js'

let t: TestApp
beforeAll(async () => { t = await startTestApp() })
afterAll(async () => { await t.stop() })

describe('wallet sign-in', () => {
  it('signs in with a one-time message bound to chain 196 and the auth domain', async () => {
    const w = newWallet()
    const m = await t.api.call('POST', '/api/auth/message', { body: { address: w.address } })
    expect(m.status).toBe(200)
    expect(m.body.message).toContain('tapehermes.test wants you to sign in')
    expect(m.body.message).toContain('Chain ID: 196')
    const signature = await w.signMessage({ message: m.body.message })
    const v = await t.api.call('POST', '/api/auth/verify', { body: { message: m.body.message, signature } })
    expect(v.status).toBe(200)
    expect(v.body.wallet).toBe(w.address.toLowerCase())
    const me = await t.api.call('GET', '/api/auth/me', { token: v.body.token })
    expect(me.body.wallet).toBe(w.address.toLowerCase())
  })

  it('refuses a replayed message (the nonce works once)', async () => {
    const w = newWallet()
    const m = await t.api.call('POST', '/api/auth/message', { body: { address: w.address } })
    const signature = await w.signMessage({ message: m.body.message })
    expect((await t.api.call('POST', '/api/auth/verify', { body: { message: m.body.message, signature } })).status).toBe(200)
    expect((await t.api.call('POST', '/api/auth/verify', { body: { message: m.body.message, signature } })).status).toBe(401)
  })

  it('refuses a signature from another wallet', async () => {
    const victim = newWallet(), attacker = newWallet()
    const m = await t.api.call('POST', '/api/auth/message', { body: { address: victim.address } })
    const signature = await attacker.signMessage({ message: m.body.message })
    const v = await t.api.call('POST', '/api/auth/verify', { body: { message: m.body.message, signature } })
    expect(v.status).toBe(401)
    expect(v.body.code).toBe('SIGN_IN_FAILED')
  })

  it('refuses a message for another domain or chain, even with a real signature', async () => {
    const w = newWallet()
    const issued = await t.api.call('POST', '/api/auth/message', { body: { address: w.address } })
    const nonce = /Nonce: (\w+)/.exec(issued.body.message)![1]
    for (const bad of [{ domain: 'evil.example' }, { chainId: 1 }]) {
      const message = createSiweMessage({ address: w.address, chainId: 196, domain: 'tapehermes.test', uri: 'https://tapehermes.test', version: '1', nonce, ...bad })
      const signature = await w.signMessage({ message })
      const v = await t.api.call('POST', '/api/auth/verify', { body: { message, signature } })
      expect(v.status).toBe(401)
      // that attempt used the nonce up; get a fresh one for the next variant
      Object.assign(issued, await t.api.call('POST', '/api/auth/message', { body: { address: w.address } }))
      Object.assign(issued.body, {})
    }
  })

  it('refuses an expired or unknown nonce', async () => {
    const w = newWallet()
    const m = await t.api.call('POST', '/api/auth/message', { body: { address: w.address } })
    const nonce = /Nonce: (\w+)/.exec(m.body.message)![1]
    await t.redis.client.del(t.redis.keys.nonce(nonce)) // what the 5 minute TTL does
    const signature = await w.signMessage({ message: m.body.message })
    expect((await t.api.call('POST', '/api/auth/verify', { body: { message: m.body.message, signature } })).status).toBe(401)
  })

  it('keeps only the SHA-256 of the session token, in Redis, and logout deletes it', async () => {
    const w = newWallet()
    const token = await t.api.signIn(w)
    const keys = await t.redis.client.keys(t.redis.keys.all())
    expect(keys.some((k) => k.includes(token))).toBe(false)
    const hash = createHash('sha256').update(token).digest('hex')
    expect(keys).toContain(t.redis.keys.session(hash))
    expect(await t.redis.client.ttl(t.redis.keys.session(hash))).toBeGreaterThan(0)
    expect((await t.api.call('POST', '/api/auth/logout', { token })).status).toBe(204)
    expect((await t.api.call('GET', '/api/auth/me', { token })).status).toBe(401)
  })

  it('refuses a missing or made-up bearer token', async () => {
    expect((await t.api.call('GET', '/api/auth/me')).status).toBe(401)
    expect((await t.api.call('GET', '/api/auth/me', { token: 'not-a-real-token' })).status).toBe(401)
  })

  it('refuses a malformed address', async () => {
    expect((await t.api.call('POST', '/api/auth/message', { body: { address: '0x123' } })).status).toBe(400)
  })
})

describe('sign-in when the dashboard runs on a port (local development)', () => {
  it('accepts a domain that includes a port, as AUTH_DOMAIN=localhost:3001 sets it', async () => {
    const p = await startTestApp({ authDomain: 'localhost:3001' })
    try {
      const w = newWallet()
      const m = await p.api.call('POST', '/api/auth/message', { body: { address: w.address } })
      expect(m.body.message).toContain('localhost:3001 wants you to sign in')
      const v = await p.api.call('POST', '/api/auth/verify', { body: { message: m.body.message, signature: await w.signMessage({ message: m.body.message }) } })
      expect(v.status).toBe(200)
    } finally { await p.stop() }
  })
})
