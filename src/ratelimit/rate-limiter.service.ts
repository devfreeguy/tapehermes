import { Inject, Injectable } from '@nestjs/common'
import { createHmac } from 'node:crypto'
import { APP_CONFIG, type AppConfig } from '../config/app-config.js'
import { RedisService } from '../redis/redis.service.js'

export interface RateDecision { allowed: boolean; retryAfterSeconds: number }

/** Fixed-window counters in Redis. A raw IP is never stored or logged: only a salted HMAC, and only in Redis, with a short TTL. */
@Injectable()
export class RateLimiter {
  constructor(private readonly redis: RedisService, @Inject(APP_CONFIG) private readonly config: AppConfig) {}

  /** Salted hash of a client address (32 hex chars). Same IP and same salt give the same value; not reversible without the salt. */
  subject(ip: string): string {
    return createHmac('sha256', this.config.rateLimitSalt).update(ip || 'unknown').digest('hex').slice(0, 32)
  }

  async hit(scope: string, subject: string, limit: number, windowSeconds: number): Promise<RateDecision> {
    const now = Math.floor(Date.now() / 1000)
    const window = Math.floor(now / windowSeconds)
    const key = this.redis.keys.rate(scope, subject, window)
    const res = await this.redis.client.multi().incr(key).expire(key, windowSeconds + 5).exec()
    const count = Number(res?.[0]?.[1] ?? 0)
    return count <= limit ? { allowed: true, retryAfterSeconds: 0 } : { allowed: false, retryAfterSeconds: (window + 1) * windowSeconds - now }
  }
}
