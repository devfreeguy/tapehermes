import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CONTENT_TYPES, DEMO_SITE, startDemo } from '../proofs/lib/demo-server.js'
import { newWallet } from './helpers/app.js'

// The helper the demo site SHIPS (the copy inside public-site/), driven by a fake EIP-1193 wallet.
const helper = await import(pathToFileURL(resolve('public-site/tapehermes.min.js')).href)
const buyer = newWallet()
const wallet = () => {
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

let demo: Awaited<ReturnType<typeof startDemo>>
beforeAll(async () => {
  process.env.REDIS_PREFIX = 'tapehermes-test:'
  demo = await startDemo({ mock: true })
})
afterAll(async () => { await demo?.stop() })
const hermes = () => helper.createHermes({ ethereum: wallet(), dev: { siteUrl: `${demo.apiBase}/sites/${DEMO_SITE}` } })
const logs = async () => (await demo.call('GET', `/api/sites/${DEMO_SITE}/logs?limit=100`, demo.token)).body as { routeName: string; result: string; paid: boolean; errorCode: string | null }[]

describe('the demo routes (routes.json) are valid for the real backend', () => {
  it('the free and the food route are listed, and the AI route is NOT (it is off until DEMO_ENABLE_AI is set)', async () => {
    const r = (await demo.call('GET', `/api/sites/${DEMO_SITE}/routes`, demo.token)).body as { name: string; priceUsd: string; enabled: boolean; config: any }[]
    expect(r.filter((x) => x.enabled).map((x) => x.name).sort()).toEqual(['asteroid', 'food'])
    expect(r.find((x) => x.name === 'ask')?.enabled ?? false).toBe(false)
    expect(r.find((x) => x.name === 'food')!.config.locked).toEqual({ pageSize: 1 })
    expect(r.find((x) => x.name === 'asteroid')!.priceUsd).toBe('0')
  })
  it('the published manifest names the prices and advertises only what a visitor may send', async () => {
    const m = await (await fetch(`${demo.apiBase}/sites/${DEMO_SITE}/.well-known/tapeapi.json`)).json() as any
    expect(m.tapehermes.price).toEqual({ food: '0.002', asteroid: '0' })
    const params = Object.fromEntries(m.methods.map((x: any) => [x.name, Object.keys(x.params)]))
    expect(params).toEqual({ food: ['query'], asteroid: ['id'] })
    expect(JSON.stringify(m)).not.toContain('pageSize')
    expect(JSON.stringify(m)).not.toContain('gpt-4.1-nano')
  })
})

describe('free route: asteroid lookup', () => {
  it('answers, is not charged, and the answer verifies; a changed answer does not', async () => {
    const h = hermes()
    const r = await h.call('asteroid', { id: '3542519' })
    expect(r.result).toEqual({ name: '(2010 PK9)', hazardous: true, diameterMaxMeters: 258.25, firstApproach: '1900-06-01' })
    expect(r).toMatchObject({ paid: false, price: '0', verified: true })
    expect((await h.verify(r.proof)).ok).toBe(true)
    const edited = JSON.parse(JSON.stringify(r.proof)); edited.envelope.result.name = '(2010 XX)'
    expect((await h.verify(edited)).ok).toBe(false)
  })
  it('refuses an id that is too long, without calling NASA', async () => {
    await expect(hermes().call('asteroid', { id: '12345678901' })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })
})

describe('paid route: USDA food lookup with the owner-locked page size', () => {
  it('pays through the helper and returns a verified answer with the settlement transaction', async () => {
    const r = await hermes().call('food', { query: 'cheddar cheese' })
    expect(r).toMatchObject({ paid: true, price: '0.002', verified: true })
    expect(r.result).toEqual({ description: 'CHEDDAR CHEESE', dataType: 'Branded', brand: 'Sartori Company', matches: 19300 })
    expect(r.transaction).toMatch(/^0x[0-9a-f]{64}$/)
    expect(r.trust.source).toBe('endpoint (DEVELOPMENT ONLY)')
  })

  it('refuses a visitor who tries to change the locked page size, and charges nothing', async () => {
    const before = (await logs()).filter((l) => l.paid).length
    await expect(hermes().call('food', { query: 'milk', pageSize: 50 })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await new Promise((r) => setTimeout(r, 300))
    expect((await logs()).filter((l) => l.paid).length).toBe(before)
  })

  it('refuses a query over 60 characters before anything is paid or called', async () => {
    const before = (await logs()).filter((l) => l.paid).length
    await expect(hermes().call('food', { query: 'x'.repeat(61) })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await new Promise((r) => setTimeout(r, 300))
    expect((await logs()).filter((l) => l.paid).length).toBe(before)
  })

  it('the AI route does not exist while it is off: a call to it is refused', async () => {
    await expect(hermes().call('ask', { input: 'hi' })).rejects.toBeTruthy()
  })
})

describe('the AI route, once the owner turns it on (DEMO_ENABLE_AI)', () => {
  let on: Awaited<ReturnType<typeof startDemo>>
  beforeAll(async () => { process.env.DEMO_ENABLE_AI = '1'; try { on = await startDemo({ mock: true }) } finally { delete process.env.DEMO_ENABLE_AI } })
  afterAll(async () => { await on?.stop() })
  const h = () => helper.createHermes({ ethereum: wallet(), dev: { siteUrl: `${on.apiBase}/sites/${DEMO_SITE}` } })

  it('is listed with its locked settings, and answers a paid call', async () => {
    const r = (await on.call('GET', `/api/sites/${DEMO_SITE}/routes`, on.token)).body as { name: string; enabled: boolean; config: any }[]
    expect(r.find((x) => x.name === 'ask')).toMatchObject({ enabled: true, config: { locked: { model: 'gpt-4.1-nano', max_output_tokens: 60, store: false } } })
    const a = await h().call('ask', { input: 'Why is the sky blue?' })
    expect(a).toMatchObject({ paid: true, price: '0.01', verified: true })
    expect(a.result.text).toContain('Why is the sky blue?')
  })
  it('refuses a visitor who tries to change the model, the instructions, the cap or storage', async () => {
    for (const key of ['model', 'instructions', 'max_output_tokens', 'store']) {
      await expect(h().call('ask', { input: 'hi', [key]: 'x' })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    }
    await expect(h().call('ask', { input: 'x'.repeat(201) })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })
})

describe('the demo site files', () => {
  it('serves each file with the content type a TapeOut site must declare, and nothing that is not part of the site', async () => {
    for (const [file, type] of [['index.html', CONTENT_TYPES['.html']], ['styles.css', CONTENT_TYPES['.css']], ['app.js', CONTENT_TYPES['.js']], ['main.js', CONTENT_TYPES['.js']], ['checks.js', CONTENT_TYPES['.js']], ['tapehermes.min.js', CONTENT_TYPES['.js']]]) {
      const r = await fetch(`${demo.siteUrl}/${file}`)
      expect(r.status, file).toBe(200)
      expect(r.headers.get('content-type'), file).toBe(type)
    }
    expect((await fetch(`${demo.siteUrl}/`)).headers.get('content-type')).toBe(CONTENT_TYPES['.html'])
    for (const hidden of ['routes.json', 'package.json', 'build.mjs', 'tests/x.js', '../package.json', '%2e%2e/package.json']) expect((await fetch(`${demo.siteUrl}/${hidden}`)).status, hidden).toBe(404)
  })

  it('ships the very helper that is built from helper/', () => {
    expect(readFileSync('public-site/tapehermes.min.js', 'utf8')).toBe(readFileSync('helper/dist/tapehermes.min.js', 'utf8'))
  })
})

describe('TapeOut site rules (TapeKit handbook and gateway code) for the files that get published', () => {
  const PUBLISHED = ['index.html', 'styles.css', 'app.js', 'main.js', 'checks.js', 'tapehermes.min.js']
  const text = (f: string) => readFileSync(`public-site/${f}`, 'utf8')

  it('uses relative paths and no outside address in HTML or CSS (src, href, action, url(), @import, meta refresh)', () => {
    const html = text('index.html'), css = text('styles.css')
    expect(html).not.toMatch(/(src|href|action|poster|srcset)=["']?(https?:)?\/\//i)
    expect(html).not.toMatch(/http-equiv=["']?refresh/i)
    expect(css).not.toMatch(/url\(\s*["']?(https?:)?\/\//i)
    expect(css).not.toMatch(/@import/i)
    for (const m of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) expect(m[1], m[1]).toMatch(/^(\.\/|#)/) // a file of this site, or a place on this page
  })

  it('has no script from outside and no inline script, so the gateway CSP (scripts only from the chain) is met', () => {
    const html = text('index.html')
    expect([...html.matchAll(/<script\b([^>]*)>/g)].map((m) => m[1].trim())).toEqual(['type="module" src="./main.js"'])
    for (const f of PUBLISHED.filter((p) => p.endsWith('.js') && p !== 'tapehermes.min.js')) expect(text(f), f).not.toMatch(/\beval\(|new Function|importScripts|import\(\s*["']https?:/)
  })

  it('names the outside service in code in one place only (the optional direct call), nowhere in HTML or CSS', () => {
    const outside = PUBLISHED.filter((f) => f !== 'tapehermes.min.js' && /https?:\/\//.test(text(f)))
    expect(outside).toEqual(['main.js'])
  })

  it('uses plain ASCII file names, no dot segments, and declares a content type for every file', () => {
    const files = readdirSync('public-site').filter((f) => statSync(`public-site/${f}`).isFile())
    for (const f of files) { expect(f, f).toMatch(/^[A-Za-z0-9._-]+$/); expect(f.normalize('NFC')).toBe(f) }
    for (const f of PUBLISHED) expect(CONTENT_TYPES[`.${f.split('.').pop()}`], f).toBeTruthy()
  })

  it('keeps every file far below the 8.4 MB single-file limit, and the whole site small enough to publish cheaply', () => {
    const total = PUBLISHED.reduce((n, f) => n + statSync(`public-site/${f}`).size, 0)
    for (const f of PUBLISHED) expect(statSync(`public-site/${f}`).size, f).toBeLessThan(200_000)
    expect(total).toBeLessThan(120_000)
  })

  it('keeps the page and the stylesheet under 24,000 bytes each, so each one is a single publish transaction', () => {
    for (const f of ['index.html', 'styles.css']) expect(statSync(`public-site/${f}`).size, f).toBeLessThan(24_000)
  })

  it('keeps every element the page code looks up (the design contract in public-site/design/BRIEF.md)', () => {
    const html = text('index.html')
    const ids = ['connect', 'switch-wallet', 'theme-toggle', 'wallet-status', 'free-form', 'asteroid-id', 'free-out', 'paid-form', 'food-input', 'food-count', 'food-price', 'paid-out',
      'ai-section', 'ai-form', 'ai-input', 'ai-count', 'ai-price', 'ai-out', 'checks', 'proof', 'proof-fields', 'tamper', 'direct', 'side-out', 'source-line']
    for (const id of ids) expect([...html.matchAll(new RegExp(`\\bid="${id}"`, 'g'))].length, id).toBe(1)
    expect(html).toMatch(/id="ai-section"[^>]*\bhidden\b/)
    expect(html).toMatch(/id="proof"[^>]*\bhidden\b/)
    for (const id of ['tamper', 'direct']) expect(html).toMatch(new RegExp(`id="${id}"[^>]*\\bdisabled\\b`))
    for (const form of ['free-form', 'paid-form', 'ai-form']) expect(html.match(new RegExp(`<form id="${form}"[\\s\\S]*?</form>`))?.[0], form).toMatch(/<button\b/)
  })

  it('says in plain words that the site has no "100% on-chain" badge, and has no em dashes or hidden characters', () => {
    expect(text('index.html')).toContain('do not carry the &ldquo;100% on-chain&rdquo; badge')
    for (const f of PUBLISHED.filter((p) => p !== 'tapehermes.min.js')) {
      expect(text(f), f).not.toContain('—')
      expect(text(f), f).not.toMatch(/[‪-‮⁦-⁩​-‏]/) // no bidirectional or zero-width characters
    }
  })

  it('uses no hex colors', () => {
    for (const f of ['styles.css', 'index.html']) expect(text(f), f).not.toMatch(/#[0-9a-fA-F]{3,8}\b(?![\w-])/)
  })
})

describe('what the demo shows is described honestly', () => {
  it('routes.json holds no secret value, only secret names', () => {
    const j = readFileSync('public-site/routes.json', 'utf8')
    expect(j).not.toMatch(/sk-[A-Za-z0-9]{8,}/)
    expect(JSON.parse(j).secrets).toEqual(['NASA_API_KEY', 'USDA_API_KEY', 'OPENAI_API_KEY'])
  })
})
