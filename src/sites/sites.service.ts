import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { APP_CONFIG, type AppConfig } from '../config/app-config.js'
import { delegationPayload, delegationStatus, DEFAULT_DAYS, expiryFor, MAX_DAYS, MIN_DAYS, recoverDelegationSigner } from './delegation.js'
import { ChainService } from '../chain/chain.service.js'
import { ChainUnavailableError, SiteNotFoundError, type SiteFacts } from '../chain/read-site.js'
import { PrismaService } from '../database/prisma.service.js'
import { ProviderCache } from '../providers/provider-cache.service.js'
import { sameAddress, tryNormalizeAddress } from '../shared/address.js'
import { SignerService } from '../signing/signer.service.js'
import type { Session } from '../auth/session.store.js'
import type { Site } from '../generated/prisma/client.js'

/** What the API shows of a site. Never the signer key, never a secret. */
export const publicSite = (s: Site, expiringDays: number) => ({
  name: s.name, chainId: s.chainId, tokenId: s.tokenId, holder: s.holder, payoutAddress: s.payoutAddress,
  signer: s.signerAddress, status: s.status, delegation: delegationStatus(s, expiringDays), createdAt: s.createdAt,
})

@Injectable()
export class SitesService {
  constructor(
    private readonly prisma: PrismaService, private readonly chain: ChainService,
    private readonly signer: SignerService, private readonly cache: ProviderCache,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** The API view of a site (delegation status included). */
  view(s: Site) { return publicSite(s, this.config.expiringDays) }

  async readChain(name: string): Promise<SiteFacts> {
    try { return await this.chain.readSite(name) } catch (e) {
      if (e instanceof SiteNotFoundError) throw new NotFoundException({ code: 'SITE_NOT_FOUND', message: 'no such TapeOut site' })
      if (e instanceof ChainUnavailableError) throw new ServiceUnavailableException({ code: 'CHAIN_UNAVAILABLE', message: 'the chain could not be read; try again shortly' })
      throw e
    }
  }

  /**
   * Register a site. Allowed only for the wallet that is the CURRENT on-chain holder.
   * If the name is already registered to someone else, the current holder takes it over: the old owner secrets,
   * routes, call log and signer key are deleted and a new signer key is made.
   */
  async register(session: Session, name: string) {
    const facts = await this.readChain(name)
    if (!sameAddress(facts.holder, session.wallet)) {
      throw new ForbiddenException({ code: 'NOT_HOLDER', message: 'the signed-in wallet is not the current holder of this site' })
    }
    const existing = await this.prisma.site.findUnique({ where: { name: facts.name } })
    if (!existing) {
      const id = randomUUID()
      const key = this.signer.generate(id)
      const site = await this.prisma.site.create({
        data: {
          id, ownerId: session.ownerId, name: facts.name, chainId: facts.chainId, circuits: facts.circuits, tokenId: facts.tokenId,
          container: facts.container, holder: facts.holder, payoutAddress: facts.holder, signerAddress: key.address, signerKeyEnc: key.enc,
        },
      })
      return { site: this.view(site), created: true, takeover: false }
    }
    if (existing.ownerId === session.ownerId) {
      const site = await this.prisma.site.update({ where: { id: existing.id }, data: { holder: facts.holder } })
      return { site: this.view(site), created: false, takeover: false }
    }
    const key = this.signer.generate(existing.id)
    const site = await this.prisma.$transaction(async (tx) => {
      await tx.secret.deleteMany({ where: { siteId: existing.id } })
      await tx.route.deleteMany({ where: { siteId: existing.id } })
      await tx.callLog.deleteMany({ where: { siteId: existing.id } })
      return tx.site.update({
        where: { id: existing.id },
        data: {
          ownerId: session.ownerId, holder: facts.holder, payoutAddress: facts.holder, signerAddress: key.address, signerKeyEnc: key.enc,
          delegationSig: null, delegationExpires: null, status: 'ACTIVE',
        },
      })
    })
    this.cache.evict(existing.name)
    return { site: this.view(site), created: false, takeover: true }
  }

  /** A site the signed-in wallet owns. Anything else is a plain 404 (we do not reveal other people sites). */
  async requireOwned(session: Session, name: string): Promise<Site> {
    const site = await this.prisma.site.findUnique({ where: { name } })
    if (!site || site.ownerId !== session.ownerId) throw new NotFoundException({ code: 'SITE_NOT_FOUND', message: 'no such site' })
    return site
  }

  async list(session: Session) {
    const sites = await this.prisma.site.findMany({ where: { ownerId: session.ownerId }, orderBy: { createdAt: 'asc' } })
    return sites.map((s) => this.view(s))
  }

  async get(session: Session, name: string) { return this.view(await this.requireOwned(session, name)) }

  async setStatus(session: Session, name: string, status: 'ACTIVE' | 'DISABLED') {
    const site = await this.requireOwned(session, name)
    const updated = await this.prisma.site.update({ where: { id: site.id }, data: { status } })
    this.cache.evict(site.name) // disabling removes the decrypted secrets from memory at once
    return this.view(updated)
  }

  async setPayout(session: Session, name: string, address: string) {
    const site = await this.requireOwned(session, name)
    const payout = tryNormalizeAddress(address)
    if (!payout) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'payoutAddress is not a valid address' })
    const updated = await this.prisma.site.update({ where: { id: site.id }, data: { payoutAddress: payout } })
    this.cache.evict(site.name)
    return this.view(updated)
  }

  /**
   * The exact typed data the holder must sign (EIP-712 Delegation, TAP-11 section 4), for 1 to 366 days (default 30).
   * Nothing is stored: the same payload is rebuilt and checked when the signature comes back.
   */
  async delegationMessage(session: Session, name: string, days = DEFAULT_DAYS) {
    if (!Number.isFinite(days) || days < MIN_DAYS || days > MAX_DAYS) throw new BadRequestException({ code: 'BAD_REQUEST', message: `days must be from ${MIN_DAYS} to ${MAX_DAYS}` })
    const site = await this.requireOwned(session, name)
    const expires = expiryFor(days)
    const subject = { container: site.container, signerAddress: site.signerAddress, chainId: site.chainId }
    return { typedData: delegationPayload(subject, expires), expires, expiresAt: new Date(expires * 1000), days, signer: site.signerAddress, container: site.container, holder: site.holder }
  }

  /**
   * Store a delegation. The holder is read from chain again first, and the signature must recover to that holder
   * (EOA wallets; a contract holder would need EIP-1271 and is refused). Nothing is stored otherwise.
   */
  async saveDelegation(session: Session, name: string, signature: string, expires: number) {
    const site = await this.requireOwned(session, name)
    const facts = await this.readChain(site.name)
    if (!sameAddress(facts.holder, session.wallet)) {
      throw new ForbiddenException({ code: 'NOT_HOLDER', message: 'the signed-in wallet is no longer the holder of this site' })
    }
    const nowS = Math.floor(Date.now() / 1000)
    if (!Number.isInteger(expires) || expires <= nowS) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'expires must be a future unix time' })
    if (expires > nowS + MAX_DAYS * 86_400 + 300) throw new BadRequestException({ code: 'BAD_REQUEST', message: `a delegation lasts at most ${MAX_DAYS} days` })
    let signedBy: string
    try { signedBy = recoverDelegationSigner({ container: site.container, signerAddress: site.signerAddress, chainId: site.chainId }, expires, signature) } catch {
      throw new BadRequestException({ code: 'DELEGATION_SIGNATURE_INVALID', message: 'the signature could not be read' })
    }
    if (!sameAddress(signedBy, facts.holder)) {
      throw new BadRequestException({ code: 'DELEGATION_SIGNATURE_MISMATCH', message: 'the signature does not come from the current holder of this site, for this container, signer and expiry' })
    }
    const updated = await this.prisma.site.update({
      where: { id: site.id }, data: { delegationSig: signature, delegationExpires: new Date(expires * 1000), holder: facts.holder },
    })
    this.cache.evict(site.name)
    return this.view(updated)
  }

  conflict(code: string, message: string): never { throw new ConflictException({ code, message }) }
}
