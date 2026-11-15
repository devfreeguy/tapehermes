import { createConfig, injected, unstable_connector } from 'wagmi'
import { xLayer } from 'viem/chains'

/**
 * Injected wallets only (EIP-6963 discovery plus window.ethereum). No WalletConnect, no outside RPC:
 * reads the page needs go through the connected wallet itself, everything else goes through our API.
 */
export const wagmiConfig = createConfig({
  chains: [xLayer],
  connectors: [injected()],
  transports: { [xLayer.id]: unstable_connector(injected) },
  ssr: true,
})

declare module 'wagmi' {
  interface Register { config: typeof wagmiConfig }
}
