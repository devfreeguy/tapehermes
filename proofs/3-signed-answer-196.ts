// Proof 3: web2-adapter in hosted mode returns a TAP-13 signed answer for a site on X Layer (196), verified by the SDK.
import { readFile } from 'node:fs/promises'
import { rpcUrlsFor } from '@tapeapi/sdk'
import { startApp } from '../src/bootstrap.js'
import { createSiteProvider } from '../src/providers/create-site-provider.js'
import { hostedMethods, type AdapterConfig } from '../src/worker/hosted-methods.js'
import { readSite } from '../src/chain/read-site.js'
import { callSite } from '../src/sites/call-site.js'
import { probeRpc } from '../src/sites/probe-rpc.js'
import { env } from '../src/shared/env.js'
import { toJson } from '../src/shared/json.js'
import { expect, info, step } from '../src/shared/log.js'

const config: AdapterConfig = JSON.parse(await readFile('proofs/fixtures/adapter.config.json', 'utf8'))
const siteName = env('XLAYER_SITE', '1.2.396.tape')

step('X Layer RPC operators: 3 timed probes each')
for (const url of rpcUrlsFor(196)) {
  const rows = [await probeRpc(url), await probeRpc(url), await probeRpc(url)]
  info(`${new URL(url).hostname.padEnd(22)} ${rows.map((r) => (r.ok ? `${r.ms}ms` : `ERR(${r.error})`)).join('  ')}`)
}

step(`read ${siteName} on chain 196 (read only)`)
const t0 = Date.now()
const facts = await readSite(siteName, 196)
info(`${Date.now() - t0} ms  ${toJson(facts, 0)}`)
expect(facts.chainId === 196 && facts.container.startsWith('0x'), 'site resolves on chain 196')

step('hosted-mode adapter: a signed answer for that site')
const { handlers, manifestMethods } = hostedMethods(config)
const { registry, base, stop } = await startApp()
const provider = createSiteProvider({ ...facts, name: siteName, methods: handlers, manifestMethods })
registry.add('xl', provider)
registry.publishAt(base)
const { svc, answer } = await callSite(`${base}/sites/xl`, 'fxRate', { to: 'JPY' })
info(`container ${svc.manifest.container} signer ${svc.manifest.signer}`)
info(`result ${toJson(answer.result, 0)}`)
expect(svc.manifest.container === facts.container, 'answer is bound to the real container of the X Layer site')
expect(answer.verified === true && (answer.result as any).rates?.JPY > 0, 'SDK verified the TAP-13 signature, upstream data present')

step('hosted rules refuse unsafe settings')
const bad = (url: string) => { try { hostedMethods({ methods: { m: { priceBEM: '0', url, method: 'GET' } } }); return 'ALLOWED' } catch (e: any) { return e.message } }
for (const u of ['http://api.frankfurter.dev/x', 'https://localhost/x', 'https://127.0.0.1/x', 'https://api.frankfurter.dev:8443/x']) {
  expect(bad(u) !== 'ALLOWED', `refused ${u}: ${bad(u).slice(0, 70)}`)
}
step('SDK client WITH chain RPCs resolving the dev manifest (what does dev skip?)')
try {
  const r = await callSite(`${base}/sites/xl`, 'fxRate', {}, rpcUrlsFor(196))
  info(`resolved with chain reads: verified=${r.answer.verified} svc.verified=${toJson(r.svc.verified, 0)}`)
} catch (e: any) { info(`rejected: ${e.code}: ${e.message}`) }
await stop()
