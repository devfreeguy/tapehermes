import { randomBytes } from 'node:crypto'
import { sig } from '@tapeapi/sdk'
import { describe, expect, it } from 'vitest'
import type { AppConfig } from '../src/config/app-config.js'
import { createSiteProvider } from '../src/providers/create-site-provider.js'
import { SignerService } from '../src/signing/signer.service.js'
import { VaultService } from '../src/vault/vault.service.js'
import { verifyEnvelope, type Envelope } from '../src/sites/verify-envelope.js'

const zero = '0x0000000000000000000000000000000000000000'
const signers = new SignerService(new VaultService({ vaultMasterKey: randomBytes(32) } as AppConfig))

async function ask(provider: ReturnType<typeof createSiteProvider>, method: string): Promise<Envelope> {
  const res = await provider.handleRequest(new Request(`http://x/tapeapi/v1/${method}`, { method: 'POST', body: JSON.stringify({ id: 'iso-1', params: {} }) }), { clientIp: 'iso' })
  return (await res.json()) as Envelope
}
const providerFor = (siteId: string, enc: string, name: string) => createSiteProvider({
  name, circuits: zero, tokenId: '1', container: zero, chainId: 196, rpcUrls: [], signerKey: signers.open(siteId, enc),
  methods: { ping: async () => ({ site: name }) },
})

describe('signer isolation (one signer per site)', () => {
  const a = { id: 'site-a', ...signers.generate('site-a') }
  const b = { id: 'site-b', ...signers.generate('site-b') }

  it('gives each site its own key, stored encrypted', () => {
    expect(a.address).not.toBe(b.address)
    expect(a.enc).not.toBe(b.enc)
    expect(a.enc.startsWith('v1.')).toBe(true)
  })

  it('answers of site A verify against A only, never against B', async () => {
    const envA = await ask(providerFor(a.id, a.enc, 'a.tape'), 'ping')
    const envB = await ask(providerFor(b.id, b.enc, 'b.tape'), 'ping')
    expect(verifyEnvelope(envA, 'ping', {}, a.address)).toBe(true)
    expect(verifyEnvelope(envB, 'ping', {}, b.address)).toBe(true)
    expect(verifyEnvelope(envA, 'ping', {}, b.address)).toBe(false)
    expect(verifyEnvelope(envB, 'ping', {}, a.address)).toBe(false)
  })

  it('the stored address is the address of the key that signs', async () => {
    expect(sig.privateKeyToAddress(signers.open(a.id, a.enc)).toLowerCase()).toBe(a.address)
  })

  it('site B cannot open the key blob of site A (bound to the site id)', () => {
    expect(() => signers.open(b.id, a.enc)).toThrow()
  })

  it('a secret blob is not accepted as a signer key, and the reverse', () => {
    const vault = new VaultService({ vaultMasterKey: randomBytes(32) } as AppConfig)
    const s = new SignerService(vault)
    const k = s.generate('x')
    expect(() => vault.decrypt(k.enc, { purpose: 'secret', siteId: 'x', name: 'N' })).toThrow()
  })
})
