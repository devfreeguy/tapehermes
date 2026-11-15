'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { RouteConfig } from '@/lib/api/schemas'
import { useApi } from './use-api'

const key = (site: string) => ['routes', site] as const

export function useRoutes(site: string) {
  const api = useApi()
  return useQuery({ queryKey: key(site), queryFn: () => api.routes.list(site) })
}

export interface RouteInput { name: string; config: RouteConfig; priceUsd: string; enabled: boolean; rateLimitPerMin: number }

/** Create, change, enable or disable, and delete routes. The manifest preview and status are refreshed too. */
export function useRouteActions(site: string) {
  const api = useApi()
  const qc = useQueryClient()
  const done = () => Promise.all([qc.invalidateQueries({ queryKey: key(site) }), qc.invalidateQueries({ queryKey: ['manifest', site] })])
  return {
    create: useMutation({ mutationFn: (v: RouteInput) => api.routes.create(site, v), onSuccess: done }),
    update: useMutation({
      mutationFn: (v: { name: string; patch: Partial<Omit<RouteInput, 'name'>> }) => api.routes.update(site, v.name, v.patch),
      onSuccess: done,
    }),
    remove: useMutation({ mutationFn: (name: string) => api.routes.remove(site, name), onSuccess: done }),
  }
}
