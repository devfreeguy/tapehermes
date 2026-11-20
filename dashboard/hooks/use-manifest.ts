'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { manifestPreviewQuery, manifestStatusQuery } from '@/lib/site-queries'
import { useApi } from './use-api'

/** The manifest we would publish now (unsigned, read only). */
export function useManifestPreview(site: string) {
  const api = useApi()
  return useQuery(manifestPreviewQuery(api, site))
}

/** Is the on-chain manifest the same as that preview? Reads the chain, so it can fail with CHAIN_UNAVAILABLE. */
export function useManifestStatus(site: string) {
  const api = useApi()
  return useQuery(manifestStatusQuery(api, site))
}

/** Ask for the unsigned publish transactions. Sends nothing. */
export function usePublishTx(site: string) {
  const api = useApi()
  return useMutation({ mutationFn: () => api.manifest.publishTx(site) })
}

export function useRefreshManifest(site: string) {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['manifest', site] })
}
