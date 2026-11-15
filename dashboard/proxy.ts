import { NextResponse, type NextRequest } from 'next/server'
import { API_URL } from '@/config/app'
import { buildCsp, makeNonce } from '@/lib/csp'

/** Gives every page its own CSP nonce (Next 16 "proxy", the former middleware). */
export function proxy(request: NextRequest) {
  const nonce = makeNonce()
  const csp = buildCsp({ nonce, apiOrigin: new URL(API_URL).origin, dev: process.env.NODE_ENV === 'development' })
  const headers = new Headers(request.headers)
  headers.set('x-nonce', nonce)
  headers.set('content-security-policy', csp)
  const response = NextResponse.next({ request: { headers } })
  response.headers.set('content-security-policy', csp)
  return response
}

export const config = {
  matcher: [{ source: '/((?!_next/static|_next/image|favicon.ico).*)', missing: [{ type: 'header', key: 'next-router-prefetch' }, { type: 'header', key: 'purpose', value: 'prefetch' }] }],
}
