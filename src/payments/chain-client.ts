import { createPublicClient, http } from 'viem'
import { xLayerTestnet } from 'viem/chains'
import { envList } from '../shared/env.js'

/** Read-only viem client for X Layer testnet. RPC_URLS_1952 in .env overrides viem's default testnet RPC. */
export function testnetClient() {
  const [url] = envList('RPC_URLS_1952')
  return createPublicClient({ chain: xLayerTestnet, transport: http(url, { timeout: 15000, retryCount: 1 }) })
}
