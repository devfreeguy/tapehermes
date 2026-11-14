// Follow-ups 1 and 2 (live, X Layer TESTNET, real OKX facilitator):
//  1. two sites, two different receivers chosen by the payTo function; each address must receive exactly its own payment
//  2. who paid the gas for the settlement transactions, and did the payer's OKB balance change
import { privateKeyToAccount } from 'viem/accounts'
import { sig } from '@tapeapi/sdk'
import { buyerFetch } from '../src/payments/buyer-fetch.js'
import { inspectTx } from '../src/payments/inspect-tx.js'
import { nativeBalance, tokenBalance } from '../src/payments/token-balance.js'
import { testnetClient } from '../src/payments/chain-client.js'
import { requireEnv } from '../src/shared/env.js'
import { expect, info, step } from '../src/shared/log.js'
import { startPaidDemo } from './lib/paid-demo.js'

const ASSET = '0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c'
// Settlement transactions of the two payments made earlier (async and sync runs of proof 5).
const PRIOR = ['0x58fd862f8ba2e6f4912c3516054bc36ad3bd595305d5ce0aae9583614badb40a', '0x7855c6407c5c9f8cf015574fc78968b460ea46ea2bd90ffcbfd6af81a8519f8e'] as const
const payer = privateKeyToAccount(requireEnv('TESTNET_PRIVATE_KEY') as `0x${string}`)
// Fresh receiver addresses (their keys are discarded; testnet funds sent there are not recoverable, 0.001 each).
const newAddress = () => sig.privateKeyToAddress(sig.randomPrivateKey()) as `0x${string}`
const receivers = { alpha: newAddress(), beta: newAddress() }

const poll = async <T>(read: () => Promise<T>, done: (v: T) => boolean, tries = 12) => {
  let v = await read()
  for (let i = 0; i < tries && !done(v); i++) { await new Promise((r) => setTimeout(r, 2500)); v = await read() }
  return v
}

step('follow-up 2a: gas payer of the two earlier settlement transactions')
for (const hash of PRIOR) {
  const t = await inspectTx(hash)
  info(`${hash}`)
  info(`  block ${t.block} from ${t.from} to ${t.to} status ${t.status} gasUsed ${t.gasUsed} fee ${t.feeWei} wei`)
  info(`  sender is the payer: ${t.from.toLowerCase() === payer.address.toLowerCase()}`)
  const [before, at] = [await nativeBalance(payer.address, t.block - 1n).catch((e: Error) => `unavailable (${e.message.slice(0, 60)})`),
    await nativeBalance(payer.address, t.block).catch((e: Error) => `unavailable (${e.message.slice(0, 60)})`)]
  info(`  payer OKB at block ${t.block - 1n}: ${before}   at block ${t.block}: ${at}`)
}

step('follow-up 1: two sites, two receivers, real OKX settlement (sync mode)')
const demo = await startPaidDemo({ syncSettle: true, receivers })
const bal = async () => ({
  alpha: await tokenBalance(ASSET, receivers.alpha), beta: await tokenBalance(ASSET, receivers.beta),
  payer: await tokenBalance(ASSET, payer.address), okb: await nativeBalance(payer.address),
})
const before = await bal()
info(`receivers: alpha ${receivers.alpha}  beta ${receivers.beta}`)
info(`before: alpha ${before.alpha} beta ${before.beta} payer ${before.payer} payerOKB ${before.okb}`)

const fetchPaid = buyerFetch(payer)
const hashes: Record<string, `0x${string}`> = {}
for (const site of ['alpha', 'beta'] as const) {
  const unpaid = await fetch(demo.urlOf(site), { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"id":"u","params":{}}' })
  const asked = JSON.parse(Buffer.from(unpaid.headers.get('payment-required') ?? '', 'base64').toString()).accepts[0].payTo
  expect(asked.toLowerCase() === receivers[site].toLowerCase(), `${site}: the 402 asks for ${site}'s own receiver`)
  const res = await fetchPaid(demo.urlOf(site), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: site, params: {} }) })
  const settle = JSON.parse(Buffer.from(res.headers.get('payment-response') ?? '', 'base64').toString())
  info(`${site}: HTTP ${res.status} status ${settle.status} tx ${settle.transaction}`)
  expect(res.status === 200 && settle.success === true, `${site}: paid call accepted`)
  hashes[site] = settle.transaction
}

const after = await poll(bal, (v) => v.alpha - before.alpha === 1000n && v.beta - before.beta === 1000n && v.payer < before.payer)
info(`after:  alpha ${after.alpha} beta ${after.beta} payer ${after.payer} payerOKB ${after.okb}`)
expect(after.alpha - before.alpha === 1000n, 'alpha received exactly its payment (+1000)')
expect(after.beta - before.beta === 1000n, 'beta received exactly its payment (+1000)')
expect(before.payer - after.payer === 2000n, 'payer paid exactly 2000 in total')

step('follow-up 2b: gas payer of the two new settlement transactions')
const client = testnetClient()
for (const [site, hash] of Object.entries(hashes)) {
  await client.waitForTransactionReceipt({ hash })
  const t = await inspectTx(hash)
  info(`${site} ${hash}`)
  info(`  block ${t.block} from ${t.from} to ${t.to} status ${t.status} gasUsed ${t.gasUsed} fee ${t.feeWei} wei`)
  info(`  sender is the payer: ${t.from.toLowerCase() === payer.address.toLowerCase()}`)
}
info(`payer OKB before ${before.okb} after ${after.okb} change ${after.okb - before.okb} wei`)
await demo.stop()
