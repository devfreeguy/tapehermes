'use client'

import { useMutation } from '@tanstack/react-query'
import { useSignTypedData } from 'wagmi'
import { toSignableTypedData } from '@/lib/wallet/typed-data'
import { useApi } from './use-api'
import { useSaveDelegation } from './use-sites'

/**
 * Delegation in three steps, each shown to the owner: the server makes the exact message for the chosen length,
 * the holder wallet signs it, the server checks that the signature comes from the current holder and saves it.
 */
export function useDelegationSigning(site: string) {
  const api = useApi()
  const sign = useSignTypedData()
  const save = useSaveDelegation(site)
  return useMutation({
    mutationFn: async (days: number) => {
      const m = await api.sites.delegationMessage(site, days)
      const signature = await sign.mutateAsync(toSignableTypedData(m.typedData) as never)
      return save.mutateAsync({ signature, expires: m.expires })
    },
  })
}
