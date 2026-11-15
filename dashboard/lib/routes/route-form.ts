import { ROUTE_NAME_RE } from '@/config/app'
import type { Pair } from '@/components/molecules/key-value-editor'
import type { Route, RouteConfig } from '@/lib/api/schemas'
import { parseValue, stringifyValue } from './value-text'

type Method = NonNullable<RouteConfig['method']>
export type BodyMode = 'none' | 'all' | 'map'

/** A route as the editor holds it: plain strings and rows, nothing parsed yet. */
export interface RouteForm {
  name: string
  url: string
  method: Method
  callerInputs: string
  query: Pair[]
  bodyMode: BodyMode
  bodyMap: Pair[]
  headers: Pair[]
  defaults: Pair[]
  required: string
  pick: Pair[]
  locked: Pair[]
  limits: Pair[]
  timeoutMs: string
  priceUsd: string
  rateLimitPerMin: string
  enabled: boolean
}

export const emptyRouteForm = (): RouteForm => ({
  name: '', url: 'https://', method: 'GET', callerInputs: '', query: [], bodyMode: 'none', bodyMap: [], headers: [], defaults: [], required: '',
  pick: [], locked: [], limits: [], timeoutMs: '', priceUsd: '0', rateLimitPerMin: '60', enabled: true,
})

const rows = (o: Record<string, unknown> | undefined, text: (v: unknown) => string = String): Pair[] => Object.entries(o ?? {}).map(([key, v]) => ({ key, value: text(v) }))
const names = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean)
const filled = (r: Pair[]) => r.filter((p) => p.key.trim() !== '')
const toMap = (r: Pair[]) => Object.fromEntries(filled(r).map((p) => [p.key.trim(), p.value.trim()]))

/** A saved route into editor state. Members the editor has no box for (returns) are kept by the caller, see keepUnknown. */
export function routeToForm(r: Route): RouteForm {
  const c = r.config
  return {
    name: r.name, url: c.url, method: c.method ?? 'GET', callerInputs: Object.keys(c.params ?? {}).join(', '),
    query: rows(c.query), bodyMode: c.body === '*' ? 'all' : c.body ? 'map' : 'none', bodyMap: c.body && c.body !== '*' ? rows(c.body) : [],
    headers: rows(c.headers), defaults: rows(c.defaults, stringifyValue), required: (c.required ?? []).join(', '), pick: rows(c.pick),
    locked: rows(c.locked, stringifyValue), limits: Object.entries(c.limits ?? {}).map(([key, l]) => ({ key, value: String(l.maxLength ?? '') })),
    timeoutMs: c.timeoutMs ? String(c.timeoutMs) : '', priceUsd: r.priceUsd, rateLimitPerMin: String(r.rateLimitPerMin), enabled: r.enabled,
  }
}

export type RouteFormResult =
  | { ok: true; value: { name: string; config: RouteConfig; priceUsd: string; enabled: boolean; rateLimitPerMin: number } }
  | { ok: false; errors: Record<string, string> }

/**
 * Editor state into the API payload. Only simple mistakes are caught here, in plain words. The server decides whether the
 * route is allowed (hosted rules, secrets, locked settings), and its refusals are shown as they come.
 */
export function formToPayload(f: RouteForm, previous?: RouteConfig): RouteFormResult {
  const errors: Record<string, string> = {}
  if (!ROUTE_NAME_RE.test(f.name)) errors.name = 'Use letters, numbers and underscores, starting with a letter (up to 64 characters).'
  if (!/^https:\/\/.+/i.test(f.url.trim())) errors.url = 'The address must start with https://'
  if (!/^\d{1,12}(\.\d{1,6})?$/.test(f.priceUsd.trim())) errors.priceUsd = 'Enter a price in dollars such as 0.002, or 0 for free.'
  const rate = Number(f.rateLimitPerMin)
  if (!Number.isInteger(rate) || rate < 1 || rate > 6000) errors.rateLimitPerMin = 'Enter a whole number from 1 to 6000.'
  const timeout = f.timeoutMs.trim() === '' ? undefined : Number(f.timeoutMs)
  if (timeout !== undefined && (!Number.isInteger(timeout) || timeout < 100 || timeout > 15000)) errors.timeoutMs = 'Enter milliseconds from 100 to 15000, or leave it empty.'

  const defaults: Record<string, string | number | boolean> = {}
  for (const p of filled(f.defaults)) {
    const v = parseValue(p.value)
    if (typeof v === 'object' || v === null) errors.defaults = `Default for "${p.key}" must be text, a number or true/false.`
    else defaults[p.key.trim()] = v as string | number | boolean
  }
  const limits: Record<string, { maxLength: number }> = {}
  for (const p of filled(f.limits)) {
    const n = Number(p.value)
    if (!Number.isInteger(n) || n < 1 || n > 4096) errors.limits = `Maximum length for "${p.key}" must be a whole number from 1 to 4096.`
    else limits[p.key.trim()] = { maxLength: n }
  }
  const locked = Object.fromEntries(filled(f.locked).map((p) => [p.key.trim(), parseValue(p.value)]))
  if (Object.keys(errors).length) return { ok: false, errors }

  const config: RouteConfig = { url: f.url.trim(), ...(f.method !== 'GET' ? { method: f.method } : {}) }
  const inputs = names(f.callerInputs)
  if (inputs.length) config.params = Object.fromEntries(inputs.map((n) => [n, 'string']))
  if (filled(f.query).length) config.query = toMap(f.query)
  if (f.bodyMode === 'all') config.body = '*'
  if (f.bodyMode === 'map' && filled(f.bodyMap).length) config.body = toMap(f.bodyMap)
  if (filled(f.headers).length) config.headers = toMap(f.headers)
  if (Object.keys(defaults).length) config.defaults = defaults
  if (names(f.required).length) config.required = names(f.required)
  if (filled(f.pick).length) config.pick = toMap(f.pick)
  if (Object.keys(locked).length) config.locked = locked
  if (Object.keys(limits).length) config.limits = limits
  if (timeout !== undefined) config.timeoutMs = timeout
  // the editor has no box for the manifest's "returns" description: keep what was saved
  if (previous?.returns) config.returns = previous.returns
  return { ok: true, value: { name: f.name, config, priceUsd: f.priceUsd.trim(), enabled: f.enabled, rateLimitPerMin: rate } }
}
