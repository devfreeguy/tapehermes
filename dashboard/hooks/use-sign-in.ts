'use client'

import { useMutation } from '@tanstack/react-query'
import { useSignMessage } from 'wagmi'
import { useSession } from '@/lib/session/session-context'
import { useApi } from './use-api'

/**
 * Sign in with the connected wallet: the server makes a one-time message (bound to chain 196 and this site's domain),
 * the wallet signs it, the server checks it and returns a session token. Nothing is sent that moves funds.
 */
export function useSignIn(address: string | null) {
  const api = useApi()
  const { signIn } = useSession()
  const sign = useSignMessage()
  return useMutation({
    mutationFn: async () => {
      if (!address) throw new Error('Connect a wallet first.')
      const { message } = await api.auth.message(address)
      const signature = await sign.mutateAsync({ message })
      return api.auth.verify(message, signature)
    },
    onSuccess: (s) => signIn(s),
  })
}
