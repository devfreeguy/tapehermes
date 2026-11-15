/**
 * The dashboard's Content Security Policy. Strict on purpose:
 *  - scripts only from this origin, with a per-request nonce (no third-party scripts, no 'unsafe-inline', no 'unsafe-eval' in production)
 *  - the only place the page may send data is itself and the TapeHermes API
 *  - no frames, no plugins, no other origin may embed it
 * Inline style ATTRIBUTES are allowed (the component library sets some); they cannot run script.
 */
export interface CspOptions {
  nonce: string
  /** The API origin the page calls, for example https://api.example.org. */
  apiOrigin: string
  dev?: boolean
}

export function buildCsp({ nonce, apiOrigin, dev = false }: CspOptions): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self' ${apiOrigin}${dev ? ' ws://localhost:* ws://127.0.0.1:*' : ''}`,
    "frame-src 'none'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ['upgrade-insecure-requests']),
  ]
  return directives.join('; ')
}

/** A fresh, unguessable nonce for one request. */
export function makeNonce(): string {
  return btoa(crypto.randomUUID())
}
