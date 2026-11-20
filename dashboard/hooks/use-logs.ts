'use client'

import { useQuery } from '@tanstack/react-query'
import { callSummaryQuery, recentCallsQuery } from '@/lib/site-queries'
import { useApi } from './use-api'

export function useLogs(site: string, route?: string) {
  const api = useApi()
  return useQuery(recentCallsQuery(api, site, route))
}

export function useLogSummary(site: string, days: number) {
  const api = useApi()
  return useQuery(callSummaryQuery(api, site, days))
}
