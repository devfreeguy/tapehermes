import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { Agent, fetch as undiciFetch } from 'undici'
import { describe, expect, it } from 'vitest'
import { hostedMethods } from '../src/worker/hosted-methods.js'
import { createSafeFetch } from '../src/worker/safe-fetch.js'
import { fakeUpstream } from './helpers/app.js'

const route = (over: Record<string, unknown> = {}) => ({ url: 'https://data.upstream-api.com/v1/rate', method: 'GET', params: { from: 'string' }, query: { from: 'from' }, ...over })
const build = (methods: Record<string, unknown>, secrets: Record<string, string> = {}, opts = {}) => hostedMethods({ methods }, secrets, opts)

describe('worker policy (HOSTED_POLICY, adapter unmodified)', () => {
  it('accepts a plain https route', () => {
    expect(() => build({ a: route() })).not.toThrow()
  })

  it.each([
    ['plain http', route({ url: 'http://data.upstream-api.com/x' })],
    ['a non-443 port', route({ url: 'https://data.upstream-api.com:8443/x' })],
    ['an IP address host', route({ url: 'https://93.184.216.34/x' })],
    ['localhost', route({ url: 'https://localhost/x' })],
    ['an internal suffix', route({ url: 'https://db.internal/x' })],
    ['the platform own host', route({ url: 'https://tapeapi.fun/x' })],
    ['a user:password URL', route({ url: 'https://user:pw@data.upstream-api.com/x' })],
    ['a cookie header', route({ headers: { cookie: 'a=b' } })],
    ['a host header', route({ headers: { host: 'internal' } })],
  ])('refuses %s', (_n, r) => {
    expect(() => build({ a: r })).toThrow()
  })

  it('refuses more than 3 upstream hosts', () => {
    const m = Object.fromEntries(['a', 'b', 'c', 'd'].map((x) => [x, route({ url: `https://${x}.upstream-api.com/x` })]))
    expect(() => build(m)).toThrow(/at most 3/)
  })

  it('refuses a secret name that was not supplied (nothing expands from process.env)', async () => {
    process.env.PLATFORM_ONLY = 'must-never-leak'
    const up = fakeUpstream()
    const { handlers } = build({ a: route({ headers: { 'x-api-key': '${PLATFORM_ONLY}' } }) }, {}, up)
    await handlers.a({ from: 'x' })
    // key is declared but has no value: the header is dropped, never filled from process.env
    expect(up.hits[0].headers['x-api-key']).toBeUndefined()
    expect(JSON.stringify(up.hits)).not.toContain('must-never-leak')
  })

  it('sends a supplied secret only in its header', async () => {
    const up = fakeUpstream()
    const { handlers } = build({ a: route({ headers: { 'x-api-key': '${UPSTREAM_KEY}' } }) }, { UPSTREAM_KEY: 'k-123' }, up)
    await handlers.a({ from: 'x' })
    expect(up.hits[0].headers['x-api-key']).toBe('k-123')
    expect(up.hits[0].url).not.toContain('k-123')
  })

  it('refuses a redirect from the upstream', async () => {
    const fetch302 = (async () => new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/' } })) as unknown as typeof globalThis.fetch
    const { handlers } = build({ a: route() }, {}, { fetch: fetch302, resolve: async () => ['93.184.216.34'] })
    await expect(handlers.a({ from: 'x' })).rejects.toMatchObject({ code: 'INTERNAL' })
  })

  it('refuses a host that resolves to a private address (early check)', async () => {
    const up = fakeUpstream()
    for (const ip of ['127.0.0.1', '10.0.0.5', '169.254.169.254', '192.168.1.9', '::1']) {
      const { handlers } = build({ a: route() }, {}, { fetch: up.fetch, resolve: async () => [ip] })
      await expect(handlers.a({ from: 'x' })).rejects.toMatchObject({ code: 'INTERNAL' })
    }
    expect(up.hits.length).toBe(0)
  })

  it('refuses an answer over 256 KiB', async () => {
    const big = fakeUpstream({ blob: 'x'.repeat(300 * 1024) })
    const { handlers } = build({ a: route() }, {}, big)
    await expect(handlers.a({ from: 'x' })).rejects.toMatchObject({ code: 'INTERNAL' })
  })
})

describe('DNS rebinding', () => {
  /** A real local server that counts connections: the thing a rebinding attack wants to reach. */
  async function victim() {
    let hits = 0
    const srv = createServer((_q, r) => { hits++; r.end('{"secret":"internal"}') })
    await new Promise<void>((ok) => srv.listen(0, '127.0.0.1', ok))
    return { port: (srv.address() as AddressInfo).port, hits: () => hits, close: () => srv.close() }
  }
  // A hostile DNS server: the name looks public to the first check, then answers with the loopback address.
  const rebinding = () => {
    let n = 0
    return { lookup: ((_h: string, _o: unknown, cb: (e: null, a: { address: string; family: number }[]) => void) => { n++; cb(null, [{ address: '127.0.0.1', family: 4 }]) }) as never, calls: () => n }
  }

  it('control: without the connect-time guard the rebound name reaches the internal server', async () => {
    const v = await victim(); const dns = rebinding()
    const open = new Agent({ connect: { lookup: dns.lookup } })
    const res = await undiciFetch(`http://rebind.attacker-site.com:${v.port}/`, { dispatcher: open })
    expect(res.status).toBe(200)
    expect(v.hits()).toBe(1)
    v.close(); await open.close()
  })

  it('with the guard the connection is refused and the internal server sees nothing', async () => {
    const v = await victim(); const dns = rebinding()
    const safe = createSafeFetch({ lookup: dns.lookup })
    await expect(safe.fetch(`http://rebind.attacker-site.com:${v.port}/`)).rejects.toThrow()
    expect(dns.calls()).toBeGreaterThan(0) // the guard really ran at connect time
    expect(v.hits()).toBe(0)
    v.close(); await safe.close()
  })

  it('through the adapter: passes the early resolve check, still blocked at connect time', async () => {
    const dns = rebinding()
    const safe = createSafeFetch({ lookup: dns.lookup })
    const { handlers } = build({ a: route() }, {}, { fetch: safe.fetch, resolve: async () => ['93.184.216.34'] }) // early check sees a public address
    await expect(handlers.a({ from: 'x' })).rejects.toMatchObject({ code: 'INTERNAL', message: expect.stringContaining('unreachable') })
    expect(dns.calls()).toBeGreaterThan(0)
    await safe.close()
  })

  it('also refuses private answers mixed in with public ones', async () => {
    const v = await victim()
    const mixed = ((_h: string, _o: unknown, cb: (e: null, a: { address: string; family: number }[]) => void) => cb(null, [{ address: '93.184.216.34', family: 4 }, { address: '127.0.0.1', family: 4 }])) as never
    const safe = createSafeFetch({ lookup: mixed })
    await expect(safe.fetch(`http://mixed.attacker-site.com:${v.port}/`)).rejects.toThrow()
    expect(v.hits()).toBe(0)
    v.close(); await safe.close()
  })
})
