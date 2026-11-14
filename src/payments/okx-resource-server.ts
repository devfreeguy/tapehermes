import { x402ResourceServer } from '@okxweb3/x402-express'
import { OKXFacilitatorClient } from '@okxweb3/x402-core'
import { ExactEvmScheme } from '@okxweb3/x402-evm/exact/server'
import { watchFacilitator } from '../calls/facilitator-watch.js'
import { requireEnv } from '../shared/env.js'

export type Network = `${string}:${string}`

/**
 * The x402 resource server wired to the OKX facilitator (default base URL https://www.okx.com).
 * Verified in package source: OKXFacilitatorClient takes { apiKey, secretKey, passphrase, baseUrl?, syncSettle? }
 * and reads no environment variables itself, so the credentials are passed here.
 */
export interface OkxCredentials { apiKey: string; secretKey: string; passphrase: string; baseUrl?: string }

export function createOkxResourceServer(network: Network, syncSettle = false, creds?: OkxCredentials) {
  const facilitator = new OKXFacilitatorClient({
    apiKey: creds?.apiKey ?? requireEnv('OKX_API_KEY'), secretKey: creds?.secretKey ?? requireEnv('OKX_SECRET_KEY'),
    passphrase: creds?.passphrase ?? requireEnv('OKX_PASSPHRASE'), syncSettle, ...(creds?.baseUrl ? { baseUrl: creds.baseUrl } : {}),
  })
  return new x402ResourceServer(watchFacilitator(facilitator)).register(network, new ExactEvmScheme())
}
