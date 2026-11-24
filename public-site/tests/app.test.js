import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { devSettings, mount } from '../app.js'

const SIGNER = '0x' + 'ab'.repeat(20)
const html = readFileSync(join(process.cwd(), 'playground.html'), 'utf8')
const flush = () => new Promise((r) => setTimeout(r, 0))
const click = (id) => document.getElementById(id).click()
const submit = (id) => { const f = document.getElementById(id); f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })) }

const proof = (result) => ({ envelope: { container: '0x' + '22'.repeat(20), id: 'abc', ts: 1_800_000_000, sig: '0x' + '11'.repeat(65), ok: true, result }, method: 'x', params: {}, id: 'abc' })
const trust = { source: 'site-origin', gateway: { mode: 'client', verified: true }, delegation: 'signature-valid', holderCheck: 'verified', holder: SIGNER, expiresAt: '2026-12-20T00:00:00.000Z' }
function fakeHermes(over = {}) {
  const hermes = {
    manifest: vi.fn(async () => ({ manifest: { methods: [{ name: 'asteroid' }, { name: 'food' }], tapehermes: { price: { food: '0.002', asteroid: '0' } } } })),
    call: vi.fn(async (method, params) => {
      const result = method === 'asteroid' ? { name: '(2010 PK9)', hazardous: true, diameterMaxMeters: 258.4, firstApproach: '1900-06-01' }
        : method === 'food' ? { description: 'CHEDDAR CHEESE', dataType: 'Branded', brand: 'Sartori', matches: 19300 } : { text: 'Because of scattering.', status: 'completed' }
      const paid = method !== 'asteroid'
      return { result, paid, price: method === 'ask' ? '0.01' : paid ? '0.002' : '0', transaction: paid ? '0x' + '12'.repeat(32) : null, trust, proof: proof(result), signer: SIGNER, params }
    }),
    verify: vi.fn(async (p) => ({ ok: !p.tampered, signer: SIGNER, expected: SIGNER })),
    ...over,
  }
  return hermes
}
let ethereum, fetchImpl
function setup(hermes = fakeHermes(), eth = ethereum) {
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>')).replace(/<script[^>]*><\/script>/g, '')
  return { hermes, app: mount({ doc: document, hermes, ethereum: eth, fetchImpl, directUrl: 'https://service.test/neo/' }) }
}
const text = (id) => document.getElementById(id).textContent
const rows = () => [...document.querySelectorAll('#checks li')].map((li) => [li.dataset.id, li.dataset.status])

beforeEach(() => {
  ethereum = { request: vi.fn(async () => ['0x' + 'ab'.repeat(20)]) }
  fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: { code: 'API_KEY_MISSING' } }), { status: 403 }))
})

