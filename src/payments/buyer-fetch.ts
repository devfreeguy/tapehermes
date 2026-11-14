import { wrapFetchWithPaymentFromConfig } from '@okxweb3/x402-fetch'
import { ExactEvmScheme, toClientEvmSigner } from '@okxweb3/x402-evm'
import { createWalletClient, http, type Account, type Transport } from 'viem'
import { xLayerTestnet } from 'viem/chains'

/**
 * Any viem account (private key) or wallet address (browser wallet via `transport`) -> a fetch that pays 402s
 * on X Layer testnet. The signer is built explicitly as { address, signTypedData } (ClientEvmSigner in x402-evm):
 * the x402-fetch README passes a wallet client, which has no top-level `address` and fails.
 */
export function buyerFetch(account: Account | `0x${string}`, transport: Transport = http()) {
  const wallet = createWalletClient({ account, chain: xLayerTestnet, transport })
  const address = typeof account === 'string' ? account : account.address
  const signer = toClientEvmSigner({
    address,
    signTypedData: (m) => wallet.signTypedData({ account, ...m } as never),
  })
  return wrapFetchWithPaymentFromConfig(fetch, { schemes: [{ network: 'eip155:1952', client: new ExactEvmScheme(signer) }] })
}
