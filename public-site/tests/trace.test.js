import { expect, it, vi } from 'vitest'
import { createTrace } from '../trace.js'

it.each([false, true])('shows real JSON and settlement without exposing wallet authorization (local: %s)', async (local) => {
  document.body.innerHTML = '<p id="run-status"></p><ol id="activity"></ol>'
  const hash = '0x' + 'a'.repeat(64)
  const explorerUrl = vi.fn(() => './explorer')
  const ethereum = { request: vi.fn(async () => 'secret-wallet-signature') }
  const fetchImpl = vi.fn()
    .mockResolvedValueOnce(Response.json({ error: 'payment required' }, {
      status: 402,
      headers: { 'payment-required': btoa(JSON.stringify({ accepts: [{ amount: '2000' }] })) },
    }))
    .mockResolvedValueOnce(Response.json({ ok: true, result: 'real answer' }, {
      headers: { 'payment-response': btoa(JSON.stringify({ success: true, transaction: hash, network: 'eip155:196' })) },
    }))
  const trace = createTrace({ doc: document, fetchImpl, ethereum, local, explorerUrl })
  trace.begin('Running food')
  const payload = { id: 'request-1', params: { query: 'cheese' } }
  const options = { method: 'POST', body: JSON.stringify(payload) }
  const offer = await trace.fetch('/tapeapi/v1/food', options)
  expect(offer.status).toBe(402)
  await trace.wallet.request({ method: 'eth_signTypedData_v4', params: ['private-authorization'] })
  const result = await trace.fetch('/tapeapi/v1/food', { ...options, headers: { 'Payment-Signature': 'secret-wallet-signature' } })
  expect(await result.json()).toEqual({ ok: true, result: 'real answer' })
  const timeline = document.getElementById('activity')
  expect([...timeline.querySelectorAll('li > strong')].map((node) => node.textContent)).toEqual([
    'POST /tapeapi/v1/food', 'Wallet · eth_signTypedData_v4', 'Retry with payment authorization',
  ])
  for (const content of ['HTTP 402', 'HTTP 200', 'request-1', '2000', 'real answer', hash]) expect(timeline.textContent).toContain(content)
  expect(timeline.textContent).not.toMatch(/private-authorization|secret-wallet-signature/)
  if (local) {
    expect(timeline.querySelector('a')).toBeNull()
    expect(explorerUrl).not.toHaveBeenCalled()
  } else {
    expect(timeline.querySelector('a').target).toBe('_blank')
    expect(explorerUrl).toHaveBeenCalledWith('eip155:196', hash)
  }
})
