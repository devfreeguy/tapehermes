import { Inject, Injectable } from '@nestjs/common'
import { APP_CONFIG, type AppConfig } from '../config/app-config.js'
import { isDevMode } from '../config/dev-mode.js'
import { PrismaService } from '../database/prisma.service.js'
import { SignerService } from '../signing/signer.service.js'
import { VaultService } from '../vault/vault.service.js'
import { hostedMethods, type AdapterConfig, type HostedOptions } from '../worker/hosted-methods.js'
import { buildSiteManifest } from '../manifest/manifest-builder.js'
import { createSiteProvider } from './create-site-provider.js'

type SiteProvider = ReturnType<typeof createSiteProvider>

export interface RouteRule { name: string; priceUsd: number; rateLimitPerMin: number }
export interface LiveSite {
  siteId: string
  name: string
  /** Where payments settle (normalized). */
  payoutAddress: string
  /** null when the site cannot answer (see refusing). */
  provider: SiteProvider | null
  routes: Map<string, RouteRule>
  /** Dev mode off: DELEGATION_REQUIRED (none stored) or DELEGATION_EXPIRED. NO_ROUTES: nothing to serve yet. */
  refusing: 'DELEGATION_REQUIRED' | 'DELEGATION_EXPIRED' | 'NO_ROUTES' | null
  expiresAt: number
}

/**
 * Per-site providers with their secrets decrypted, kept in process memory only: at most `providerCacheMax` sites
 * (least recently used goes first), each for `providerCacheTtlMs`. Any change to a site evicts it; disabling evicts at once.
 */
@Injectable()
export class ProviderCache {
  private readonly live = new Map<string, LiveSite>() // key: site name; Map order = recency
  private readonly building = new Map<string, Promise<LiveSite | null>>()
  private generation = 0
  /** Test hook: overrides the adapter resolve and fetch. */
  hostedOptions: HostedOptions = {}

  constructor(
    private readonly prisma: PrismaService,
    private readonly vault: VaultService,
    private readonly signer: SignerService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  size() { return this.live.size }
  has(name: string) { return this.live.has(name) }
  evict(name: string) { this.generation++; this.live.delete(name); this.building.delete(name) }
  clear() { this.generation++; this.live.clear(); this.building.clear() }

  /** The live site, or null when it does not exist or is disabled. */
  async get(name: string): Promise<LiveSite | null> {
    const hit = this.live.get(name)
    if (hit && hit.expiresAt > Date.now()) {
      this.live.delete(name)
      this.live.set(name, hit) // most recently used goes last
      return hit
    }
    this.live.delete(name)
    let p = this.building.get(name)
    if (!p) {
      const gen = this.generation
      const mine: Promise<LiveSite | null> = this.build(name).then((s) => {
        // A change that landed while we were building makes this copy stale: use it once, do not cache it.
        if (s && gen === this.generation) this.remember(s)
        return s
      }).finally(() => { if (this.building.get(name) === mine) this.building.delete(name) })
      p = mine
      this.building.set(name, p)
    }
    return p
  }

  private remember(s: LiveSite) {
    this.live.set(s.name, s)
    while (this.live.size > this.config.providerCacheMax) this.live.delete(this.live.keys().next().value as string)
  }

  private async build(name: string): Promise<LiveSite | null> {
    const site = await this.prisma.site.findUnique({ where: { name }, include: { routes: true, secrets: true } })
    if (!site || site.status !== 'ACTIVE') return null
    const idle = (refusing: LiveSite['refusing']): LiveSite => ({ siteId: site.id, name: site.name, payoutAddress: site.payoutAddress, provider: null, routes: new Map(), refusing, expiresAt: Date.now() + this.config.providerCacheTtlMs })
    // Nothing is decrypted for a site that cannot answer anyway.
    const dev = isDevMode(this.config)
    const nowS = Math.floor(Date.now() / 1000)
    const expires = site.delegationExpires ? Math.floor(site.delegationExpires.getTime() / 1000) : null
    if (!dev) {
      if (!site.delegationSig || expires === null) return idle('DELEGATION_REQUIRED')
      if (expires <= nowS) return idle('DELEGATION_EXPIRED')
    }
    if (!site.routes.some((r) => r.enabled)) return idle('NO_ROUTES')
    const secrets: Record<string, string> = {}
    for (const s of site.secrets) secrets[s.name] = this.vault.decrypt(s.valueEnc, { purpose: 'secret', siteId: site.id, name: s.name })
    const enabled = site.routes.filter((r) => r.enabled)
    const config: AdapterConfig = { methods: Object.fromEntries(enabled.map((r) => [r.name, r.config])) }
    const { handlers } = hostedMethods(config, secrets, this.hostedOptions)
    // Dev mode: the same manifest we would publish, minus the delegation (stored but not enforced) and flagged dev.
    const manifest = buildSiteManifest({
      site, routes: site.routes.map((r) => ({ name: r.name, config: r.config, priceUsd: r.priceUsd.toString(), enabled: r.enabled })),
      delegation: dev ? null : { expires: expires!, sig: site.delegationSig! },
      network: this.config.x402Network, publicBaseUrl: this.config.publicBaseUrl, dev,
    })
    const provider = createSiteProvider({
      name: site.name, circuits: site.circuits, tokenId: site.tokenId, container: site.container, chainId: site.chainId,
      methods: handlers, manifest, dev, signerKey: this.signer.open(site.id, site.signerKeyEnc), rpcUrls: this.config.rpcUrls196,
    })
    return {
      siteId: site.id, name: site.name, payoutAddress: site.payoutAddress, provider,
      routes: new Map(enabled.map((r) => [r.name, { name: r.name, priceUsd: Number(r.priceUsd), rateLimitPerMin: r.rateLimitPerMin }])),
      refusing: null,
      expiresAt: Date.now() + this.config.providerCacheTtlMs,
    }
  }
}
