// Proofs 5 (script half), 6 and the final check, in one run against X Layer TESTNET (eip155:1952).
// Usage: pnpm proof:5 -- async   |   pnpm proof:5 -- sync     (OKX facilitator settle mode)
// Needs www.okx.com reachable. Nothing here touches mainnet.
import { decodePaymentResponseHeader } from '@okxweb3/x402-fetch'
import { privateKeyToAccount } from 'viem/accounts'
import { buyerFetch } from '../src/payments/buyer-fetch.js'
import { tokenBalance, txReceiptTime } from '../src/payments/token-balance.js'
import { verifyEnvelope, type Envelope } from '../src/sites/verify-envelope.js'
import { requireEnv } from '../src/shared/env.js'
import { toJson } from '../src/shared/json.js'
import { expect, info, step } from '../src/shared/log.js'
import { startPaidDemo } from './lib/paid-demo.js'

const mock = process.argv.includes('mock') // local mock facilitator: OKX not involved
const mode = process.argv.includes('sync') ? 'sync' : 'async'
const ASSET = '0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c' // default testnet asset in @okxweb3/x402-evm source
const account = privateKeyToAccount(requireEnv('TESTNET_PRIVATE_KEY') as `0x${string}`)
const demo = await startPaidDemo({ syncSettle: mode === 'sync', mock })
const receiver = demo.payTo as `0x${string}`
const bal = async (a: `0x${string}`) => mock ? null : tokenBalance(ASSET, a).catch((e: Error) => { info(`balance read failed: ${e.message.slice(0, 100)}`); return null })

step(`balances before (payer ${account.address}, receiver ${receiver})`)
const before = { payer: await bal(account.address), receiver: await bal(receiver) }
info(`payer ${before.payer}  receiver ${before.receiver}  (6 decimals)`)

step(`unpaid call returns 402 (settle mode ${mode}${mock ? ", MOCK facilitator: not OKX" : ""})`)
const body = JSON.stringify({ id: 'p5', params: {} })
const unpaid = await fetch(demo.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body })
expect(unpaid.status === 402, 'paid route answers 402 without payment')

step('paid call through @okxweb3/x402-fetch (private key signer)')
const t0 = Date.now()
const res = await buyerFetch(account)(demo.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body })
const tResponse = Date.now() - t0
const header = res.headers.get('payment-response')
const settle: any = header ? decodePaymentResponseHeader(header) : null
info(`HTTP ${res.status} after ${tResponse} ms; PAYMENT-RESPONSE ${toJson(settle, 0)}`)
expect(res.status === 200 && settle?.success === true, mock ? 'payment accepted by the MOCK facilitator (fake tx hash, nothing settled, no funds moved)' : 'payment accepted and settled by the facilitator')

step('final check: the answer is signed by the site provider and verifies on the buyer side')
const env = (await res.json()) as Envelope
expect(verifyEnvelope(env, 'paid', {}, demo.registry.get('demo')!.signer), 'TAP-13 signature verifies against the site signer')

step('proof 6 data: on-chain confirmation time and balance change')
if (settle?.transaction && !mock) {
  const rc = await txReceiptTime(settle.transaction).catch((e: Error) => { info(`receipt not observed: ${e.message.slice(0, 100)}`); return null })
  if (rc) info(`mined in block ${rc.blockNumber} ${Date.now() - t0} ms after the request started; status ${rc.status}; gasUsed ${rc.gasUsed}`)
}
const after = { payer: await bal(account.address), receiver: await bal(receiver) }
info(`payer delta ${before.payer !== null && after.payer !== null ? after.payer - before.payer : 'not observed'}  receiver delta ${before.receiver !== null && after.receiver !== null ? after.receiver - before.receiver : 'not observed'}  (price $0.001 = 1000 units)`)
await demo.stop()
