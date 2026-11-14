import { x402ResourceServer } from '@okxweb3/x402-express'
import { OKXFacilitatorClient } from '@okxweb3/x402-core'
import { ExactEvmScheme } from '@okxweb3/x402-evm/exact/server'
import { requireEnv } from '../shared/env.js'

export type Network = `${string}:${string}`

/**
 * The x402 resource server wired to the OKX facilitator (default base URL https://www.okx.com).
 * Verified in package source: OKXFacilitatorClient takes { apiKey, secretKey, passphrase, baseUrl?, syncSettle? }
 * and reads no environment variables itself, so the credentials are passed here.
 */
export function createOkxResourceServer(network: Network, syncSettle = false) {
  const facilitator = new OKXFacilitatorClient({
    apiKey: requireEnv('OKX_API_KEY'), secretKey: requireEnv('OKX_SECRET_KEY'), passphrase: requireEnv('OKX_PASSPHRASE'), syncSettle,
  })
  return new x402ResourceServer(facilitator).register(network, new ExactEvmScheme())
}
