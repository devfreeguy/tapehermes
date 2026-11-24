'use client'

import { useMutation } from '@tanstack/react-query'
import { useConfig, useSendTransaction } from 'wagmi'
import { getBalance, getGasPrice, waitForTransactionReceipt } from 'wagmi/actions'
import { ApiError } from '@/lib/api/errors'
import type { SiteBundle, SiteFilesPlan } from '@/lib/api/schemas'
import { estimateUploadFeeWei } from '@/lib/site-bundle'
import { sendAll } from '@/lib/wallet/tx'
import { useApi } from './use-api'
import { useWallet } from './use-wallet'

/** Ask the server which files the chain already holds and for the unsigned transactions for the rest. Sends nothing. */
export function usePlanSiteFiles(site: string) {
  const api = useApi()
  return useMutation({ mutationFn: (bundle: SiteBundle) => api.files.plan(site, bundle) })
}

/**
 * Put the website on the chain through the owner's wallet: check the wallet holds enough OKB for the whole upload before
 * the first transaction, send the planned transactions one by one in order (the wallet asks before each), then ask the server
 * again: that second plan is the check, and every file should read "current". The server never holds the key.
 */
export function usePublishSiteFiles(site: string) {
  const config = useConfig()
  const wallet = useWallet()
  const api = useApi()
  const send = useSendTransaction()
  return useMutation({
    mutationFn: async ({ bundle, plan, onProgress }: { bundle: SiteBundle; plan: SiteFilesPlan; onProgress?: (done: number, total: number) => void }) => {
      if (!wallet.onXLayer) await wallet.switchToXLayer()
      const bytes = plan.files.filter((f) => f.state !== 'current').reduce((n, f) => n + f.size, 0)
      const [gasPrice, balance] = await Promise.all([getGasPrice(config), getBalance(config, { address: plan.from as `0x${string}` })])
      if (balance.value < estimateUploadFeeWei(plan.totalTxs, bytes, gasPrice)) {
        throw new ApiError(400, 'NOT_ENOUGH_FOR_FEES', 'The holder wallet does not hold enough OKB to finish the whole upload at today’s network fee.')
      }
      const hashes = await sendAll(plan.txs, (p) => send.mutateAsync(p), (hash) => waitForTransactionReceipt(config, { hash }), onProgress)
      return { hashes, check: await api.files.plan(site, bundle) }
    },
  })
}
