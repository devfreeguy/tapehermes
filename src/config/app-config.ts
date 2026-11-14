import { z } from 'zod'

export const APP_CONFIG = Symbol('APP_CONFIG')

const flag = z.string().optional().transform((v) => v === '1' || v === 'true')

const schema = z.object({
  PORT: z.coerce.number().int().min(0).max(65535).default(3000),
  NODE_ENV: z.string().default('development'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  REDIS_PREFIX: z.string().min(1).default('tapehermes:'),
  VAULT_MASTER_KEY: z.string().min(1),
  RATE_LIMIT_SALT: z.string().min(16),
  AUTH_DOMAIN: z.string().min(1),
  SESSION_TTL_SECONDS: z.coerce.number().int().min(60).default(86400),
  PUBLIC_BASE_URL: z.string().url(),
  RPC_URLS_196: z.string().min(1),
  UNSAFE_DEV_SKIP_DELEGATION: flag,
  PROVIDER_CACHE_MAX: z.coerce.number().int().min(1).max(10000).default(100),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
})

export interface AppConfig {
  port: number
  production: boolean
  databaseUrl: string
  redisUrl: string
  redisPrefix: string
  vaultMasterKey: Buffer
  rateLimitSalt: string
  authDomain: string
  sessionTtlSeconds: number
  publicBaseUrl: string
  rpcUrls196: string[]
  /** THE dev-mode switch. Read nowhere else; use isDevMode(config). */
  devSkipDelegation: boolean
  /** Reverse-proxy hops to trust for the client IP (0 = none). */
  trustProxyHops: number
  /** Most sites whose decrypted secrets may sit in memory at once (least recently used is evicted). */
  providerCacheMax: number
  /** How long a site stays cached (ms). */
  providerCacheTtlMs: number
  /** Per-site cap on calls per minute, over all visitors and routes. */
  siteCallsPerMin: number
}

/** Typed, validated settings. Error messages name the variable, never a value. */
export function loadConfig(source: Record<string, string | undefined> = process.env, overrides: Partial<AppConfig> = {}): AppConfig {
  const parsed = schema.safeParse(source)
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((i) => i.path.join('.')))].join(', ')
    throw new Error(`invalid or missing environment: ${names} (see .env.example)`)
  }
  const e = parsed.data
  const key = Buffer.from(e.VAULT_MASTER_KEY, 'base64')
  if (key.length !== 32) throw new Error('VAULT_MASTER_KEY must be 32 bytes, base64 encoded')
  const rpcUrls196 = e.RPC_URLS_196.split(',').map((s) => s.trim()).filter(Boolean)
  for (const u of rpcUrls196) if (!/^https?:\/\//.test(u)) throw new Error('RPC_URLS_196 must hold http(s) URLs')
  const production = e.NODE_ENV === 'production'
  const cfg: AppConfig = {
    port: e.PORT, production, databaseUrl: e.DATABASE_URL, redisUrl: e.REDIS_URL, redisPrefix: e.REDIS_PREFIX,
    vaultMasterKey: key, rateLimitSalt: e.RATE_LIMIT_SALT, authDomain: e.AUTH_DOMAIN, sessionTtlSeconds: e.SESSION_TTL_SECONDS,
    publicBaseUrl: e.PUBLIC_BASE_URL.replace(/\/+$/, ''), rpcUrls196, devSkipDelegation: e.UNSAFE_DEV_SKIP_DELEGATION, trustProxyHops: e.TRUST_PROXY_HOPS,
    providerCacheMax: e.PROVIDER_CACHE_MAX, providerCacheTtlMs: 5 * 60_000, siteCallsPerMin: 600,
    ...overrides,
  }
  if (cfg.production && cfg.devSkipDelegation) throw new Error('UNSAFE_DEV_SKIP_DELEGATION must be off when NODE_ENV=production')
  return cfg
}
