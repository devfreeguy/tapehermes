import type { RequestHandler } from 'express'

/**
 * CORS for the management API (/api) only. The dashboard lives on another origin and sends a bearer token in the
 * Authorization header, so there are no cookies and no credentials mode. Only origins listed in CORS_ORIGINS get
 * headers; any other origin gets none, so the browser blocks the call. The public site routes (/sites) have their own CORS.
 */
export function apiCors(origins: string[]): RequestHandler {
  const allowed = new Set(origins)
  return (req, res, next) => {
    const origin = req.headers.origin
    res.setHeader('vary', 'Origin')
    if (typeof origin === 'string' && allowed.has(origin)) {
      res.setHeader('access-control-allow-origin', origin)
      res.setHeader('access-control-allow-headers', 'authorization, content-type')
      res.setHeader('access-control-allow-methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
      res.setHeader('access-control-expose-headers', 'retry-after')
      res.setHeader('access-control-max-age', '600')
    }
    if (req.method === 'OPTIONS') { res.status(204).end(); return }
    next()
  }
}

/** One allowed origin: scheme + host (+ port), no path. https only in production; http only for localhost. */
export function checkOrigin(value: string, production: boolean): string {
  let u: URL
  try { u = new URL(value) } catch { throw new Error('CORS_ORIGINS must hold full origins like https://dashboard.example.org') }
  if (u.origin !== value) throw new Error('CORS_ORIGINS entries must be an origin only: scheme, host and optional port, no path or trailing slash')
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local && !production)) throw new Error('CORS_ORIGINS must be https (http is accepted for localhost outside production)')
  return value
}
