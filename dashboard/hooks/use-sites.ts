'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/lib/session/session-context'
import { siteDetailsQuery } from '@/lib/site-queries'
import { useApi } from './use-api'

export const siteKeys = {
  all: ['sites'] as const,
  one: (name: string) => ['sites', name] as const,
}

/** The signed-in owner's sites. Disabled until there is a session. */
export function useSites() {
  const api = useApi()
  const { session } = useSession()
  return useQuery({ queryKey: [...siteKeys.all, 'owner', session?.wallet], queryFn: () => api.sites.list(), enabled: !!session })
}

export function useSite(name: string) {
  const api = useApi()
  const { session } = useSession()
  return useQuery({ ...siteDetailsQuery(api, name), enabled: !!session })
}

/** Run a site-changing call and refresh the site and the list afterwards. */
function useSiteMutation<V, R>(fn: (v: V) => Promise<R>, name?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: siteKeys.all }), name ? qc.invalidateQueries({ queryKey: ['manifest', name] }) : undefined]),
  })
}

export const useRegisterSite = () => { const api = useApi(); return useSiteMutation((name: string) => api.sites.register(name)) }
export const useSetSiteStatus = (name: string) => { const api = useApi(); return useSiteMutation((s: 'ACTIVE' | 'DISABLED') => api.sites.setStatus(name, s), name) }
export const useSetPayout = (name: string) => { const api = useApi(); return useSiteMutation((a: string) => api.sites.setPayout(name, a), name) }
export const useSaveDelegation = (name: string) => {
  const api = useApi()
  return useSiteMutation((v: { signature: string; expires: number }) => api.sites.saveDelegation(name, v.signature, v.expires), name)
}
