/** App-wide constants. Values that differ per environment come from NEXT_PUBLIC_* variables, with a local default. */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3000').replace(/\/+$/, '')

/** X Layer mainnet: the chain every TapeHermes site, delegation and manifest lives on. */
export const CHAIN_ID = 196

/** The site name format: <tokenId>.<area>.<processor>.tape, for example 1.2.396.tape */
export const SITE_NAME_RE = /^[0-9]+\.[0-9]+\.[0-9]+\.tape$/
export const ROUTE_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/
export const SECRET_NAME_RE = /^[A-Z][A-Z0-9_]{0,63}$/

/** Header names the hosted rules allow a route to send (secrets can only be placed in these). */
export const ALLOWED_HEADERS = ['accept', 'accept-language', 'authorization', 'x-api-key', 'api-key', 'x-api-token', 'x-auth-token'] as const

export const DELEGATION_DAYS = { min: 1, max: 366, default: 30 } as const
export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const
