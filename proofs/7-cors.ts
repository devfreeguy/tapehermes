// Proof 7: CORS the server needs for a page served from the public TapeKit gateway (*.tapekit.org).
import { startApp } from '../src/bootstrap.js'
import { createSiteProvider } from '../src/providers/create-site-provider.js'
import { gatewayOrigins } from '../src/sites/gateway-origin.js'
import { env } from '../src/shared/env.js'
import { expect, info, step } from '../src/shared/log.js'

const siteName = env('XLAYER_SITE', '1.2.396.tape')
const zero = '0x0000000000000000000000000000000000000000'
const { registry, base, stop } = await startApp()
registry.add('xl', createSiteProvider({ name: siteName, circuits: zero, tokenId: '1', container: zero, chainId: 196, rpcUrls: [], methods: { ping: async () => ({ ok: 1 }) } }))
registry.publishAt(base)

const origins = gatewayOrigins(siteName)
info(`gateway origins for ${siteName}: ${origins.join('  ')}`)
const url = `${base}/sites/xl/tapeapi/v1/ping`
const pick = (r: Response) => Object.fromEntries([...r.headers].filter(([k]) => k.startsWith('access-control')))

for (const origin of origins) {
  step(`origin ${origin}`)
  const pre = await fetch(url, { method: 'OPTIONS', headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' } })
  info(`preflight ${pre.status} ${JSON.stringify(pick(pre))}`)
  expect(pre.status === 204 && pre.headers.get('access-control-allow-origin') === '*', 'preflight for a JSON POST is allowed')
  const post = await fetch(url, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ id: '1', params: {} }) })
  expect(post.status === 200 && post.headers.get('access-control-allow-origin') === '*', 'POST response carries allow-origin')
}

step('preflight for a payment header (x402 retry) and which response headers a page can read')
const pre = await fetch(url, { method: 'OPTIONS', headers: { origin: origins[0], 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type,payment-signature' } })
const allowed = (pre.headers.get('access-control-allow-headers') ?? '').toLowerCase().split(',').map((s) => s.trim())
info(`allow-headers: ${allowed.join(',')}  expose-headers: ${pre.headers.get('access-control-expose-headers') ?? '(none)'}`)
info(`payment-signature allowed by the library's CORS: ${allowed.includes('payment-signature')}`)
await stop()
