import { describe, expect, it } from 'vitest'
import { buildCsp, makeNonce } from '@/lib/csp'

const prod = buildCsp({ nonce: 'abc123', apiOrigin: 'https://api.example.org' })
const dev = buildCsp({ nonce: 'abc123', apiOrigin: 'http://127.0.0.1:3000', dev: true })
const directive = (csp: string, name: string) => csp.split('; ').find((d) => d.startsWith(`${name} `)) ?? ''

describe('content security policy', () => {
  it('allows scripts only from this origin with the nonce, never inline or eval, in production', () => {
    const s = directive(prod, 'script-src')
    expect(s).toBe("script-src 'self' 'nonce-abc123' 'strict-dynamic'")
    expect(s).not.toContain('unsafe-inline')
    expect(s).not.toContain('unsafe-eval')
  })
  it('allows eval only in development (React debugging)', () => {
    expect(directive(dev, 'script-src')).toContain("'unsafe-eval'")
  })
  it('lets the page talk to itself and the API and nothing else', () => {
    expect(directive(prod, 'connect-src')).toBe("connect-src 'self' https://api.example.org")
    expect(prod).not.toMatch(/https?:\/\/(?!api\.example\.org)/)
    expect(directive(dev, 'connect-src')).toContain('ws://localhost:*') // hot reload only
  })
  it('allows no third-party script, style, font, frame or plugin', () => {
    for (const d of ['default-src', 'font-src', 'style-src', 'frame-src', 'object-src', 'worker-src']) expect(directive(prod, d), d).not.toMatch(/https?:|\*/)
    expect(directive(prod, 'frame-src')).toBe("frame-src 'none'")
    expect(directive(prod, 'object-src')).toBe("object-src 'none'")
  })
  it('cannot be framed, and locks base and form targets', () => {
    expect(prod).toContain("frame-ancestors 'none'")
    expect(prod).toContain("base-uri 'self'")
    expect(prod).toContain("form-action 'self'")
  })
  it('upgrades to https in production only', () => {
    expect(prod).toContain('upgrade-insecure-requests')
    expect(dev).not.toContain('upgrade-insecure-requests')
  })
  it('makes a fresh nonce each time', () => {
    const a = makeNonce(), b = makeNonce()
    expect(a).not.toBe(b)
    expect(a.length).toBeGreaterThan(20)
  })
})
