// Phase 2 real run on X Layer TESTNET (eip155:1952). YOU trigger it:   pnpm phase2:testnet
// Dry run with a local mock facilitator and a fake upstream (no OKX, no money, no network):   pnpm phase2:testnet -- mock
//
// What it does, end to end, through the real code paths of the product:
//   1. starts the real backend (real Postgres + Redis from .env; chain-196 read stubbed, see below)
//   2. registers a throwaway site and two routes: "paid" ($0.001, a real public API) and "broken" ($0.001, an upstream 404)
//   3. the shipped helper bundle (helper/dist/tapehermes.min.js) calls "paid" with a throwaway-wallet signer:
//        402, sign, retry, REAL OKX verify + sync settle, signed answer, settlement transaction
//   4. calls "broken": the OKX verify happens, the outside call fails, and NO settle must happen
//   5. replays the first payment header: it must not settle a second time
//   6. checks the call log (paid, paymentTx, priceUsd) and the chain (the Transfer event in the settlement transaction)
// Nothing here touches mainnet. The only stub: the site holder is read from a local table instead of chain 196
// (the payment side does not depend on it). No secret value is printed.
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { parseAbi, parseEventLogs } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { x402ResourceServer } from '@okxweb3/x402-core/server'
import { ExactEvmScheme } from '@okxweb3/x402-evm/exact/server'
import { createApp } from '../src/bootstrap.js'
import { ChainService } from '../src/chain/chain.service.js'
import { PAYMENT_GATE } from '../src/calls/payment-gate.js'
import type { X402PaymentGate } from '../src/calls/x402-payment-gate.js'
import { PrismaService } from '../src/database/prisma.service.js'
import { RedisService } from '../src/redis/redis.service.js'
import { ProviderCache } from '../src/providers/provider-cache.service.js'
import { testnetClient } from '../src/payments/chain-client.js'
import { tokenBalance } from '../src/payments/token-balance.js'
import { requireEnv } from '../src/shared/env.js'
import { expect, info, step } from '../src/shared/log.js'
import { mockFacilitator } from './fixtures/mock-facilitator.js'

const mock = process.argv.includes('mock')
const ASSET = '0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c' as const // USD₮0 on X Layer testnet (default of @okxweb3/x402-evm)
const PRICE_UNITS = 1000n // $0.001
const SITE = `1.2.${Math.floor(100000 + Math.random() * 800000)}.tape`

// the run uses the TEST database, never the development one
process.env.DATABASE_URL = requireEnv('TEST_DATABASE_URL')
process.env.REDIS_PREFIX = 'tapehermes-test:'
process.env.UNSAFE_DEV_SKIP_DELEGATION = '1'

const buyerKey = existsSync('.fresh-wallet.json') ? JSON.parse(readFileSync('.fresh-wallet.json', 'utf8')).privateKey : requireEnv('TESTNET_PRIVATE_KEY')
const buyer = privateKeyToAccount(buyerKey)
const payout = privateKeyToAccount(generatePrivateKey()) // a fresh receiver: its balance can only change through this run, so the deltas are clean
const owner = privateKeyToAccount(generatePrivateKey())

function wallet() {
  let chain = 196
  return {
    request: async ({ method, params }: { method: string; params?: any[] }) => {
      if (method === 'eth_requestAccounts') return [buyer.address]
      if (method === 'eth_chainId') return '0x' + chain.toString(16)
      if (method === 'wallet_switchEthereumChain') { chain = parseInt(params![0].chainId, 16); return null }
      if (method === 'eth_signTypedData_v4') {
        const t = JSON.parse(params![1]); const { EIP712Domain: _d, ...types } = t.types; const m = t.message
        return buyer.signTypedData({ domain: t.domain, types, primaryType: t.primaryType, message: { ...m, value: BigInt(m.value), validAfter: BigInt(m.validAfter), validBefore: BigInt(m.validBefore) } } as never)
      }
      throw new Error(`unexpected wallet call ${method}`)
    },
  }
}

