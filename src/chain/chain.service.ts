import { Inject, Injectable } from '@nestjs/common'
import { APP_CONFIG, type AppConfig } from '../config/app-config.js'
import { chainReader } from './chain-reader.js'
import { readSite, type SiteFacts } from './read-site.js'

/** Reads a TapeOut site and its holder on chain 196 through the explicit RPC URLs from the environment. */
@Injectable()
export class ChainService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  readSite(name: string): Promise<SiteFacts> { return readSite(name, 196, this.config.rpcUrls196) }

  /**
   * The UNSIGNED transactions that publish a manifest into the site store (SiteRegistry putFile/appendChunk).
   * Only encodes data: nothing is sent, and the server never holds the holder key.
   */
  publishManifestTxs(container: string, manifestJson: string) {
    return chainReader(196, this.config.rpcUrls196).tx.publishManifest({ container: container as `0x${string}`, manifest: manifestJson })
  }
}
