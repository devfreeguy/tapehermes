import { describe, expect, it } from 'vitest'
import type { Route } from '@/lib/api/schemas'
import { emptyRouteForm, formToPayload, routeToForm, type RouteForm } from '@/lib/routes/route-form'
import { parseValue, stringifyValue } from '@/lib/routes/value-text'

const ok = (f: RouteForm, prev?: Route['config']) => {
  const r = formToPayload(f, prev)
  if (!r.ok) throw new Error(JSON.stringify(r.errors))
  return r.value
}
const base = (over: Partial<RouteForm> = {}): RouteForm => ({ ...emptyRouteForm(), name: 'ai', url: 'https://api.llm-provider.com/v1/respond', ...over })

describe('value text', () => {
  it('reads numbers, booleans, objects and plain text the way an owner expects', () => {
    expect(parseValue('60')).toBe(60)
    expect(parseValue('true')).toBe(true)
    expect(parseValue('"60"')).toBe('60')
    expect(parseValue('{"a":[1]}')).toEqual({ a: [1] })
    expect(parseValue('small-model')).toBe('small-model')
    expect(parseValue('Answer in one short sentence.')).toBe('Answer in one short sentence.')
    expect(parseValue('')).toBe('')
  })
  it('round-trips every kind, quoting text that would be misread', () => {
    for (const v of [60, true, 'plain', '60', 'true', { a: 1 }, ['x'], ' padded ']) expect(parseValue(stringifyValue(v))).toEqual(v)
    expect(stringifyValue('60')).toBe('"60"')
    expect(stringifyValue('plain')).toBe('plain')
  })
})

describe('route form to payload', () => {
  it('builds the AI-style route with locked settings, a limit, a secret header and a body', () => {
    const v = ok(base({
      method: 'POST', callerInputs: 'input', required: 'input', bodyMode: 'map',
      bodyMap: [{ key: 'model', value: 'model' }, { key: 'input', value: 'input' }, { key: 'max_output_tokens', value: 'max_output_tokens' }],
      headers: [{ key: 'authorization', value: 'Bearer ${LLM_KEY}' }],
      locked: [{ key: 'model', value: 'small-model-1' }, { key: 'max_output_tokens', value: '60' }],
      limits: [{ key: 'input', value: '200' }], pick: [{ key: 'text', value: 'output.0.content.0.text' }], priceUsd: '0.01', rateLimitPerMin: '30',
    }))
    expect(v).toMatchObject({ name: 'ai', priceUsd: '0.01', rateLimitPerMin: 30, enabled: true })
    expect(v.config).toEqual({
      url: 'https://api.llm-provider.com/v1/respond', method: 'POST', params: { input: 'string' }, required: ['input'],
      body: { model: 'model', input: 'input', max_output_tokens: 'max_output_tokens' }, headers: { authorization: 'Bearer ${LLM_KEY}' },
      pick: { text: 'output.0.content.0.text' }, locked: { model: 'small-model-1', max_output_tokens: 60 }, limits: { input: { maxLength: 200 } },
    })
  })

  it('leaves out everything that is empty, and the default GET method', () => {
    expect(ok(base()).config).toEqual({ url: 'https://api.llm-provider.com/v1/respond' })
  })

  it('sends all parameters when the body mode is "all"', () => {
    expect(ok(base({ method: 'POST', bodyMode: 'all', callerInputs: 'a, b' })).config).toMatchObject({ body: '*', params: { a: 'string', b: 'string' } })
  })

  it('catches simple mistakes in plain words, all at once', () => {
    const r = formToPayload(base({ name: '1bad name', url: 'http://x.com', priceUsd: 'free', rateLimitPerMin: '0', timeoutMs: '5' }))
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(Object.keys(r.errors).sort()).toEqual(['name', 'priceUsd', 'rateLimitPerMin', 'timeoutMs', 'url'])
      expect(r.errors.url).toBe('The address must start with https://')
      expect(r.errors.priceUsd).toContain('0.002')
    }
  })

  it('refuses an object as a default and a bad limit', () => {
    const r = formToPayload(base({ defaults: [{ key: 'x', value: '{"a":1}' }], limits: [{ key: 'input', value: '99999' }] }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['defaults', 'limits'])
  })

  it('ignores rows whose name is empty', () => {
    expect(ok(base({ query: [{ key: '', value: 'x' }], headers: [{ key: ' ', value: 'y' }] })).config).toEqual({ url: 'https://api.llm-provider.com/v1/respond' })
  })

  it('keeps the saved "returns" description that the editor has no box for', () => {
    expect(ok(base(), { url: 'x', returns: { text: 'string' } }).config.returns).toEqual({ text: 'string' })
  })
})

describe('saved route to editor and back', () => {
  const saved: Route = {
    name: 'ai', priceUsd: '0.01', enabled: false, rateLimitPerMin: 30, updatedAt: '2026-11-15T10:00:00.000Z',
    config: {
      url: 'https://api.llm-provider.com/v1/respond', method: 'POST', params: { input: 'string' }, required: ['input'], body: { model: 'model', input: 'input' },
      headers: { authorization: 'Bearer ${K}' }, defaults: { temperature: 0.2, mode: '60' }, locked: { model: 'm1', max: 60, flag: true, text: '60' },
      limits: { input: { maxLength: 200 } }, pick: { text: 'a.b' }, timeoutMs: 5000, returns: { text: 'string' },
    },
  }
  it('loads into the editor and saves back to the same settings', () => {
    const back = ok(routeToForm(saved), saved.config)
    expect(back.config).toEqual(saved.config)
    expect(back).toMatchObject({ name: 'ai', priceUsd: '0.01', enabled: false, rateLimitPerMin: 30 })
  })
  it('shows values of different types so they survive a save (numbers bare, text that looks like a number quoted)', () => {
    const f = routeToForm(saved)
    expect(f.locked.find((p) => p.key === 'text')?.value).toBe('"60"')
    expect(f.locked.find((p) => p.key === 'max')?.value).toBe('60')
  })
})