describe('price and wallet', () => {
  it('shows the price from the manifest, and a plain message when the manifest is missing', async () => {
    setup(); await flush()
    expect(text('food-price')).toBe('$0.002 per request')
    setup(fakeHermes({ manifest: vi.fn(async () => { throw Object.assign(new Error('x'), { code: 'MANIFEST_UNAVAILABLE' }) }) })); await flush()
    expect(text('food-price')).toBe('unavailable')
    expect(text('paid-out')).toContain('no published manifest')
  })
  it('connects, shows the short address, and says so when there is no wallet or the wallet refuses', async () => {
    setup(); click('connect'); await flush()
    expect(text('wallet-status')).toMatch(/^Connected 0xabab.*\.\.\.ababab$/)
    setup(fakeHermes(), null); click('connect'); await flush()
    expect(text('wallet-status')).toContain('No wallet was found')
    setup(fakeHermes(), { request: vi.fn(async () => { throw new Error('rejected') }) }); click('connect'); await flush()
    expect(text('wallet-status')).toBe('The wallet did not connect.')
  })

  it('disconnects from the demo and requires a new connection before paying', async () => {
    const { hermes } = setup()
    click('connect'); await flush()
    expect(text('connect')).toBe('Disconnect wallet')
    click('connect')
    await flush()
    expect(text('connect')).toBe('Connect wallet')
    expect(text('wallet-status')).toBe('Wallet disconnected.')
    submit('paid-form'); await flush()
    expect(text('paid-out')).toBe('Connect your wallet before paying.')
    expect(hermes.call).not.toHaveBeenCalled()
    click('connect'); await flush()
    submit('paid-form'); await flush()
    expect(hermes.call).toHaveBeenCalledWith('food', { query: 'cheddar cheese' })
  })

  it('asks for a fresh account choice after disconnect and accepts a different wallet', async () => {
    const permission = { eth_accounts: {} }
    let account = SIGNER
    ethereum.request.mockImplementation(async ({ method }) => {
      if (method === 'eth_accounts') return [account]
    })
    setup()
    click('connect'); await flush()
    click('connect'); await flush()
    account = '0x' + 'cd'.repeat(20)
    click('connect'); await flush()
    expect(ethereum.request.mock.calls.map(([rpc]) => rpc)).toEqual([
      { method: 'wallet_requestPermissions', params: [permission] },
      { method: 'eth_accounts' },
      { method: 'wallet_revokePermissions', params: [permission] },
      { method: 'wallet_requestPermissions', params: [permission] },
      { method: 'eth_accounts' },
    ])
    expect(text('wallet-status')).toBe('Connected 0xcdcdcd...cdcdcd')
  })

  it('keeps the current account if the switch is canceled and never silently reconnects', async () => {
    setup()
    click('connect'); await flush()
    ethereum.request.mockClear()
    ethereum.request.mockRejectedValueOnce({ code: 4001 })
    click('switch-wallet'); await flush()
    expect(ethereum.request).toHaveBeenCalledTimes(1)
    expect(text('wallet-status')).toMatch(/^Connected 0xabab/)
    expect(text('connect')).toBe('Disconnect wallet')
  })

  it('lets wallets without permission methods connect and gives explicit switching instructions', async () => {
    ethereum.request.mockImplementation(async ({ method }) => {
      if (method !== 'eth_requestAccounts') throw { code: 4200 }
      return [SIGNER]
    })
    setup()
    click('connect'); await flush()
    click('switch-wallet'); await flush()
    expect(text('wallet-status')).toBe('Choose another account in your wallet to switch.')
    click('connect'); await flush()
    expect(text('wallet-status')).toContain('remove this site’s access')
  })

  it('updates the connected account and clears it when the wallet removes access', async () => {
    const events = {}
    setup(fakeHermes(), { ...ethereum, on: (event, callback) => { events[event] = callback } })
    click('connect'); await flush()
    events.accountsChanged(['0x' + 'cd'.repeat(20)])
    expect(text('wallet-status')).toBe('Connected 0xcdcdcd...cdcdcd')
    events.accountsChanged([])
    expect(text('connect')).toBe('Connect wallet')
    events.accountsChanged(['0x' + 'ef'.repeat(20)])
    expect(text('connect')).toBe('Connect wallet')
  })
})

describe('free route', () => {
  it('refuses a bad number without calling anything', async () => {
    const { hermes } = setup()
    document.getElementById('asteroid-id').value = '12ab'; submit('free-form'); await flush()
    expect(text('free-out')).toContain('digits only')
    expect(hermes.call).not.toHaveBeenCalled()
  })
  it('calls the route, shows the answer, and lists the checks it made', async () => {
    const { hermes } = setup()
    submit('free-form'); await flush(); await flush()
    expect(hermes.call).toHaveBeenCalledWith('asteroid', { id: '3542519' })
    expect(text('free-out')).toContain('(2010 PK9)')
    expect(text('free-out')).toContain('Potentially hazardous: yes')
    expect(text('free-out')).toContain('about 258 m')
    expect(rows()).toEqual([['source', 'pass'], ['delegation', 'pass'], ['holder', 'pass'], ['signature', 'pass'], ['price', 'info'], ['payment', 'info']])
    expect(document.getElementById('proof').hidden).toBe(false)
    expect(text('proof-fields')).toContain('Recovered signer')
    expect(document.getElementById('tamper').disabled).toBe(false)
    expect(text('source-line')).toBe('Manifest source: site-origin, gateway tier: client.')
  })
})

describe('paid route: food lookup', () => {
  it('needs a food, then pays through the helper and shows the match', async () => {
    const { hermes } = setup()
    document.getElementById('food-input').value = '   '; submit('paid-form'); await flush()
    expect(text('paid-out')).toContain('Write a food first')
    expect(hermes.call).not.toHaveBeenCalled()
    click('connect'); await flush()
    document.getElementById('food-input').value = 'cheddar cheese'; submit('paid-form'); await flush(); await flush()
    expect(hermes.call).toHaveBeenCalledWith('food', { query: 'cheddar cheese' })
    expect(text('paid-out')).toContain('CHEDDAR CHEESE')
    expect(text('paid-out')).toContain('Branded, Sartori')
    expect(text('paid-out')).toContain('19300 matches')
    expect(rows().find(([id]) => id === 'payment')).toEqual(['payment', 'pass'])
  })
  it('never turns an answer into HTML: markup in an answer from an outside service stays text', async () => {
    const evil = '<img src=x onerror="window.pwned=1"><script>window.pwned=2</script>'
    const h = fakeHermes({ call: vi.fn(async () => ({ result: { description: evil, dataType: 'x', brand: '', matches: 1 }, paid: true, price: '0.002', transaction: '0x' + '12'.repeat(32), trust, proof: proof({ description: evil }) })) })
    setup(h)
    click('connect'); await flush()
    submit('paid-form'); await flush(); await flush()
    expect(document.querySelector('#paid-out img')).toBeNull()
    expect(document.querySelector('#paid-out script')).toBeNull()
    expect(text('paid-out')).toContain('<img src=x')
    expect(globalThis.pwned).toBeUndefined()
  })
  it('explains a failed payment in plain words and lets the visitor try again', async () => {
    const h = fakeHermes({ call: vi.fn(async () => { throw Object.assign(new Error('raw text'), { code: 'PAYMENT_SERVICE_UNAVAILABLE' }) }) })
    setup(h)
    click('connect'); await flush()
    submit('paid-form'); await flush(); await flush()
    expect(text('paid-out')).toContain('Nothing was charged')
    expect(text('paid-out')).not.toContain('raw text')
    expect(document.querySelector('#paid-form button').disabled).toBe(false)
  })
})

