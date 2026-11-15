import { z, type ZodType } from 'zod'
import { ApiError } from './errors'
import * as s from './schemas'

export interface ApiClientOptions {
  baseUrl: string
  /** The bearer token of the signed-in session, or null. */
  getToken: () => string | null
  /** Called once when the server says the session is gone (401), so the app can sign the owner out. */
  onUnauthorized?: () => void
  fetchImpl?: typeof fetch
}

const enc = encodeURIComponent
const empty = z.undefined().or(z.null()).or(z.literal(''))

/** A small typed client for the TapeHermes management API. Every answer is parsed with zod; every failure is an ApiError. */
export function createApiClient(o: ApiClientOptions) {
  const doFetch = o.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a))

  async function request<T>(method: string, path: string, schema: ZodType<T>, body?: unknown, auth = true): Promise<T> {
    const token = auth ? o.getToken() : null
    let res: Response
    try {
      res = await doFetch(`${o.baseUrl}${path}`, {
        method,
        headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
    } catch (e) { throw ApiError.network(e) }
    if (res.status === 204) return schema.parse(undefined)
    const text = await res.text()
    let json: unknown = null
    try { json = text ? JSON.parse(text) : null } catch { /* not JSON */ }
    if (!res.ok) {
      const err = ApiError.from(res.status, json)
      if (err.isUnauthorized && auth) o.onUnauthorized?.()
      throw err
    }
    const parsed = schema.safeParse(json)
    if (!parsed.success) throw new ApiError(res.status, 'BAD_ANSWER', 'The server answered in a shape this page does not understand.', { issues: parsed.error.issues.length })
    return parsed.data
  }

  const site = (name: string) => `/api/sites/${enc(name)}`
  return {
    auth: {
      message: (address: string) => request('POST', '/api/auth/message', s.authMessage, { address }, false),
      verify: (message: string, signature: string) => request('POST', '/api/auth/verify', s.authSession, { message, signature }, false),
      me: () => request('GET', '/api/auth/me', s.me),
      logout: () => request('POST', '/api/auth/logout', empty),
    },
    sites: {
      list: () => request('GET', '/api/sites', z.array(s.site)),
      get: (name: string) => request('GET', site(name), s.site),
      register: (name: string) => request('POST', '/api/sites', s.registered, { name }),
      setStatus: (name: string, status: 'ACTIVE' | 'DISABLED') => request('PATCH', `${site(name)}/status`, s.site, { status }),
      setPayout: (name: string, payoutAddress: string) => request('PUT', `${site(name)}/payout`, s.site, { payoutAddress }),
      delegationMessage: (name: string, days: number) => request('GET', `${site(name)}/delegation/message?days=${days}`, s.delegationMessage),
      saveDelegation: (name: string, signature: string, expires: number) => request('PUT', `${site(name)}/delegation`, s.site, { signature, expires }),
    },
    secrets: {
      list: (name: string) => request('GET', `${site(name)}/secrets`, z.array(s.secret)),
      put: (name: string, secret: string, value: string) => request('PUT', `${site(name)}/secrets/${enc(secret)}`, s.secret, { value }),
      rename: (name: string, secret: string, newName: string) => request('PATCH', `${site(name)}/secrets/${enc(secret)}`, s.secret, { name: newName }),
      remove: (name: string, secret: string) => request('DELETE', `${site(name)}/secrets/${enc(secret)}`, empty),
    },
    routes: {
      list: (name: string) => request('GET', `${site(name)}/routes`, z.array(s.route)),
      create: (name: string, input: { name: string; config: s.RouteConfig; priceUsd: string; enabled: boolean; rateLimitPerMin: number }) =>
        request('POST', `${site(name)}/routes`, s.route, input),
      update: (name: string, route: string, patch: { config?: s.RouteConfig; priceUsd?: string; enabled?: boolean; rateLimitPerMin?: number }) =>
        request('PATCH', `${site(name)}/routes/${enc(route)}`, s.route, patch),
      remove: (name: string, route: string) => request('DELETE', `${site(name)}/routes/${enc(route)}`, empty),
    },
    manifest: {
      preview: (name: string) => request('GET', `${site(name)}/manifest`, s.manifestPreview),
      status: (name: string) => request('GET', `${site(name)}/manifest/status`, s.manifestStatus),
      publishTx: (name: string) => request('POST', `${site(name)}/manifest/publish-tx`, s.publishTx),
    },
    logs: {
      list: (name: string, q: { route?: string; limit?: number; before?: string } = {}) => {
        const p = new URLSearchParams()
        if (q.route) p.set('route', q.route)
        if (q.limit) p.set('limit', String(q.limit))
        if (q.before) p.set('before', q.before)
        return request('GET', `${site(name)}/logs${p.size ? `?${p}` : ''}`, z.array(s.logRow))
      },
      summary: (name: string, days = 7) => request('GET', `${site(name)}/logs/summary?days=${days}`, s.logSummary),
    },
  }
}
export type ApiClient = ReturnType<typeof createApiClient>
