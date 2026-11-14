import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common'
import { Redis } from 'ioredis'
import { APP_CONFIG, type AppConfig } from '../config/app-config.js'
import { makeKeys, type Keys } from './keys.js'

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis
  readonly keys: Keys
  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.client = new Redis(config.redisUrl, { maxRetriesPerRequest: 2, lazyConnect: false })
    this.client.on('error', () => { /* surfaced by ping() in /health; never log the URL */ })
    this.keys = makeKeys(config.redisPrefix)
  }
  async ping(): Promise<boolean> { try { return (await this.client.ping()) === 'PONG' } catch { return false } }
  async onModuleDestroy() { await this.client.quit().catch(() => undefined) }
}
