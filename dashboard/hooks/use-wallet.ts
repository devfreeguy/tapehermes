'use client'

import { useCallback } from 'react'
import { useConnect, useConnection, useConnectors, useDisconnect, useSwitchChain } from 'wagmi'
import { CHAIN_ID } from '@/config/app'
import { useHasWallet } from './use-has-wallet'

/** The connected wallet, reduced to what the pages need. Every page talks to this, never to wagmi directly. */
export function useWallet() {
  const conn = useConnection()
  const connectors = useConnectors()
  const connect = useConnect()
  const disconnect = useDisconnect()
  const switchChain = useSwitchChain()
  const hasWallet = useHasWallet()

  const address = conn.address?.toLowerCase() ?? null
  return {
    address,
    isConnected: conn.isConnected,
    onXLayer: conn.chainId === CHAIN_ID,
    /** True when no wallet extension was found on this browser. */
    noWallet: hasWallet === false,
    connectors,
    connecting: connect.isPending,
    connect: useCallback((index = 0) => connect.mutateAsync({ connector: connectors[index] }), [connect, connectors]),
    disconnect: useCallback(() => disconnect.mutate(), [disconnect]),
    /** Ask the wallet to switch to X Layer. Resolves when it has. */
    switchToXLayer: useCallback(() => switchChain.mutateAsync({ chainId: CHAIN_ID }), [switchChain]),
  }
}
export type Wallet = ReturnType<typeof useWallet>
