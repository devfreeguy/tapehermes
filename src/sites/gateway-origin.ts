import { parseTapeName } from '@tapeapi/sdk'

/**
 * Browser Origin of a site served by the public TapeKit gateway.
 * Rule from TapeKit kernel/src/name.js formatHostLabel (commit 37c617e): `<tokenId>-<area>-<processor>` for a site
 * on an L2 (X Layer area 2), `<tokenId>-<processor>` on BNB. The `-open` variant is the server-side compatibility tier
 * (sw-gateway/README.md, serve.js OPEN_SUFFIX) used by in-app browsers that cannot install a Service Worker.
 */
export function gatewayOrigins(siteName: string, domain = 'tapekit.org'): string[] {
  const p = parseTapeName(siteName)
  if (!p || 'error' in p) throw new Error(`bad site name ${siteName}`)
  const label = [p.tokenId, ...(p.area == null ? [] : [p.area]), p.processor].join('-')
  return [`https://${label}.${domain}`, `https://${label}-open.${domain}`]
}
