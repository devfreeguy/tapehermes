import { Inject, Injectable } from '@nestjs/common'
import { createHash, randomBytes } from 'node:crypto'
import { APP_CONFIG, type AppConfig } from '../config/app-config.js'
import { RedisService } from '../redis/redis.service.js'

export interface Session { ownerId: string; wallet: string }
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

/** Opaque bearer sessions. Only the SHA-256 of the token is kept (in Redis, with a fixed TTL). */
@Injectable()
export class SessionStore {
  constructor(private readonly redis: RedisService, @Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async create(s: Session): Promise<{ token: string; expiresInSeconds: number }> {
    const token = randomBytes(32).toString('base64url')
    await this.redis.client.set(this.redis.keys.session(sha256(token)), JSON.stringify(s), 'EX', this.config.sessionTtlSeconds)
    return { token, expiresInSeconds: this.config.sessionTtlSeconds }
  }

  async get(token: string): Promise<Session | null> {
    if (!token || token.length > 128) return null
    const raw = await this.redis.client.get(this.redis.keys.session(sha256(token)))
    return raw ? (JSON.parse(raw) as Session) : null
  }

  async destroy(token: string): Promise<void> {
    await this.redis.client.del(this.redis.keys.session(sha256(token)))
  }
}
