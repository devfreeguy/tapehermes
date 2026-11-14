import { Inject, Injectable } from '@nestjs/common'
import { APP_CONFIG, type AppConfig } from '../config/app-config.js'
import { readSite, type SiteFacts } from './read-site.js'

/** Reads a TapeOut site and its holder on chain 196 through the explicit RPC URLs from the environment. */
@Injectable()
export class ChainService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}
  readSite(name: string): Promise<SiteFacts> { return readSite(name, 196, this.config.rpcUrls196) }
}
