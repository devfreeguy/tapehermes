import { Injectable } from '@nestjs/common'
import { sig } from '@tapeapi/sdk'
import { VaultService } from '../vault/vault.service.js'

/** One signing key per site, stored encrypted and bound to that site id: one site key cannot be opened as another. */
@Injectable()
export class SignerService {
  constructor(private readonly vault: VaultService) {}

  /** A fresh key for a site. `enc` goes in the database; the key itself is never returned or logged. */
  generate(siteId: string): { address: string; enc: string } {
    const key = sig.randomPrivateKey()
    return { address: sig.privateKeyToAddress(key).toLowerCase(), enc: this.vault.encrypt(key, { purpose: 'signer', siteId }) }
  }

  /** Decrypt a site key for building its provider. Throws if the blob belongs to another site. */
  open(siteId: string, enc: string): string {
    return this.vault.decrypt(enc, { purpose: 'signer', siteId })
  }
}
