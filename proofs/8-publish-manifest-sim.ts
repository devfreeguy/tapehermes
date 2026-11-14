// Proof 8: build the manifest-publish transaction with the SDK and simulate it read-only (nothing is sent).
// The sender is set to the site's current holder in eth_call / eth_estimateGas. No private key touches mainnet.
import { createTapeAPI, rpcUrlsFor, sig } from '@tapeapi/sdk'
import { readSite } from '../src/chain/read-site.js'
import { rpcCall, type RpcReply } from '../src/sites/rpc-call.js'
import { toJson } from '../src/shared/json.js'
import { env } from '../src/shared/env.js'
import { expect, info, step } from '../src/shared/log.js'

const siteName = env('XLAYER_SITE', '1.2.396.tape')
const urls = rpcUrlsFor(196)
const api = createTapeAPI({ chainId: 196, rpcUrls: urls, quorum: 2, quiet: true })
const facts = await readSite(siteName, 196)
const { hub, siteRegistry } = api.addresses
info(`site ${facts.name} holder ${facts.holder} container ${facts.container} siteRegistry ${siteRegistry}`)

step('build the transaction(s) with the SDK')
// PLACEHOLDER delegation: signed by a throwaway key, NOT by the holder. Only the calldata is simulated; the
// contract does not look at manifest content. A real publish needs the holder's own signature here.
const signerKey = sig.randomPrivateKey()
const expires = Math.floor(Date.now() / 1000) + 30 * 86400
const signer = sig.privateKeyToAddress(signerKey)
const delegationSig = sig.signDigest(sig.delegationDigest(196, hub, { container: facts.container, signer, expires }), signerKey)
const manifest = {
  tapeapi: '0.1', name: facts.name, circuits: facts.circuits, tokenId: facts.tokenId, container: facts.container, signer,
  delegation: { expires, sig: delegationSig },
  endpoints: { live: [`https://hermes.example.com/sites/${facts.name}/tapeapi/v1`], async: false },
  methods: [{ name: 'fxRate', priceBEM: '0', params: { to: 'string' }, returns: { rates: 'object' } }],
  payment: { escrow: '0x0000000000000000000000000000000000000000', unit: 'BEM', decimals: 8 },
}
let built: ReturnType<typeof api.tx.publishManifest>
try { built = api.tx.publishManifest({ container: facts.container, manifest }) } catch (e: any) {
  info(`publishManifest refused the manifest: ${e.code}: ${e.message}`)
  throw e
}
info(`${built.txs.length} tx, ${built.size} bytes, key ${built.key}, sha256 ${built.sha256Hash}`)
expect(built.txs.length === 1 && built.txs[0].to.toLowerCase() === siteRegistry.toLowerCase(), 'one putFile transaction to the SiteRegistry')

step('read-only simulation, sender = current holder (each operator)')
const t = built.txs[0]
const call = (from: string) => ({ from, to: t.to, data: t.data, value: '0x0' })
for (const url of [urls[0], urls[2]]) {
  const host = new URL(url).hostname
  const sim = await rpcCall(url, 'eth_call', [call(facts.holder), 'latest']).catch((e): RpcReply => ({ error: e.message }))
  const gas = await rpcCall(url, 'eth_estimateGas', [call(facts.holder)]).catch((e): RpcReply => ({ error: e.message }))
  const price = await rpcCall(url, 'eth_gasPrice', []).catch((e): RpcReply => ({ error: e.message }))
  info(`${host}: eth_call ${sim.error ?? 'ok ' + sim.result}`)
  info(`${host}: estimateGas ${gas.error ?? parseInt(gas.result!, 16)}  gasPrice ${price.error ?? parseInt(price.result!, 16) + ' wei'}`)
}

step('negative control: sender = a random address (should be refused: onlyEditor)')
const stranger = sig.privateKeyToAddress(sig.randomPrivateKey())
const neg = await rpcCall(urls[0], 'eth_call', [call(stranger), 'latest'])
info(`stranger eth_call: ${neg.error ?? 'NO REVERT ' + neg.result}`)

step('site state (preconditions)')
const fi = await api.chain.fileInfo(facts.container, '.well-known/tapeapi.json').catch((e: any) => `error ${e.code}`)
info(`existing manifest file: ${toJson(fi, 0)}`)
const st = await api.siteStatus(siteName)
info(`opened=${st.opened} activation=${toJson(st.activation, 0)}`)
