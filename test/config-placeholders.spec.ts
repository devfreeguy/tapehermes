import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { startServer } from '../src/bootstrap.js'
import { loadConfig } from '../src/config/app-config.js'

/** Read a file the way docker --env-file does: KEY=VALUE per line, comment lines ignored. */
const parseEnvFile = (path: string): Record<string, string> =>
  Object.fromEntries(readFileSync(path, 'utf8').split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))

/** A complete, valid production environment. */
const good = (): Record<string, string> => ({
  NODE_ENV: 'production',
  PORT: '3006',
  TRUST_PROXY_HOPS: '1',
  PUBLIC_BASE_URL: 'https://api.tapehermes.xyz',
  AUTH_DOMAIN: 'dashboard.tapehermes.xyz',
  CORS_ORIGINS: 'https://dashboard.tapehermes.xyz',
  DATABASE_URL: 'postgresql://tapehermes_user:Abc123pass@postgres:5432/tapehermes_db',
  REDIS_URL: 'redis://:Abc123pass@redis:6379',
  VAULT_MASTER_KEY: randomBytes(32).toString('base64'),
  RATE_LIMIT_SALT: randomBytes(24).toString('hex'),
  RPC_URLS_196: 'https://rpc.xlayer.tech,https://xlayerrpc.okx.com,https://xlayer.drpc.org',
  X402_NETWORK: 'eip155:196',
})

afterEach(() => vi.unstubAllEnvs())

describe('a placeholder is refused at startup', () => {
  it('accepts a complete real-looking environment', () => {
    expect(() => loadConfig(good())).not.toThrow()
  })

  it.each(['AUTH_DOMAIN', 'RATE_LIMIT_SALT', 'VAULT_MASTER_KEY', 'DATABASE_URL', 'REDIS_URL', 'CORS_ORIGINS', 'OKX_API_KEY', 'OKX_SECRET_KEY', 'OKX_PASSPHRASE'])('refuses %s left as CHANGE_ME, and names it without printing the value', (name) => {
    const env = { ...good(), OKX_API_KEY: 'k', OKX_SECRET_KEY: 's', OKX_PASSPHRASE: 'p', [name]: 'CHANGE_ME_something_secret' }
    let message = ''
    try { loadConfig(env) } catch (e) { message = (e as Error).message }
    expect(message).toContain('placeholder values in')
    expect(message).toContain(name)
    expect(message).not.toContain('something_secret')
  })

  it('refuses every spelling of the placeholder, and values in angle brackets', () => {
    for (const bad of ['CHANGE_ME', 'change_me', 'changeme', 'Change-Me', 'x_CHANGE_ME_y', '<your salt here>']) {
      expect(() => loadConfig({ ...good(), RATE_LIMIT_SALT: bad.padEnd(20, 'x') }), bad).toThrow(/placeholder values in: RATE_LIMIT_SALT/)
    }
  })

  it('lists every placeholder at once, so the owner fixes them in one go', () => {
    expect(() => loadConfig({ ...good(), AUTH_DOMAIN: 'CHANGE_ME_dashboard_host', RATE_LIMIT_SALT: 'CHANGE_ME_random_hex_string', VAULT_MASTER_KEY: 'CHANGE_ME_base64_32_bytes' }))
      .toThrow('placeholder values in: VAULT_MASTER_KEY, RATE_LIMIT_SALT, AUTH_DOMAIN')
  })

  it('the shipped deploy/.env.example is refused as it is, and accepted once every CHANGE_ME is replaced', () => {
    const example = parseEnvFile('deploy/.env.example')
    let message = ''
    try { loadConfig(example) } catch (e) { message = (e as Error).message }
    expect(message).toContain('placeholder values in')
    for (const name of ['DATABASE_URL', 'REDIS_URL', 'VAULT_MASTER_KEY', 'RATE_LIMIT_SALT', 'AUTH_DOMAIN', 'CORS_ORIGINS', 'OKX_API_KEY', 'OKX_SECRET_KEY', 'OKX_PASSPHRASE']) expect(message, name).toContain(name)
    const filled = { ...example, ...good(), OKX_API_KEY: 'key', OKX_SECRET_KEY: 'secret', OKX_PASSPHRASE: 'pass' }
    expect(() => loadConfig(filled)).not.toThrow()
  })

  it('stops the startup path (main.ts loads the config first) before anything connects', () => {
    for (const [k, v] of Object.entries(good())) vi.stubEnv(k, v)
    vi.stubEnv('RATE_LIMIT_SALT', 'CHANGE_ME_random_hex_string')
    expect(() => startServer(loadConfig())).toThrow(/placeholder values in: RATE_LIMIT_SALT/)
  })
})
