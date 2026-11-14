import { manifestMethods } from '../web2-adapter/adapter.mjs'
import type { AdapterConfig } from '../worker/hosted-methods.js'

export interface ManifestSite {
  name: string
  circuits: string
  tokenId: string
  container: string
  signerAddress: string
}
export interface ManifestRoute { name: string; config: unknown; priceUsd: string | number; enabled: boolean }
export interface ManifestInput {
  site: ManifestSite
  routes: ManifestRoute[]
  /** The holder-signed delegation (expires = unix seconds). null in dev mode. */
  delegation: { expires: number; sig: string } | null
  /** x402 network the USD prices are charged on, e.g. eip155:196. */
  network: string
  publicBaseUrl: string
  /** Dev manifests carry no delegation and a zero escrow; the library accepts that only with dev. */
  dev?: boolean
}

/** Largest manifest we will produce: clients read at most 64 KiB (TAP-11), and one publish chunk holds 24,000 bytes. */
export const MAX_MANIFEST_BYTES = 60_000

const ZERO = '0x0000000000000000000000000000000000000000'
/** A price as a plain decimal string: "0", "0.002", never exponent notation. */
const priceText = (v: string | number): string => {
  const s = typeof v === 'number' ? v.toFixed(6) : String(v)
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') || '0' : s
}

/**
 * The TAP-11 manifest of a site, built from its routes and delegation.
 *  - Every route is free in the standard `priceBEM` ("0"): the BEM escrow exists only on BNB, not on X Layer.
 *  - Our own USD prices live in ONE namespaced member, `tapehermes`, which TAP-11 section 3.1 tells clients to ignore:
 *    { v, currency: "USD", x402: { network }, price: { <route>: "<usd>" } }.
 *  - No `payTo` is published: the 402 answer carries the receiver for each call.
 */
export function buildSiteManifest(i: ManifestInput) {
  const enabled = i.routes.filter((r) => r.enabled)
  const config: AdapterConfig = { methods: Object.fromEntries(enabled.map((r) => [r.name, r.config])) }
  const methods = manifestMethods(config) as { name: string; priceBEM: string; params: object; returns: object }[]
  return {
    tapeapi: '0.1',
    name: i.site.name,
    circuits: i.site.circuits,
    tokenId: i.site.tokenId,
    container: i.site.container,
    signer: i.site.signerAddress,
    delegation: i.delegation ? { expires: i.delegation.expires, sig: i.delegation.sig } : null,
    endpoints: { live: [`${i.publicBaseUrl}/sites/${i.site.name}/tapeapi/v1`], async: false },
    methods: methods.map((m) => ({ ...m, priceBEM: '0' })),
    payment: i.dev ? { escrow: ZERO, unit: 'BEM', decimals: 8 } : { unit: 'BEM', decimals: 8 },
    tapehermes: {
      v: 1,
      currency: 'USD',
      x402: { network: i.network },
      price: Object.fromEntries(enabled.map((r) => [r.name, priceText(r.priceUsd)])),
    },
    ...(i.dev ? { dev: true } : {}),
  }
}
export type SiteManifest = ReturnType<typeof buildSiteManifest>
