import { TapeAPIError } from '@tapeapi/sdk'

/**
 * Owner-locked route settings, applied in OUR layer before the adapter runs (the adapter file is untouched).
 *
 * The adapter lets a caller override any default, so an owner could not pin a model, a limit or a count. Two
 * optional members of a route's settings fix that:
 *   locked: { <param>: <value> }        always sent; a caller who sends that parameter is refused (no outside call)
 *   limits: { <param>: { maxLength } }  a caller value for that parameter must be a string of at most maxLength characters
 * Both only say WHICH values may come from whom. Where a value goes (query, body, path) is still the route's own
 * `query`, `body` and url template: a locked parameter must be used there, and this module checks that at save time.
 */
export interface LockableMethod {
  url?: string
  params?: Record<string, string>
  defaults?: Record<string, unknown>
  query?: Record<string, string>
  body?: '*' | Record<string, string>
  required?: string[]
  locked?: Record<string, unknown>
  limits?: Record<string, { maxLength?: number }>
}

const has = (o: object | undefined, k: string) => !!o && Object.prototype.hasOwnProperty.call(o, k)
const PARAM_RE = /\{([A-Za-z0-9_]+)\}/g
const isPrimitive = (v: unknown) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'

/** The parameter names the adapter will honour: the same set it computes (params, query, body, url template, defaults). */
export function declaredParams(m: LockableMethod): Set<string> {
  return new Set([
    ...Object.keys(m.params ?? {}), ...Object.values(m.query ?? {}), ...(m.body && m.body !== '*' ? Object.values(m.body) : []),
    ...[...String(m.url ?? '').matchAll(PARAM_RE)].map((x) => x[1]), ...Object.keys(m.defaults ?? {}),
  ])
}

/** Where a parameter ends up, so a locked value can be checked against what that place accepts. */
const usedIn = (m: LockableMethod, name: string) => ({
  query: Object.values(m.query ?? {}).includes(name),
  path: [...String(m.url ?? '').matchAll(PARAM_RE)].some((x) => x[1] === name),
  body: m.body === '*' ? has(m.params, name) : Object.values(m.body ?? {}).includes(name),
})

/** Reasons the locked and limit settings of one method cannot be used. Empty = fine. Plain words, no secrets. */
export function lockedProblems(m: LockableMethod): string[] {
  const out: string[] = []
  const declared = declaredParams(m)
  for (const [name, value] of Object.entries(m.locked ?? {})) {
    const u = usedIn(m, name)
    if (!u.query && !u.path && !u.body) out.push(`locked setting "${name}" is not used by this route (add it to query, body or the url), so nothing would send it`)
    if ((u.query || u.path) && !isPrimitive(value)) out.push(`locked setting "${name}" goes into the url, so it must be a text, number or true/false value`)
    if (m.body === '*' && !has(m.params, name)) out.push(`locked setting "${name}" must also be listed in params when the body is "*"`)
    if (has(m.defaults, name)) out.push(`"${name}" cannot be both locked and a default`)
    if (has(m.limits, name)) out.push(`"${name}" cannot be both locked and limited: a locked value is never taken from a caller`)
    if (!declared.has(name)) out.push(`locked setting "${name}" is unknown to the route`)
  }
  for (const name of Object.keys(m.limits ?? {})) {
    if (!declared.has(name)) out.push(`limit on "${name}": no such parameter in this route`)
  }
  return out
}

/** Names a caller may send: everything the route declares except the locked ones. */
export const callerParams = (m: LockableMethod): string[] => [...declaredParams(m)].filter((p) => !has(m.locked, p))

type Handler = (params: unknown) => Promise<unknown>

/**
 * Wrap an adapter handler. A caller who sets a locked parameter, or breaks a limit, is refused with BAD_REQUEST BEFORE the
 * adapter (and so before any outside call). Locked values are then added and always win.
 */
export function withLocked(handler: Handler, m: LockableMethod): Handler {
  const locked = m.locked ?? {}
  const limits = m.limits ?? {}
  if (!Object.keys(locked).length && !Object.keys(limits).length) return handler
  return async (params) => {
    if (params && typeof params === 'object' && !Array.isArray(params)) {
      for (const k of Object.keys(locked)) {
        if (has(params as object, k)) throw new TapeAPIError('BAD_REQUEST', `parameter "${k}" is fixed by the site owner and cannot be set`)
      }
      for (const [k, rule] of Object.entries(limits)) {
        if (!has(params as object, k)) continue
        const v = (params as Record<string, unknown>)[k]
        if (typeof v !== 'string') throw new TapeAPIError('BAD_REQUEST', `parameter "${k}" must be text`)
        if (rule.maxLength !== undefined && v.length > rule.maxLength) throw new TapeAPIError('BAD_REQUEST', `parameter "${k}" is too long (at most ${rule.maxLength} characters)`)
      }
      return handler({ ...(params as object), ...locked })
    }
    return handler(params) // not an object: the adapter refuses it with its own message
  }
}
