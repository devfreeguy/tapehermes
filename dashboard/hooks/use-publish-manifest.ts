'use client'

import { useMutation } from '@tanstack/react-query'
import { useConfig, useSendTransaction } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { toSendParams } from '@/lib/wallet/tx'
import { usePublishTx, useRefreshManifest } from './use-manifest'
import { useWallet } from './use-wallet'

/**
 * Publish the manifest through the owner's wallet: get the unsigned transactions from the API, switch the wallet to
 * X Layer, send them one by one in order, wait for each to be mined, then re-check the on-chain state.
 * The server never holds the key; each transaction is confirmed in the wallet.
 */
export function usePublishManifest(site: string) {
  const config = useConfig()
  const wallet = useWallet()
  const tx = usePublishTx(site)
  const send = useSendTransaction()
  const refresh = useRefreshManifest(site)
  return useMutation({
    mutationFn: async (onProgress?: (done: number, total: number) => void) => {
      const built = await tx.mutateAsync()
      if (!wallet.onXLayer) await wallet.switchToXLayer()
      const hashes: string[] = []
      for (const t of built.txs) {
        const hash = await send.mutateAsync(toSendParams(t))
        await waitForTransactionReceipt(config, { hash })
        hashes.push(hash)
        onProgress?.(hashes.length, built.txs.length)
      }
      await refresh()
      return hashes
    },
  })
}
