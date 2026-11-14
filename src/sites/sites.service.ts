import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { ChainService } from '../chain/chain.service.js'
import { ChainUnavailableError, SiteNotFoundError, type SiteFacts } from '../chain/read-site.js'
import { PrismaService } from '../database/prisma.service.js'
import { ProviderCache } from '../providers/provider-cache.service.js'
import { sameAddress, tryNormalizeAddress } from '../shared/address.js'
import { SignerService } from '../signing/signer.service.js'
import type { Session } from '../auth/session.store.js'
import type { Site } from '../generated/prisma/client.js'

/** What the API shows of a site. Never the signer key, never a secret. */
export const publicSite = (s: Site) => ({
  name: s.name, chainId: s.chainId, tokenId: s.tokenId, holder: s.holder, payoutAddress: s.payoutAddress,
  signer: s.signerAddress, status: s.status, delegation: { stored: !!s.delegationSig, expiresAt: s.delegationExpires },
  createdAt: s.createdAt,
})

@Injectable()
export class SitesService {
  constructor(
    private readonly prisma: PrismaService, private readonly chain: ChainService,
    private readonly signer: SignerService, private readonly cache: ProviderCache,
  ) {}

  private async readChain(name: string): Promise<SiteFacts> {
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
      return { site: publicSite(site), created: true, takeover: false }
    }
    if (existing.ownerId === session.ownerId) {
      const site = await this.prisma.site.update({ where: { id: existing.id }, data: { holder: facts.holder } })
      return { site: publicSite(site), created: false, takeover: false }
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
    return { site: publicSite(site), created: false, takeover: true }
  }

  /** A site the signed-in wallet owns. Anything else is a plain 404 (we do not reveal other people sites). */
  async requireOwned(session: Session, name: string): Promise<Site> {
    const site = await this.prisma.site.findUnique({ where: { name } })
    if (!site || site.ownerId !== session.ownerId) throw new NotFoundException({ code: 'SITE_NOT_FOUND', message: 'no such site' })
    return site
  }

  async list(session: Session) {
    const sites = await this.prisma.site.findMany({ where: { ownerId: session.ownerId }, orderBy: { createdAt: 'asc' } })
    return sites.map(publicSite)
  }

  async get(session: Session, name: string) { return publicSite(await this.requireOwned(session, name)) }

  async setStatus(session: Session, name: string, status: 'ACTIVE' | 'DISABLED') {
    const site = await this.requireOwned(session, name)
    const updated = await this.prisma.site.update({ where: { id: site.id }, data: { status } })
    this.cache.evict(site.name) // disabling removes the decrypted secrets from memory at once
    return publicSite(updated)
  }

  async setPayout(session: Session, name: string, address: string) {
    const site = await this.requireOwned(session, name)
    const payout = tryNormalizeAddress(address)
    if (!payout) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'payoutAddress is not a valid address' })
    return publicSite(await this.prisma.site.update({ where: { id: site.id }, data: { payoutAddress: payout } }))
  }

  /**
   * Store a delegation (signature and expiry). The holder is read from chain again first: if the wallet is no longer
   * the holder, nothing is stored. Not enforced while dev mode is on.
   */
  async saveDelegation(session: Session, name: string, signature: string, expiresAt: Date) {
    const site = await this.requireOwned(session, name)
    const facts = await this.readChain(site.name)
    if (!sameAddress(facts.holder, session.wallet)) {
      throw new ForbiddenException({ code: 'NOT_HOLDER', message: 'the signed-in wallet is no longer the holder of this site' })
    }
    if (expiresAt.getTime() <= Date.now()) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'expiresAt must be in the future' })
    const updated = await this.prisma.site.update({
      where: { id: site.id }, data: { delegationSig: signature, delegationExpires: expiresAt, holder: facts.holder },
    })
    this.cache.evict(site.name)
    return publicSite(updated)
  }

  conflict(code: string, message: string): never { throw new ConflictException({ code, message }) }
}
