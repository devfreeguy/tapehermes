import { paymentMiddleware, x402ResourceServer } from '@okxweb3/x402-express'
import { ExactEvmScheme } from '@okxweb3/x402-evm/exact/server'
import { sig } from '@tapeapi/sdk'
import { startApp } from '../../src/bootstrap.js'
import { createSiteProvider } from '../../src/providers/create-site-provider.js'
import { createOkxResourceServer, type Network } from '../../src/payments/okx-resource-server.js'
import { payToBySite } from '../../src/payments/pay-to-by-site.js'
import { requireEnv } from '../../src/shared/env.js'
import { mockFacilitator } from '../fixtures/mock-facilitator.js'

export const NETWORK: Network = 'eip155:1952'
export const SITE = 'demo'
export const PRICE = '$0.001'
const zero = '0x0000000000000000000000000000000000000000'

export interface PaidDemoOptions {
  syncSettle?: boolean
  port?: number
  mock?: boolean
  /** site key -> receiver address. Default: one site "demo" paying PAY_TO_ADDRESS from .env (an address, never a key). */
  receivers?: Record<string, string>
}

/** Paid sites on X Layer testnet, one paid method each, receiver chosen per site at request time. */
export async function startPaidDemo({ syncSettle = false, port = 0, mock = false, receivers }: PaidDemoOptions = {}) {
  const map: Record<string, string> = receivers ?? {
    [SITE]: process.env.PAY_TO_ADDRESS || (mock ? '0x000000000000000000000000000000000000dEaD' : requireEnv('PAY_TO_ADDRESS')),
  }
  const resourceServer = mock
    ? new x402ResourceServer(mockFacilitator(NETWORK)).register(NETWORK, new ExactEvmScheme())
    : createOkxResourceServer(NETWORK, syncSettle)
  const app = await startApp((a) => {
    a.use(paymentMiddleware({
      'POST /sites/:site/tapeapi/v1/paid': {
        accepts: { scheme: 'exact', network: NETWORK, price: PRICE, payTo: payToBySite((s) => map[s]) },
        description: 'Phase 0 paid call',
      },
    }, resourceServer))
    a.useStaticAssets('proofs/browser/dist', { prefix: '/pay/' })
  }, port)
  for (const site of Object.keys(map)) {
    app.registry.add(site, createSiteProvider({
      name: site, circuits: zero, tokenId: '1', container: zero, chainId: 196, rpcUrls: [],
      signerKey: sig.randomPrivateKey(),
      methods: { paid: async () => ({ paid: true, site, at: Date.now() }) },
    }))
  }
  app.registry.publishAt(app.base)
  const urlOf = (site: string) => `${app.base}/sites/${site}/tapeapi/v1/paid`
  const first = Object.keys(map)[0]
  return { ...app, receivers: map, payTo: map[first], urlOf, url: urlOf(first) }
}
