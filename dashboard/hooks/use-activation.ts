'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useConfig, useSendTransaction } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { sendAll } from '@/lib/wallet/tx'
import { activationQuery } from '@/lib/site-queries'
import { useApi } from './use-api'
import { useWallet } from './use-wallet'

const key = (site: string) => ['activation', site] as const

/** Is the site switched on, until when, and what one month costs. Reads the chain, so it can fail with CHAIN_UNAVAILABLE. */
export function useActivation(site: string) {
  const api = useApi()
  return useQuery(activationQuery(api, site))
}

/** Ask the chain again whether the site is on (the wallet may be a block ahead of the node). */
export function useRecheckActivation(site: string) {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: key(site) })
}

/**
 * Switch the site on through the owner's wallet: get the unsigned transaction from the API, switch the wallet to X Layer,
 * send it (the wallet shows the price first), wait for it to be mined, then re-check. The server never holds the key.
 */
export function useSwitchOn(site: string) {
  const api = useApi()
  const config = useConfig()
  const wallet = useWallet()
  const send = useSendTransaction()
  const recheck = useRecheckActivation(site)
  return useMutation({
    mutationFn: async (months: number) => {
      const built = await api.activation.tx(site, months)
      if (!wallet.onXLayer) await wallet.switchToXLayer()
      const hashes = await sendAll(built.txs, (p) => send.mutateAsync(p), (hash) => waitForTransactionReceipt(config, { hash }))
      await recheck()
      return hashes
    },
  })
}