describe('the AI route stays off until the manifest offers it', () => {
  it('keeps its section hidden when the manifest has no "ask" method', async () => {
    setup(); await flush()
    expect(document.getElementById('ai-section').hidden).toBe(true)
  })
  it('shows it, with its price, when the owner turns the route on, and it works the same way', async () => {
    const h = fakeHermes({ manifest: vi.fn(async () => ({ manifest: { methods: [{ name: 'asteroid' }, { name: 'food' }, { name: 'ask' }], tapehermes: { price: { food: '0.002', ask: '0.01', asteroid: '0' } } } })) })
    setup(h); await flush()
    expect(document.getElementById('ai-section').hidden).toBe(false)
    expect(text('ai-price')).toBe('$0.01 per request')
    click('connect'); await flush()
    document.getElementById('ai-input').value = 'Why is the sky blue?'; submit('ai-form'); await flush(); await flush()
    expect(h.call).toHaveBeenCalledWith('ask', { input: 'Why is the sky blue?' })
    expect(text('ai-out')).toContain('Because of scattering.')
  })
})

describe('check it yourself', () => {
  it('a changed answer fails the signature check on screen, and the page says why', async () => {
    const { hermes } = setup()
    hermes.verify = vi.fn(async (p) => ({ ok: JSON.stringify(p.envelope.result).includes('(2010 PK9)'), signer: SIGNER, expected: SIGNER }))
    submit('free-form'); await flush(); await flush()
    click('tamper'); await flush()
    expect(rows().find(([id]) => id === 'signature')).toEqual(['signature', 'fail'])
    expect(text('side-out')).toContain('One character of "name" was changed')
    expect(text('side-out')).toContain('would refuse the answer')
  })
  it('reports it loudly if a change is NOT noticed', async () => {
    setup()
    submit('free-form'); await flush(); await flush()
    click('tamper'); await flush()
    expect(text('side-out')).toContain('should never happen')
  })
  it('asks the outside service without a key and shows its refusal', async () => {
    setup()
    submit('free-form'); await flush(); await flush()
    click('direct'); await flush(); await flush()
    expect(fetchImpl).toHaveBeenCalledWith('https://service.test/neo/3542519')
    expect(text('side-out')).toContain('answered 403 (API_KEY_MISSING)')
    expect(text('side-out')).toContain('does not have one')
    fetchImpl.mockRejectedValueOnce(new Error('offline'))
    click('direct'); await flush(); await flush()
    expect(text('side-out')).toContain('could not be reached')
  })
  it('keeps both buttons off until there is an answer to check', () => {
    setup()
    expect(document.getElementById('tamper').disabled).toBe(true)
    expect(document.getElementById('direct').disabled).toBe(true)
  })
})

describe('where the page may take its manifest from', () => {
  const loc = (host, search) => ({ hostname: host, search })
  it('honours ?dev only when the page is served from this computer', () => {
    expect(devSettings(loc('127.0.0.1', '?dev=http://127.0.0.1:3100/sites/x'))).toEqual({ dev: { siteUrl: 'http://127.0.0.1:3100/sites/x' } })
    expect(devSettings(loc('localhost', '?dev=http://localhost:3100/s'))).toEqual({ dev: { siteUrl: 'http://localhost:3100/s' } })
  })
  it('ignores ?dev on any real address, so a link cannot point the page at someone else manifest', () => {
    expect(devSettings(loc('1-2-396.tapekit.org', '?dev=https://evil.example.org/sites/x'))).toEqual({})
    expect(devSettings(loc('evil.example.org', '?dev=http://127.0.0.1/s'))).toEqual({})
    expect(devSettings(loc('127.0.0.1.evil.org', '?dev=http://x/s'))).toEqual({})
  })
  it('passes an rpc address for the holder check, and nothing when there is no query', () => {
    expect(devSettings(loc('1-2-396.tapekit.org', '?rpc=https://rpc.example.org'))).toEqual({ rpcUrl: 'https://rpc.example.org' })
    expect(devSettings(loc('1-2-396.tapekit.org', ''))).toEqual({})
  })
})
