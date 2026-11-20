'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { siteSecretsQuery } from '@/lib/site-queries'
import { useApi } from './use-api'

const key = (site: string) => ['secrets', site] as const

export function useSecrets(site: string) {
  const api = useApi()
  return useQuery(siteSecretsQuery(api, site))
}

/** Add, replace, rename or delete a secret. The list is refreshed afterwards; a value is never kept on this page. */
export function useSecretActions(site: string) {
  const api = useApi()
  const qc = useQueryClient()
  const done = () => Promise.all([qc.invalidateQueries({ queryKey: key(site) }), qc.invalidateQueries({ queryKey: ['routes', site] }), qc.invalidateQueries({ queryKey: ['manifest', site] })])
  return {
    save: useMutation({ mutationFn: (v: { name: string; value: string }) => api.secrets.put(site, v.name, v.value), onSuccess: done }),
    rename: useMutation({ mutationFn: (v: { name: string; to: string }) => api.secrets.rename(site, v.name, v.to), onSuccess: done }),
    remove: useMutation({ mutationFn: (name: string) => api.secrets.remove(site, name), onSuccess: done }),
  }
}
