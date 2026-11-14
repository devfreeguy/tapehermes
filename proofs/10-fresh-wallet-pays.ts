// Follow-up: a brand-new wallet with ZERO OKB and only the token pays through real OKX (testnet).
// Reads the throwaway key from .fresh-wallet.json (git-ignored, created by us). Needs it funded with test USD₮0 only.
import { readFileSync } from 'node:fs'
import { privateKeyToAccount } from 'viem/accounts'
import { buyerFetch } from '../src/payments/buyer-fetch.js'
import { inspectTx } from '../src/payments/inspect-tx.js'
import { nativeBalance, tokenBalance } from '../src/payments/token-balance.js'
import { testnetClient } from '../src/payments/chain-client.js'
import { expect, info, step } from '../src/shared/log.js'
import { startPaidDemo } from './lib/paid-demo.js'

const ASSET = '0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c'
const { privateKey } = JSON.parse(readFileSync('.fresh-wallet.json', 'utf8'))
const wallet = privateKeyToAccount(privateKey)

step(`fresh wallet ${wallet.address}`)
const tok0 = await tokenBalance(ASSET, wallet.address)
const okb0 = await nativeBalance(wallet.address)
info(`before: token ${tok0}  OKB ${okb0}`)
if (tok0 < 1000n) { info('NOT FUNDED: needs at least 1000 units (0.001) of test USD₮0 at the token above. Stopping.'); process.exit(2) }
expect(okb0 === 0n, 'wallet holds zero OKB (cannot pay gas)')

step('paid call, sync settle, real OKX facilitator')
const demo = await startPaidDemo({ syncSettle: true })
const res = await buyerFetch(wallet)(demo.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 'fresh', params: {} }) })
const settle = JSON.parse(Buffer.from(res.headers.get('payment-response') ?? '', 'base64').toString())
info(`HTTP ${res.status} status ${settle.status} tx ${settle.transaction}`)
expect(res.status === 200 && settle.success === true, 'zero-OKB wallet paid successfully')
await testnetClient().waitForTransactionReceipt({ hash: settle.transaction })
const t = await inspectTx(settle.transaction)
info(`mined in block ${t.block} sent by ${t.from} (payer is ${wallet.address}) gasUsed ${t.gasUsed}`)
expect(t.from.toLowerCase() !== wallet.address.toLowerCase(), 'the settlement was not sent by the payer')
const tok1 = await tokenBalance(ASSET, wallet.address)
const okb1 = await nativeBalance(wallet.address)
info(`after: token ${tok1} (change ${tok1 - tok0})  OKB ${okb1} (change ${okb1 - okb0})`)
expect(tok0 - tok1 === 1000n && okb1 === 0n, 'payer lost exactly 1000 token units and still holds zero OKB')
await demo.stop()
