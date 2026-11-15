'use client'

import { useQuery } from '@tanstack/react-query'
import { useApi } from './use-api'

export function useLogs(site: string, route?: string) {
  const api = useApi()
  return useQuery({ queryKey: ['logs', site, route ?? 'all'], queryFn: () => api.logs.list(site, { route, limit: 100 }) })
}

export function useLogSummary(site: string, days: number) {
  const api = useApi()
  return useQuery({ queryKey: ['logs', site, 'summary', days], queryFn: () => api.logs.summary(site, days) })
}
