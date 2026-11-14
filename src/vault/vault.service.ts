import { Inject, Injectable } from '@nestjs/common'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { APP_CONFIG, type AppConfig } from '../config/app-config.js'

const VERSION = 'v1'

/** What a ciphertext belongs to. It is bound in as authenticated data, so a blob cannot be moved to another row. */
export type VaultContext = { purpose: 'secret'; siteId: string; name: string } | { purpose: 'signer'; siteId: string }
const aadOf = (c: VaultContext) => Buffer.from(c.purpose === 'secret' ? `secret:${c.siteId}:${c.name}` : `signer:${c.siteId}`)

/** AES-256-GCM. Stored form: v1.<iv>.<tag>.<ciphertext> (base64url). Errors never contain plaintext. */
@Injectable()
export class VaultService {
  private readonly key: Buffer
  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    if (config.vaultMasterKey.length !== 32) throw new Error('vault master key must be 32 bytes')
    this.key = config.vaultMasterKey
  }

  encrypt(plaintext: string, ctx: VaultContext): string {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.key, iv)
    cipher.setAAD(aadOf(ctx))
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    return [VERSION, iv, cipher.getAuthTag(), ct].map((p, i) => (i === 0 ? p : (p as Buffer).toString('base64url'))).join('.')
  }

  decrypt(blob: string, ctx: VaultContext): string {
    const parts = blob.split('.')
    if (parts.length !== 4 || parts[0] !== VERSION) throw new Error('vault: unreadable value')
    try {
      const [, iv, tag, ct] = parts.map((p, i) => (i === 0 ? p : Buffer.from(p, 'base64url'))) as [string, Buffer, Buffer, Buffer]
      const d = createDecipheriv('aes-256-gcm', this.key, iv)
      d.setAAD(aadOf(ctx)); d.setAuthTag(tag)
      return Buffer.concat([d.update(ct), d.final()]).toString('utf8')
    } catch { throw new Error('vault: value failed authentication') }
  }
}
