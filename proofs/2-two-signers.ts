// Proof 2: two signers for two sites in one Nest process, each on its own path; neither can sign for the other.
import { createProvider } from '@tapeapi/server'
import { sig } from '@tapeapi/sdk'
import { startApp } from '../src/bootstrap.js'
import { createSiteProvider } from '../src/providers/create-site-provider.js'
import { buildDevManifest } from '../src/providers/build-manifest.js'
import { callSite } from '../src/sites/call-site.js'
import { verifyEnvelope } from '../src/sites/verify-envelope.js'
import { toJson } from '../src/shared/json.js'
import { expect, info, step } from '../src/shared/log.js'

const site = (n: number) => ({
  name: `site${n}`, circuits: '0x0000000000000000000000000000000000000000', tokenId: String(n),
  container: `0x${String(n).repeat(40)}`, chainId: 196, rpcUrls: [],
  methods: { who: async () => ({ site: n }) },
})

const { registry, base, stop } = await startApp()
const a = createSiteProvider(site(1))
const b = createSiteProvider(site(2))
registry.add('site1', a)
registry.add('site2', b)
registry.publishAt(base)

step('each site answers on its own path with its own signer')
expect(a.signer !== b.signer, `signers differ: ${a.signer} vs ${b.signer}`)
for (const [n, p] of [[1, a], [2, b]] as const) {
  const { svc, answer } = await callSite(`${base}/sites/site${n}`, 'who')
  expect((answer.result as any).site === n, `site${n} returned its own result`)
  expect(svc.manifest.signer === p.signer && answer.verified === true, `site${n} answer verified against site${n} signer`)
}

step('an answer from site1 cannot pass as site2')
const raw = await fetch(`${base}/sites/site1/tapeapi/v1/who`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 'x1', params: {} }),
}).then((r) => r.json())
info(`raw envelope: ${toJson(raw, 0).slice(0, 400)}`)
expect(verifyEnvelope(raw, 'who', {}, a.signer), 'signature belongs to site1 signer for site1 container')
expect(!verifyEnvelope({ ...raw, container: b.container }, 'who', {}, b.signer), 'same signature does not verify as site2 (site2 signer, site2 container)')

step('a provider refuses a signer key that is not the manifest signer')
const m = buildDevManifest({ name: 'site2', circuits: site(2).circuits, tokenId: '2', container: b.container, signer: b.signer, endpoint: 'http://127.0.0.1:1/x', methods: [{ name: 'who', priceBEM: '0', params: {}, returns: {} }] })
let refused = ''
try { createProvider({ manifest: m, signerKey: sig.randomPrivateKey(), dev: true, methods: { who: async () => ({}) } }) } catch (e: any) { refused = e.code }
expect(refused === 'BAD_KEY', `createProvider refused with ${refused}`)
await stop()
