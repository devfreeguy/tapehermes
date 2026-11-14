import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { VaultService } from '../src/vault/vault.service.js'
import type { AppConfig } from '../src/config/app-config.js'

const vaultWith = (key: Buffer) => new VaultService({ vaultMasterKey: key } as AppConfig)
const ctx = { purpose: 'secret', siteId: 'site-1', name: 'API_KEY' } as const

describe('vault (AES-256-GCM)', () => {
  const vault = vaultWith(randomBytes(32))

  it('round trips a value', () => {
    const blob = vault.encrypt('s3cr3t-value-123', ctx)
    expect(vault.decrypt(blob, ctx)).toBe('s3cr3t-value-123')
  })

  it('never stores the plaintext and uses a fresh IV each time', () => {
    const a = vault.encrypt('s3cr3t-value-123', ctx)
    const b = vault.encrypt('s3cr3t-value-123', ctx)
    expect(a).not.toContain('s3cr3t')
    expect(a.startsWith('v1.')).toBe(true)
    expect(a).not.toBe(b)
  })

  it('refuses a tampered blob', () => {
    const blob = vault.encrypt('value', ctx).split('.')
    blob[3] = Buffer.from('tampered-bytes').toString('base64url')
    expect(() => vault.decrypt(blob.join('.'), ctx)).toThrow(/authentication/)
  })

  it('refuses a blob moved to another site or another secret name', () => {
    const blob = vault.encrypt('value', ctx)
    expect(() => vault.decrypt(blob, { ...ctx, siteId: 'site-2' })).toThrow()
    expect(() => vault.decrypt(blob, { ...ctx, name: 'OTHER' })).toThrow()
    expect(() => vault.decrypt(blob, { purpose: 'signer', siteId: 'site-1' })).toThrow()
  })

  it('refuses a different master key', () => {
    const blob = vault.encrypt('value', ctx)
    expect(() => vaultWith(randomBytes(32)).decrypt(blob, ctx)).toThrow()
  })

  it('errors never contain the plaintext or the key', () => {
    const blob = vault.encrypt('very-private-value', ctx)
    try { vaultWith(randomBytes(32)).decrypt(blob, ctx) } catch (e) {
      expect((e as Error).message).not.toContain('very-private-value')
    }
  })

  it('rejects a master key that is not 32 bytes', () => {
    expect(() => vaultWith(randomBytes(16))).toThrow(/32 bytes/)
  })
})
