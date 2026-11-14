import { Injectable } from '@nestjs/common'
import type { createSiteProvider } from '../providers/create-site-provider.js'

type SiteProvider = ReturnType<typeof createSiteProvider>

/** The set of live site providers, keyed by the path segment of the site. */
@Injectable()
export class SiteProvidersService {
  private readonly providers = new Map<string, SiteProvider>()

  add(key: string, provider: SiteProvider): void {
    if (this.providers.has(key)) throw new Error(`site ${key} already registered`)
    this.providers.set(key, provider)
  }

  get(key: string): SiteProvider | undefined {
    return this.providers.get(key)
  }

  /** Point every manifest at the server's real public base URL (known only after listen). */
  publishAt(base: string): void {
    for (const [key, p] of this.providers) p.manifest.endpoints.live = [`${base}/sites/${key}/tapeapi/v1`]
  }
}
