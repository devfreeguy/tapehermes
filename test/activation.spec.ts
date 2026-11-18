import { decodeFunctionData, parseAbi } from 'viem'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { newWallet, resetState, startTestApp, type TestApp } from './helpers/app.js'

let t: TestApp
let holder: ReturnType<typeof newWallet>
let token: string
const SITE = '26.2.2.tape'
const BINDING = '0x68809fd2fb343aa57d0aeb7f33defe477c9666f9'
const bindAbi = parseAbi(['function bind(string name, address container, uint256 months) payable'])
const api = (m: string, p: string, body?: unknown, tk = token) => t.api.call(m, p, { token: tk, body })

beforeAll(async () => { t = await startTestApp() })
afterAll(async () => { await t.stop() })
beforeEach(async () => {
  await resetState(t.prisma, t.redis); t.cache.clear(); t.chain.sites.clear(); t.chain.down = false
  t.chain.feeWei = 0n; t.chain.paidUntil = 1_900_000_000
  holder = newWallet(); t.chain.setInactive(SITE, holder.address)
  token = await t.api.signIn(holder)
})

describe('a site that is not switched on yet', () => {
  it('can still be added by its holder', async () => {
    const r = await api('POST', '/api/sites', { name: SITE })
    expect(r.status).toBe(200)
    expect(r.body.created).toBe(true)
  })

  it('reports it is off, with the fee read from the chain', async () => {
    await api('POST', '/api/sites', { name: SITE })
    t.chain.feeWei = 26_000_000_000_000_000n
    const r = await api('GET', `/api/sites/${SITE}/activation`)
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ activated: false, paidUntil: null, isHolder: true, maxMonths: 12, fee: { perMonthWei: '26000000000000000', perMonth: '0.026', symbol: 'OKB' } })
  })

  it('refuses to publish a manifest until it is on', async () => {
    await api('POST', '/api/sites', { name: SITE })
    expect((await api('POST', `/api/sites/${SITE}/manifest/publish-tx`)).status).toBe(409)
  })
})

describe('the switch-on transaction', () => {
  beforeEach(async () => { await api('POST', '/api/sites', { name: SITE }) })

  it('is an unsigned bind call to the DomainBinding for this name and container', async () => {
    const r = await api('POST', `/api/sites/${SITE}/activation/tx`, { months: 1 })
    expect(r.status).toBe(200)
    const site = await t.prisma.site.findUniqueOrThrow({ where: { name: SITE } })
    expect(r.body).toMatchObject({ from: holder.address.toLowerCase(), chainId: 196, months: 1, totalWei: '0', total: '0', symbol: 'OKB' })
    expect(r.body.txs).toHaveLength(1)
    expect(r.body.txs[0].to.toLowerCase()).toBe(BINDING)
    const d = decodeFunctionData({ abi: bindAbi, data: r.body.txs[0].data })
    expect(d.functionName).toBe('bind')
    expect(d.args[0]).toBe(SITE)
    expect((d.args[1] as string).toLowerCase()).toBe(site.container)
    expect(d.args[2]).toBe(1n)
  })

  it('charges months x the fee read at that moment', async () => {
    t.chain.feeWei = 26_000_000_000_000_000n
    const r = await api('POST', `/api/sites/${SITE}/activation/tx`, { months: 3 })
    expect(r.body.txs[0].value).toBe('78000000000000000')
    expect(r.body.total).toBe('0.078')
    t.chain.feeWei = 30_000_000_000_000_000n
    expect((await api('POST', `/api/sites/${SITE}/activation/tx`, { months: 3 })).body.txs[0].value).toBe('90000000000000000')
  })

  it('defaults to one month and refuses 0, 13, fractions and text', async () => {
    expect((await api('POST', `/api/sites/${SITE}/activation/tx`, {})).body.months).toBe(1)
    for (const months of [0, 13, 1.5, -1, '2']) expect((await api('POST', `/api/sites/${SITE}/activation/tx`, { months })).status).toBe(400)
  })

  it('is refused for a wallet that is not the holder', async () => {
    t.chain.setInactive(SITE, newWallet().address) // the site moved to someone else
    const r = await api('POST', `/api/sites/${SITE}/activation/tx`, { months: 1 })
    expect(r.status).toBe(403)
    expect(r.body.error?.code ?? r.body.code).toBe('NOT_HOLDER')
  })

  it('is refused when the site is already on', async () => {
    t.chain.set(SITE, holder.address)
    const r = await api('POST', `/api/sites/${SITE}/activation/tx`, { months: 1 })
    expect(r.status).toBe(409)
  })

  it('shows the paid-until date once it is on, and lets the manifest publish proceed past the switch-on check', async () => {
    t.chain.set(SITE, holder.address)
    const r = await api('GET', `/api/sites/${SITE}/activation`)
    expect(r.body.activated).toBe(true)
    expect(new Date(r.body.paidUntil).getTime()).toBe(1_900_000_000 * 1000)
    const p = await api('POST', `/api/sites/${SITE}/manifest/publish-tx`)
    expect(p.body.error?.code ?? p.body.code).not.toBe('NOT_ACTIVATED')
  })

  it('answers 503 when the chain cannot be read, and 404 for a site that is not yours', async () => {
    t.chain.down = true
    expect((await api('POST', `/api/sites/${SITE}/activation/tx`, { months: 1 })).status).toBe(503)
    t.chain.down = false
    expect((await api('GET', `/api/sites/${SITE}/activation`, undefined, await t.api.signIn(newWallet()))).status).toBe(404)
  })

  it('needs a signed-in wallet', async () => {
    expect((await api('GET', `/api/sites/${SITE}/activation`, undefined, '')).status).toBe(401)
  })
})
