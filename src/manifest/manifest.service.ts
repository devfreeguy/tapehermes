import { BadRequestException, ConflictException, ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common'
import { createHash } from 'node:crypto'
import { validateManifest } from '@tapeapi/sdk'
import type { Session } from '../auth/session.store.js'
import { ChainService } from '../chain/chain.service.js'
import { ChainUnavailableError } from '../chain/read-site.js'
import { APP_CONFIG, type AppConfig } from '../config/app-config.js'
import { PrismaService } from '../database/prisma.service.js'
import { sameAddress } from '../shared/address.js'
import { delegationStatus, recoverDelegationSigner } from '../sites/delegation.js'
import { SitesService } from '../sites/sites.service.js'
import { buildSiteManifest, MAX_MANIFEST_BYTES } from './manifest-builder.js'
import { Inject } from '@nestjs/common'

@Injectable()
export class ManifestService {
  constructor(
    private readonly prisma: PrismaService, private readonly sites: SitesService, private readonly chain: ChainService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private async assemble(session: Session, name: string) {
    const site = await this.sites.requireOwned(session, name)
    const routes = await this.prisma.route.findMany({ where: { siteId: site.id }, orderBy: { name: 'asc' } })
    const status = delegationStatus(site, this.config.expiringDays)
    const usable = status.stored && status.status !== 'expired'
    const manifest = buildSiteManifest({
      site, routes: routes.map((r) => ({ name: r.name, config: r.config, priceUsd: r.priceUsd.toString(), enabled: r.enabled })),
      delegation: usable ? { expires: Math.floor(site.delegationExpires!.getTime() / 1000), sig: site.delegationSig! } : null,
      network: this.config.x402Network, publicBaseUrl: this.config.publicBaseUrl, dev: false,
    })
    const problems: string[] = []
    if (!routes.some((r) => r.enabled)) problems.push('NO_ROUTES: the site has no enabled route')
    if (!status.stored) problems.push('DELEGATION_REQUIRED: the holder has not signed a delegation yet')
    else if (status.status === 'expired') problems.push('DELEGATION_EXPIRED: the stored delegation has expired; sign a new one')
    const json = JSON.stringify(manifest)
    const size = Buffer.byteLength(json)
    if (size > MAX_MANIFEST_BYTES) problems.push(`MANIFEST_TOO_LARGE: ${size} bytes (limit ${MAX_MANIFEST_BYTES})`)
    return { site, manifest, json, size, status, problems }
  }

  /** The manifest that would be published, with the reasons it cannot be published yet. Unsigned content, read only. */
  async preview(session: Session, name: string) {
    const a = await this.assemble(session, name)
    return {
      manifest: a.manifest, size: a.size, sha256: `0x${createHash('sha256').update(a.json).digest('hex')}`,
      delegation: a.status, publishable: a.problems.length === 0, problems: a.problems,
    }
  }

  /**
   * Is what the chain holds the manifest we would publish now?
   *   not-published: nothing at /.well-known/tapeapi.json
   *   current:       the same bytes (same SHA-256)
   *   out-of-date:   something else is there (a route, a price or the delegation changed since, or it was published by hand)
   *   not-ready:     we cannot build a publishable manifest yet (see problems), so there is nothing to compare with
   */
  async status(session: Session, name: string) {
    const a = await this.assemble(session, name)
    let onChain
    try { onChain = await this.chain.manifestOnChain(a.site.container) } catch (e) {
      if (e instanceof ChainUnavailableError) throw new ServiceUnavailableException({ code: 'CHAIN_UNAVAILABLE', message: 'the chain could not be read; try again shortly' })
      throw e
    }
    const expected = a.problems.length ? null : { sha256: `0x${createHash('sha256').update(a.json).digest('hex')}`, size: a.size }
    const state = !onChain.published ? (expected ? 'not-published' : 'not-ready') : !expected ? 'not-ready' : onChain.sha256 === expected.sha256 ? 'current' : 'out-of-date'
    return {
      state, expected, problems: a.problems,
      onChain: onChain.published ? { sha256: onChain.sha256, size: onChain.size, updatedAt: new Date(onChain.updatedAt * 1000) } : null,
    }
  }

  /**
   * The unsigned transaction(s) that publish the manifest. Re-reads the holder from chain, and refuses unless the stored
   * delegation really recovers to that holder and the manifest passes the same validator a live client uses.
   */
  async publishTx(session: Session, name: string) {
    const a = await this.assemble(session, name)
    if (a.problems.length) throw new ConflictException({ code: 'NOT_PUBLISHABLE', message: 'the manifest cannot be published yet', problems: a.problems })
    const facts = await this.sites.readChain(a.site.name)
    if (!sameAddress(facts.holder, session.wallet)) {
      throw new ForbiddenException({ code: 'NOT_HOLDER', message: 'the signed-in wallet is no longer the holder of this site' })
    }
    const expires = Math.floor(a.site.delegationExpires!.getTime() / 1000)
    let signedBy = ''
    try { signedBy = recoverDelegationSigner({ container: a.site.container, signerAddress: a.site.signerAddress, chainId: a.site.chainId }, expires, a.site.delegationSig!) } catch { /* mismatch below */ }
    if (!sameAddress(signedBy, facts.holder)) {
      throw new ConflictException({ code: 'DELEGATION_NOT_FROM_HOLDER', message: 'the stored delegation was not signed by the current holder; sign a new one' })
    }
    try { validateManifest(JSON.parse(a.json), { requireDelegation: true }) } catch (e) {
      throw new BadRequestException({ code: 'MANIFEST_INVALID', message: (e as Error).message.slice(0, 300) })
    }
    const built = this.chain.publishManifestTxs(a.site.container, a.json)
    return {
      from: facts.holder, chainId: a.site.chainId, size: built.size, key: built.key, sha256Hash: built.sha256Hash,
      txs: built.txs.map((t) => ({ ...t, value: t.value === undefined ? undefined : String(t.value) })),
      note: 'Unsigned. Send each transaction in order from the holder wallet. Nothing has been sent.',
    }
  }
}