const started = await createApp({
  rpcUrls196: [], publicBaseUrl: 'https://api.tapehermes.test', x402Network: 'eip155:1952',
  ...(mock ? { okx: null } : {}),
})
const api = async (method: string, path: string, token?: string, body?: unknown) => {
  const r = await fetch(`${started.base}${path}`, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
  return { status: r.status, body: await r.json().catch(() => null) as any }
}

try {
  step(`setup (${mock ? 'MOCK facilitator, fake upstream: nothing real' : 'REAL OKX facilitator on eip155:1952'})`)
  info(`site ${SITE}; buyer ${buyer.address}; receiver ${payout.address} (fresh); asset ${ASSET}`)
  // stub: who holds the site (the product reads chain 196; this run does not need it)
  started.app.get(ChainService).readSite = (async (name: string) => ({ name, chainId: 196, circuits: '0x' + '11'.repeat(20), tokenId: '1', container: '0x' + '22'.repeat(20), holder: owner.address.toLowerCase() })) as never
  if (mock) {
    const facilitator = mockFacilitator('eip155:1952')
    ;(started.app.get(PAYMENT_GATE) as X402PaymentGate).useResourceServer(new x402ResourceServer(facilitator).register('eip155:1952', new ExactEvmScheme()))
    started.app.get(ProviderCache).hostedOptions = {
      resolve: async () => ['93.184.216.34'],
      fetch: (async (url: string) => new Response(String(url).includes('nonexistent') ? '{}' : JSON.stringify({ base: 'USD', date: '2026-11-14', rates: { EUR: 0.9 } }), { status: String(url).includes('nonexistent') ? 404 : 200, headers: { 'content-type': 'application/json' } })) as never,
    }
  } else {
    expect(!!process.env.OKX_API_KEY && !!process.env.OKX_SECRET_KEY && !!process.env.OKX_PASSPHRASE, 'OKX credentials are present in .env (values not shown)')
  }

  // sign in as the owner (real wallet sign-in), register, add routes
  const m = await api('POST', '/api/auth/message', undefined, { address: owner.address })
  const v = await api('POST', '/api/auth/verify', undefined, { message: m.body.message, signature: await owner.signMessage({ message: m.body.message }) })
  const token = v.body.token as string
  expect((await api('POST', '/api/sites', token, { name: SITE })).status === 200, 'site registered')
  expect((await api('PUT', `/api/sites/${SITE}/payout`, token, { payoutAddress: payout.address })).status === 200, 'payout address set to the fresh receiver')
  const cfg = (path: string) => ({ url: `https://api.frankfurter.dev/${path}`, params: { from: 'string' }, query: { from: 'from' }, pick: { base: 'base', date: 'date', rates: 'rates' }, returns: { base: 'string', date: 'string', rates: 'object' } })
  expect((await api('POST', `/api/sites/${SITE}/routes`, token, { name: 'paid', config: cfg('v1/latest'), priceUsd: '0.001' })).status === 201, 'route "paid" ($0.001, public API)')
  expect((await api('POST', `/api/sites/${SITE}/routes`, token, { name: 'broken', config: cfg('v1/nonexistent'), priceUsd: '0.001' })).status === 201, 'route "broken" ($0.001, the upstream answers 404)')

  const H = await import(pathToFileURL(resolve('helper/dist/tapehermes.min.js')).href)
  const dev = { siteUrl: `${started.base}/sites/${SITE}` }
  const read = async () => ({ buyer: mock ? 0n : await tokenBalance(ASSET, buyer.address), payout: mock ? 0n : await tokenBalance(ASSET, payout.address) })
  const before = await read()
  info(`balances before: buyer ${before.buyer}, receiver ${before.payout} (6 decimals; price = ${PRICE_UNITS})`)

  step('1. the helper pays for "paid": 402, sign, retry, verify, outside call, SETTLE, signed answer')
  let captured = ''
  const spy = (async (url: string, init?: RequestInit) => {
    const h = (init?.headers ?? {}) as Record<string, string>
    if (h['payment-signature']) captured = h['payment-signature']
    return fetch(url, init)
  }) as never
  const t0 = Date.now()
  const r = await H.createHermes({ ethereum: wallet(), dev, fetch: spy }).call('paid', { from: 'USD' })
  const ms = Date.now() - t0
  info(`answer: ${JSON.stringify(r.result).slice(0, 90)}; whole call ${ms} ms (includes OKX verify and sync settle)`)
  expect(r.verified === true && r.paid === true, 'answer verified against the site signer, and the helper reports it paid')
  expect(/^0x[0-9a-f]{64}$/i.test(r.transaction), `settlement transaction returned: ${r.transaction}`)
  const tx1 = r.transaction as `0x${string}`

  if (!mock) {
    const rc = await testnetClient().waitForTransactionReceipt({ hash: tx1, timeout: 120000 })
    expect(rc.status === 'success', `the transaction is mined (block ${rc.blockNumber}, status success)`)
    const mine = parseEventLogs({ abi: parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)']), logs: rc.logs, eventName: 'Transfer' }).filter((l) => l.address.toLowerCase() === ASSET)
    expect(mine.some((l) => l.args.from.toLowerCase() === buyer.address.toLowerCase() && l.args.to.toLowerCase() === payout.address.toLowerCase() && l.args.value === PRICE_UNITS), 'the chain shows the Transfer: buyer to receiver, exactly the price (read from the transaction events, not from a balance read)')
  }

  step('2. a call whose outside call FAILS: verified, but must NOT be settled')
  const balMid = await read()
  let failed: any = null
  try { await H.createHermes({ ethereum: wallet(), dev }).call('broken', { from: 'USD' }) } catch (e) { failed = e }
  expect(failed && failed.code, `the helper got a signed error (${failed?.code}), no answer`)
  await new Promise((res) => setTimeout(res, 4000)) // give a wrongly-sent settlement time to land before looking
  const balAfter = await read()
  if (!mock) expect(balAfter.buyer === balMid.buyer && balAfter.payout === balMid.payout, `balances unchanged after the failed call (buyer ${balAfter.buyer}, receiver ${balAfter.payout})`)

  step('3. replay: the same payment header sent again is refused by OUR guard, before the facilitator and before the outside call')
  const send = () => fetch(`${started.base}/sites/${SITE}/tapeapi/v1/paid`, { method: 'POST', headers: { 'content-type': 'application/json', 'payment-signature': captured }, body: JSON.stringify({ id: `replay-${Math.random()}`, params: { from: 'USD' } }) })
  const replay = await send()
  const replayCode = ((await replay.json().catch(() => null)) as any)?.error?.code
  info(`replay answered HTTP ${replay.status} ${replayCode}`)
  expect(replay.status === 402 && replayCode === 'PAYMENT_ALREADY_USED', 'the replay is refused with PAYMENT_ALREADY_USED (no OKX call, no outside call)')

  step('3b. diagnostic: remove OUR record and replay again, to see what OKX itself does with a used authorization')
  info('this costs one outside call to the public API; no money may move')
  const redis = started.app.get(RedisService)
  for (const k of await redis.client.keys(redis.keys.all())) if (k.includes(':payment:')) await redis.client.del(k)
  const raw = await send()
  info(`without our record, the replay answered HTTP ${raw.status}; payment-response: ${raw.headers.get('payment-response') ? JSON.stringify(JSON.parse(Buffer.from(raw.headers.get('payment-response')!, 'base64').toString())).slice(0, 200) : '(none)'}`)
  await new Promise((res) => setTimeout(res, 4000))
  const balReplay = await read()
  if (mock) info('(mock facilitator keeps no nonce state, so this step only means something against OKX)')
  else expect(balReplay.buyer === before.buyer - PRICE_UNITS && balReplay.payout === before.payout + PRICE_UNITS, `exactly ONE price was paid in total, even with our guard removed (buyer ${before.buyer} -> ${balReplay.buyer}, receiver ${before.payout} -> ${balReplay.payout})`)

  step('4. the call log')
  const prisma = started.app.get(PrismaService)
  await new Promise((res) => setTimeout(res, 300))
  const site = await prisma.site.findUniqueOrThrow({ where: { name: SITE } })
  const rows = await prisma.callLog.findMany({ where: { siteId: site.id }, orderBy: { at: 'asc' } })
  for (const row of rows) info(`${row.routeName.padEnd(7)} ${row.result.padEnd(8)} paid=${row.paid} price=${row.priceUsd} code=${row.errorCode ?? '-'} tx=${row.paymentTx ?? '-'} ${row.durationMs} ms`)
  const paidRow = rows.find((x) => x.paid)
  expect(paidRow?.paymentTx === tx1 && paidRow.result === 'OK' && paidRow.priceUsd.toString() === '0.001', 'the paid call is logged with its settlement transaction and the price')
  expect(rows.filter((x) => x.routeName === 'broken').every((x) => !x.paid && x.paymentTx === null), 'the failed call is logged unpaid, no transaction')
  if (mock) info('(mock: the replay settles again because the mock keeps no nonce state; against OKX there must be exactly one paid row)')
  else expect(rows.filter((x) => x.paid).length === 1, 'exactly one paid row in the log (no replay settled)')

  step('RESULT')
  info(`${mock ? 'MOCK dry run' : 'REAL testnet run'} passed. Settlement tx: ${tx1}`)
} finally {
  await started.stop()
}
