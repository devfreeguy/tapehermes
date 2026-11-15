import { Inject, Injectable } from '@nestjs/common'
import { APP_CONFIG, type AppConfig } from '../config/app-config.js'
import { MANIFEST_KEY } from '@tapeapi/sdk'
import { chainReader } from './chain-reader.js'
import { ChainUnavailableError } from './read-site.js'
import { readSite, type SiteFacts } from './read-site.js'

/** Reads a TapeOut site and its holder on chain 196 through the explicit RPC URLs from the environment. */
@Injectable()
export class ChainService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  readSite(name: string): Promise<SiteFacts> { return readSite(name, 196, this.config.rpcUrls196) }

  /**
   * What the site store holds at /.well-known/tapeapi.json right now: the size and SHA-256 the owner declared when publishing.
   * chunkCount 0 means nothing is published. Throws ChainUnavailableError when the chain cannot be read.
   */
  async manifestOnChain(container: string): Promise<{ published: boolean; size: number; sha256: string; updatedAt: number }> {
    try {
      const r = await chainReader(196, this.config.rpcUrls196).chain.fileInfo(container as `0x${string}`, MANIFEST_KEY) as [bigint, string, string, bigint, bigint]
      return { published: BigInt(r[4]) > 0n, size: Number(r[0]), sha256: String(r[2]).toLowerCase(), updatedAt: Number(r[3]) }
    } catch (e) {
      throw new ChainUnavailableError(`chain read failed: ${(e as Error).message.slice(0, 120)}`)
    }
  }

  /**
   * The UNSIGNED transactions that publish a manifest into the site store (SiteRegistry putFile/appendChunk).
   * Only encodes data: nothing is sent, and the server never holds the holder key.
   */
  publishManifestTxs(container: string, manifestJson: string) {
    return chainReader(196, this.config.rpcUrls196).tx.publishManifest({ container: container as `0x${string}`, manifest: manifestJson })
  }
}
