import type { ApiClient } from './api/client'

export const siteDetailsQuery = (api: ApiClient, name: string) => ({
  queryKey: ['sites', name] as const,
  queryFn: () => api.sites.get(name),
})

export const siteRoutesQuery = (api: ApiClient, name: string) => ({
  queryKey: ['routes', name] as const,
  queryFn: () => api.routes.list(name),
})

export const siteSecretsQuery = (api: ApiClient, name: string) => ({
  queryKey: ['secrets', name] as const,
  queryFn: () => api.secrets.list(name),
})

export const activationQuery = (api: ApiClient, name: string) => ({
  queryKey: ['activation', name] as const,
  queryFn: () => api.activation.status(name),
  retry: false as const,
})

export const manifestStatusQuery = (api: ApiClient, name: string) => ({
  queryKey: ['manifest', name, 'status'] as const,
  queryFn: () => api.manifest.status(name),
  retry: false as const,
})

export const manifestPreviewQuery = (api: ApiClient, name: string) => ({
  queryKey: ['manifest', name, 'preview'] as const,
  queryFn: () => api.manifest.preview(name),
})

export const recentCallsQuery = (api: ApiClient, name: string, route?: string) => ({
  queryKey: ['logs', name, route ?? 'all'] as const,
  queryFn: () => api.logs.list(name, { route, limit: 100 }),
})

export const callSummaryQuery = (api: ApiClient, name: string, days: number) => ({
  queryKey: ['logs', name, 'summary', days] as const,
  queryFn: () => api.logs.summary(name, days),
})
