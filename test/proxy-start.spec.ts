import { afterEach, describe, expect, it, vi } from 'vitest'
import { startServer } from '../src/bootstrap.js'
import { loadConfig } from '../src/config/app-config.js'
import { RateLimiter } from '../src/ratelimit/rate-limiter.service.js'

/** The production start path: the settings come from the environment, through loadConfig and startServer (what main.ts runs). */
async function startFromEnv(hops: string) {
  vi.stubEnv('PORT', '0')
  vi.stubEnv('TRUST_PROXY_HOPS', hops)
  const started = await startServer(loadConfig())
  const seen: string[] = []
  const limiter = started.app.get(RateLimiter)
  const subject = limiter.subject.bind(limiter)
  limiter.subject = (ip: string) => { seen.push(ip); return subject(ip) }
  return { ...started, seen }
}

/** One call that reaches the rate limiter, which sees req.ip. */
const visit = (base: string, forwarded: string) =>
  fetch(`${base}/api/auth/message`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': forwarded }, body: JSON.stringify({ address: '0x' + '11'.repeat(20) }) })

let running: { stop: () => Promise<void> } | null = null
afterEach(async () => { await running?.stop(); running = null; vi.unstubAllEnvs() })

describe('TRUST_PROXY_HOPS from the environment', () => {
  it('with 1 hop, req.ip is the address the proxy saw, and a client-made X-Forwarded-For entry is ignored', async () => {
    const s = running = await startFromEnv('1')
    await visit(s.base, '203.0.113.7')
    await visit(s.base, '9.9.9.9, 203.0.113.7')
    expect(s.seen).toEqual(['203.0.113.7', '203.0.113.7'])
  })

  it('with 0 hops, X-Forwarded-For is ignored and req.ip is the direct peer', async () => {
    const s = running = await startFromEnv('0')
    await visit(s.base, '203.0.113.7')
    expect(s.seen).toHaveLength(1)
    expect(s.seen[0]).not.toBe('203.0.113.7')
    expect(s.seen[0]).toMatch(/127\.0\.0\.1$|::1$/)
  })
})

describe('startup address', () => {
  it('reports the host it listens on', async () => {
    vi.stubEnv('PORT', '0')
    const s = running = await startServer(loadConfig(), '127.0.0.1')
    expect(s.base).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
  })
})
