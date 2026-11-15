'use client'

import { useEffect, useState } from 'react'
import { useConnectors } from 'wagmi'

type Eth = { ethereum?: unknown }

/**
 * Is there a wallet extension in this browser? The static "injected" connector is always in the list, so the list alone
 * cannot say. A wallet is present if window.ethereum exists or one announced itself (EIP-6963). Unknown until mounted.
 */
export function useHasWallet(): boolean | null {
  const connectors = useConnectors()
  const [present, setPresent] = useState<boolean | null>(null)
  const announced = connectors.some((c) => c.id !== 'injected')
  useEffect(() => { setPresent(announced || !!(window as unknown as Eth).ethereum) }, [announced])
  return present
}
