import { describe, expect, it, vi } from 'vitest'
import { createApiClient } from '@/lib/api/client'
import { ApiError } from '@/lib/api/errors'

const json = (status: number, body: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const site = { name: '1.2.396.tape', chainId: 196, tokenId: '1', holder: '0x' + '11'.repeat(20), payoutAddress: '0x' + '11'.repeat(20), signer: '0x' + '22'.repeat(20), status: 'ACTIVE', delegation: { stored: false, status: 'none', expiresAt: null, daysLeft: null }, createdAt: '2026-11-15T10:00:00.000Z' }

function setup(reply: () => Response | Promise<Response>, token: string | null = 'tok') {
  const fetchImpl = vi.fn(async () => reply())
  const onUnauthorized = vi.fn()
  const api = createApiClient({ baseUrl: 'http://api.test', getToken: () => token, onUnauthorized, fetchImpl: fetchImpl as never })
  return { api, fetchImpl, onUnauthorized, call: () => fetchImpl.mock.calls[0] as unknown as [string, RequestInit] }
}

describe('API client', () => {
  it('sends the bearer token, parses a good answer, and calls the right path', async () => {
    const t = setup(() => json(200, [site]))
    expect(await t.api.sites.list()).toHaveLength(1)
    const [url, init] = t.call()
    expect(url).toBe('http://api.test/api/sites')
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok')
  })

  it('sends no token to the sign-in endpoints', async () => {
    const t = setup(() => json(200, { message: 'hello', expiresInSeconds: 300 }))
    await t.api.auth.message('0xabc')
    expect((t.call()[1].headers as Record<string, string>).authorization).toBeUndefined()
    expect(JSON.parse(t.call()[1].body as string)).toEqual({ address: '0xabc' })
  })

  it('encodes names in paths and puts query values where the API expects them', async () => {
    const t = setup(() => json(200, []))
    await t.api.logs.list('1.2.396.tape', { route: 'fx', limit: 20 })
    expect(t.call()[0]).toBe('http://api.test/api/sites/1.2.396.tape/logs?route=fx&limit=20')
    const u = setup(() => json(200, { name: 'A', createdAt: 'x', updatedAt: 'y' }))
    await u.api.secrets.put('s/1', 'A B', 'v')
    expect(u.call()[0]).toBe('http://api.test/api/sites/s%2F1/secrets/A%20B')
  })

  it('reads a 204 answer', async () => {
    const t = setup(() => json(204, undefined))
    await expect(t.api.secrets.remove('1.2.396.tape', 'KEY')).resolves.toBeUndefined()
  })

  it('turns our own error body into an ApiError with its details', async () => {
    const t = setup(() => json(409, { code: 'SECRET_IN_USE', message: 'a route still uses this secret', routes: ['fx'] }))
    const e = await t.api.secrets.remove('s', 'K').catch((x) => x)
    expect(e).toBeInstanceOf(ApiError)
    expect(e).toMatchObject({ status: 409, code: 'SECRET_IN_USE', details: { routes: ['fx'] } })
  })

  it('turns a plain Nest error body into an ApiError too', async () => {
    const t = setup(() => json(404, { message: 'Cannot GET /nope', error: 'Not Found', statusCode: 404 }))
    const e = await t.api.sites.list().catch((x) => x)
    expect(e).toMatchObject({ status: 404, code: 'NOT_FOUND' })
  })

  it('signs the owner out once on a 401 and still throws', async () => {
    const t = setup(() => json(401, { code: 'UNAUTHENTICATED', message: 'sign in first' }))
    await expect(t.api.sites.list()).rejects.toMatchObject({ status: 401 })
    expect(t.onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('does not sign out on a 401 from the sign-in endpoints themselves', async () => {
    const t = setup(() => json(401, { code: 'SIGN_IN_FAILED', message: 'no' }))
    await expect(t.api.auth.verify('m', '0x')).rejects.toMatchObject({ code: 'SIGN_IN_FAILED' })
    expect(t.onUnauthorized).not.toHaveBeenCalled()
  })

  it('reports an unreachable server as NETWORK, status 0', async () => {
    const t = setup(() => { throw new TypeError('Failed to fetch') })
    await expect(t.api.sites.list()).rejects.toMatchObject({ status: 0, code: 'NETWORK' })
  })

  it('refuses an answer in an unexpected shape instead of passing it on', async () => {
    const t = setup(() => json(200, [{ name: 'x' }]))
    await expect(t.api.sites.list()).rejects.toMatchObject({ code: 'BAD_ANSWER' })
  })

  it('survives an error body that is not JSON', async () => {
    const t = setup(() => new Response('<html>bad gateway</html>', { status: 502 }))
    await expect(t.api.sites.list()).rejects.toMatchObject({ status: 502, code: 'HTTP_502' })
  })
})
