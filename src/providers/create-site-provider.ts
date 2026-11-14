import { createProvider } from '@tapeapi/server'
import { sig, rpcUrlsFor } from '@tapeapi/sdk'
import { buildDevManifest } from './build-manifest.js'

type ProviderOpts = Parameters<typeof createProvider>[0]

export interface SiteProviderInput {
  name: string
  circuits: string
  tokenId: string
  container: string
  chainId: number
  methods: NonNullable<ProviderOpts['methods']>
  signerKey?: string
  manifestMethods?: { name: string; priceBEM: string; params: object; returns: object }[]
  rpcUrls?: string[]
  /** Public URL of this site TapeAPI endpoint, as published in the manifest. */
  endpoint?: string
  /** The manifest to serve, built by manifest-builder (TapeHermes). Without it the Phase 0 dev manifest is used. */
  manifest?: Record<string, unknown>
  /** Library dev mode. true (default, Phase 0 proofs): dev manifest allowed. false: a real delegation is expected. */
  dev?: boolean
}

/** One provider (one signer) for one site. Dev mode: see FINDINGS.md for what it skips. */
export function createSiteProvider(i: SiteProviderInput) {
  const signerKey = i.signerKey ?? sig.randomPrivateKey()
  const signer = sig.privateKeyToAddress(signerKey)
  const manifest = i.manifest ?? buildDevManifest({
    ...i,
    signer,
    endpoint: i.endpoint ?? `http://127.0.0.1:1/sites/${i.name}/tapeapi/v1`,
    methods: i.manifestMethods ?? Object.keys(i.methods).map((name) => ({ name, priceBEM: '0', params: {}, returns: {} })),
  })
  const rpcUrls = i.rpcUrls ?? rpcUrlsFor(i.chainId)
  return createProvider({
    manifest, signerKey, dev: i.dev ?? true, chainId: i.chainId, methods: i.methods,
    rpcUrls, quorum: Math.min(2, rpcUrls.length), allowSingleNode: true,
  })
}
