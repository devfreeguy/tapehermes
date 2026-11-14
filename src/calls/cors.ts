/**
 * Our own CORS for everything under /sites/. The provider's built-in CORS allows only content-type and accept
 * (Phase 0 proof 7), which blocks the x402 retry. A browser needs:
 *  - to be ALLOWED to send the payment request header (PAYMENT-SIGNATURE, and the older X-PAYMENT), and
 *  - to be able to READ the payment response headers (exposed).
 */
export const CORS_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, accept, payment-signature, x-payment',
  'access-control-expose-headers': 'payment-required, payment-response, x-payment-response',
  'access-control-max-age': '600',
})

export const preflight = (): Response => new Response(null, { status: 204, headers: { ...CORS_HEADERS } })

/** The same response with our CORS headers replacing whatever CORS headers it carried. */
export function withCors(r: Response): Response {
  const headers = new Headers(r.headers)
  for (const k of [...headers.keys()]) if (k.startsWith('access-control-')) headers.delete(k)
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v)
  return new Response(r.body, { status: r.status, statusText: r.statusText, headers })
}
