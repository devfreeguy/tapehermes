import { createServer, type Server } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { x402ResourceServer } from '@okxweb3/x402-core/server'
import { ExactEvmScheme } from '@okxweb3/x402-evm/exact/server'
import { createApp } from '../../src/bootstrap.js'
import { ChainService } from '../../src/chain/chain.service.js'
import { PAYMENT_GATE } from '../../src/calls/payment-gate.js'
import type { X402PaymentGate } from '../../src/calls/x402-payment-gate.js'
import { watchFacilitator } from '../../src/calls/facilitator-watch.js'
import { ProviderCache } from '../../src/providers/provider-cache.service.js'
import { mockFacilitator } from '../fixtures/mock-facilitator.js'

/** Content types a TapeOut site must declare for each file (a wrong or missing one stops the browser running the file). */
export const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
}

export const DEMO_SITE = '1.2.396.tape'
export interface DemoOptions {
  /** mock: fake outside services and a mock payment facilitator, no keys and no network. live: real services (keys from the environment). */
  mock: boolean
  apiPort?: number
  sitePort?: number
  dir?: string
}

/** Mock answers for the two outside services, shaped like the real ones. */
export function mockUpstream(): typeof fetch {
  return (async (url: string | URL, init?: { body?: string }) => {
    const u = String(url)
    const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { 'content-type': 'application/json' } })
    if (u.includes('api.nal.usda.gov')) {
      const q = new URL(u).searchParams.get('query') ?? ''
      return json({ totalHits: 19300, foods: [{ description: q.toUpperCase(), dataType: 'Branded', brandOwner: 'Sartori Company' }] })
    }
    if (u.includes('api.nasa.gov')) return json({ name: '(2010 PK9)', is_potentially_hazardous_asteroid: true, estimated_diameter: { meters: { estimated_diameter_max: 258.25 } }, close_approach_data: [{ close_approach_date: '1900-06-01' }] })
    const sent = JSON.parse(init?.body ?? '{}')
    return json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: `Mock answer, no outside call was made. You asked: ${String(sent.input).slice(0, 80)}` }] }] })
  }) as never
}

/** The demo, end to end on this computer: the real backend, the demo routes from routes.json, and the static site. */
export async function startDemo(o: DemoOptions) {
  const routes = JSON.parse(readFileSync(join(o.dir ?? 'public-site', 'routes.json'), 'utf8')) as { secrets: string[]; routes: { name: string; enabledBy?: string; priceUsd: string; rateLimitPerMin: number; enabled: boolean; config: unknown }[] }
  const owner = privateKeyToAccount(generatePrivateKey())
  const apiPort = o.apiPort ?? 0
  const started = await createApp(
    { rpcUrls196: [], x402Network: 'eip155:1952', devSkipDelegation: true, publicBaseUrl: `http://127.0.0.1:${apiPort || 3100}`, ...(o.mock ? { okx: null } : {}) },
    { port: apiPort },
  )
  // The only stub: who holds the site. The product reads chain 196; a local demo has no site on chain yet.
  started.app.get(ChainService).readSite = (async (name: string) => ({ name, chainId: 196, circuits: '0x' + '11'.repeat(20), tokenId: '1', container: '0x' + '22'.repeat(20), holder: owner.address.toLowerCase(), activated: true })) as never
  if (o.mock) {
    const f = watchFacilitator(mockFacilitator('eip155:1952') as object)
    ;(started.app.get(PAYMENT_GATE) as X402PaymentGate).useResourceServer(new x402ResourceServer(f as never).register('eip155:1952', new ExactEvmScheme()))
    started.app.get(ProviderCache).hostedOptions = { resolve: async () => ['93.184.216.34'], fetch: mockUpstream() }
  }

  const call = async (method: string, path: string, token?: string, body?: unknown) => {
    const r = await fetch(`${started.base}${path}`, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
    return { status: r.status, body: await r.json().catch(() => null) as any }
  }
  const m = await call('POST', '/api/auth/message', undefined, { address: owner.address })
  const v = await call('POST', '/api/auth/verify', undefined, { message: m.body.message, signature: await owner.signMessage({ message: m.body.message }) })
  const token = v.body.token as string
  const reg = await call('POST', '/api/sites', token, { name: DEMO_SITE })
  if (reg.status !== 200) throw new Error(`could not register the demo site: ${reg.status}`)
  const on = (r: { enabledBy?: string }) => !r.enabledBy || !!process.env[r.enabledBy]
  const needed = new Set(routes.routes.filter(on).flatMap((r) => [...JSON.stringify(r.config).matchAll(/${([A-Z0-9_]+)}/g)].map((m) => m[1])))
  for (const name of routes.secrets) {
    const value = o.mock ? 'mock-key-not-real' : process.env[`DEMO_${name}`]
    if (value) await call('PUT', `/api/sites/${DEMO_SITE}/secrets/${name}`, token, { value })
    else if (!o.mock && needed.has(name)) console.warn(`  note: DEMO_${name} is not set, so the route that needs ${name} will answer without a key`)
  }
  for (const { enabledBy, ...r } of routes.routes) {
    const res = await call('POST', `/api/sites/${DEMO_SITE}/routes`, token, { ...r, enabled: r.enabled && on({ enabledBy }) })
    if (res.status !== 201) throw new Error(`route ${r.name} was refused: ${JSON.stringify(res.body).slice(0, 200)}`)
  }
  const payout = process.env.PAY_TO_ADDRESS
  if (payout && !o.mock) await call('PUT', `/api/sites/${DEMO_SITE}/payout`, token, { payoutAddress: payout })

  const root = join(process.cwd(), o.dir ?? 'public-site')
  const site: Server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)).replace(/^([\\/])+/, '')
    const file = join(root, path === '' ? 'index.html' : path)
    if (path.includes('..') || !file.startsWith(root) || !existsSync(file) || /(^|[\\/])(tests|node_modules)([\\/]|$)|package\.json$|build\.mjs$|routes\.json$/.test(path)) { res.writeHead(404).end('not found'); return }
    res.writeHead(200, { 'content-type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }).end(readFileSync(file))
  })
  await new Promise<void>((ok) => site.listen(o.sitePort ?? 0, '127.0.0.1', ok))
  const siteUrl = `http://127.0.0.1:${(site.address() as { port: number }).port}`
  return {
    apiBase: started.base, siteUrl, owner, token, call,
    pageUrl: `${siteUrl}/?dev=${encodeURIComponent(`${started.base}/sites/${DEMO_SITE}`)}`,
    stop: async () => { site.close(); await started.stop() },
  }
}
