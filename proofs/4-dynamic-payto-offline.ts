// Proof 4 (offline part): can the receiving wallet be chosen per site at request time?
// Uses a STUB facilitator (www.okx.com is unreachable from this machine). Covers the 402 the server builds;
// real verify/settle against OKX is NOT covered here.
import { paymentMiddleware, x402ResourceServer } from '@okxweb3/x402-express'
import { ExactEvmScheme } from '@okxweb3/x402-evm/exact/server'
import { sig } from '@tapeapi/sdk'
import { startApp } from '../src/bootstrap.js'
import { createSiteProvider } from '../src/providers/create-site-provider.js'
import { payToBySite } from '../src/payments/pay-to-by-site.js'
import { stubFacilitator } from './fixtures/stub-facilitator.js'
import { expect, info, step } from '../src/shared/log.js'

const NETWORK = 'eip155:1952'
const receivers = new Map<string, string>([
  ['site1', sig.privateKeyToAddress(sig.randomPrivateKey())],
  ['site2', sig.privateKeyToAddress(sig.randomPrivateKey())],
])
const zero = '0x0000000000000000000000000000000000000000'

const resourceServer = new x402ResourceServer(stubFacilitator(NETWORK)).register(NETWORK, new ExactEvmScheme())
const { registry, base, stop } = await startApp((app) =>
  app.use(paymentMiddleware({
    'POST /sites/:site/tapeapi/v1/paid': {
      accepts: { scheme: 'exact', network: NETWORK, price: '$0.001', payTo: payToBySite((s) => receivers.get(s)) },
      description: 'proof 4',
    },
  }, resourceServer)))
for (const key of receivers.keys()) {
  registry.add(key, createSiteProvider({ name: key, circuits: zero, tokenId: '1', container: zero, chainId: 196, rpcUrls: [], methods: { paid: async () => ({ ok: 1 }) } }))
}
registry.publishAt(base)

const decode = (h: string | null) => JSON.parse(Buffer.from(h ?? '', 'base64').toString('utf8'))

step('unpaid call to each site: which payTo does the 402 carry?')
for (const [key, want] of receivers) {
  const r = await fetch(`${base}/sites/${key}/tapeapi/v1/paid`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"id":"1","params":{}}' })
  const required = decode(r.headers.get('payment-required'))
  const a = required.accepts[0]
  info(`${key}: ${r.status} network ${a.network} asset ${a.asset} amount ${a.amount} payTo ${a.payTo}`)
  expect(r.status === 402 && a.payTo.toLowerCase() === want.toLowerCase(), `${key}: payTo is that site's own receiver, chosen at request time`)
}

step('unknown site: no receiver, must not produce a payable 402')
const r = await fetch(`${base}/sites/ghost/tapeapi/v1/paid`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
info(`ghost: ${r.status} ${(await r.text()).slice(0, 160)}`)
expect(r.status !== 200 && !r.headers.get('payment-required'), 'no payable requirement for an unknown site')
await stop()
