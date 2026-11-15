import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts'
import { createApp } from '../../src/bootstrap.js'
import type { AppConfig } from '../../src/config/app-config.js'
import { ChainService } from '../../src/chain/chain.service.js'
import { ChainUnavailableError, SiteNotFoundError } from '../../src/chain/read-site.js'
import { PrismaService } from '../../src/database/prisma.service.js'
import { ProviderCache } from '../../src/providers/provider-cache.service.js'
import { RedisService } from '../../src/redis/redis.service.js'
import type { HostedOptions } from '../../src/worker/hosted-methods.js'

export interface FakeSite { holder: string; tokenId?: string }

/** A stand-in for chain 196: name to holder. `down` simulates an RPC outage. Addresses may be in any case. */
export class FakeChain {
  sites = new Map<string, FakeSite>()
  down = false
  /** container (lowercase) -> sha256 of the manifest the fake chain holds at /.well-known/tapeapi.json */
  manifests = new Map<string, string>()
  async manifestOnChain(container: string) {
    if (this.down) throw new ChainUnavailableError('down')
    const sha256 = this.manifests.get(container.toLowerCase())
    return { published: !!sha256, size: sha256 ? 500 : 0, sha256: sha256 ?? '0x' + '0'.repeat(64), updatedAt: 1_800_000_000 }
  }
  set(name: string, holder: string) { this.sites.set(name, { holder, tokenId: '1' }) }
  async readSite(name: string) {
    if (this.down) throw new ChainUnavailableError('down')
    const s = this.sites.get(name)
    if (!s) throw new SiteNotFoundError('no such site')
    return { name, chainId: 196, circuits: '0x' + '11'.repeat(20), tokenId: s.tokenId ?? '1', container: '0x' + '22'.repeat(20), holder: s.holder.toLowerCase() }
  }
}

export const newWallet = (): PrivateKeyAccount => privateKeyToAccount(generatePrivateKey())

export async function startTestApp(overrides: Partial<AppConfig> = {}) {
  // rpcUrls196 empty: the site provider then does no chain read per call (the chain itself is FakeChain here).
  // okx: null so a test can never reach the real facilitator, whatever .env holds
  const started = await createApp({ rpcUrls196: [], okx: null, publicBaseUrl: 'https://api.tapehermes.test', ...overrides })
  const chain = new FakeChain()
  const chainService = started.app.get(ChainService)
  chainService.readSite = ((name: string) => chain.readSite(name)) as never
  chainService.manifestOnChain = ((c: string) => chain.manifestOnChain(c)) as never
  const cache = started.app.get(ProviderCache)
  const prisma = started.app.get(PrismaService)
  const redis = started.app.get(RedisService)
  await resetState(prisma, redis)
  const api = makeApi(started.base)
  return {
    ...started, chain, cache, prisma, redis, api,
    setHosted: (o: HostedOptions) => { cache.hostedOptions = o; cache.clear() },
  }
}
export type TestApp = Awaited<ReturnType<typeof startTestApp>>

export async function resetState(prisma: PrismaService, redis: RedisService) {
  await prisma.$executeRawUnsafe('TRUNCATE "CallLog", "Route", "Secret", "Site", "Owner" CASCADE')
  const keys = await redis.client.keys(redis.keys.all())
  if (keys.length) await redis.client.del(...keys)
}

export interface ApiReply { status: number; body: any; text: string }

export function makeApi(base: string) {
  const call = async (method: string, path: string, opts: { token?: string; body?: unknown } = {}): Promise<ApiReply> => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}), ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    })
    const text = await res.text()
    let body: any = null
    try { body = JSON.parse(text) } catch { /* not json */ }
    return { status: res.status, body, text }
  }
  return {
    call,
    /** Full wallet sign-in over HTTP. Returns the bearer token. */
    async signIn(account: PrivateKeyAccount): Promise<string> {
      const m = await call('POST', '/api/auth/message', { body: { address: account.address } })
      const signature = await account.signMessage({ message: m.body.message })
      const v = await call('POST', '/api/auth/verify', { body: { message: m.body.message, signature } })
      if (v.status !== 200) throw new Error(`sign-in failed ${v.status}`)
      return v.body.token
    },
  }
}

/** A fake upstream for the adapter: records what it was asked, answers JSON. */
export function fakeUpstream(answer: unknown = { base: 'USD', date: '2026-01-01', rates: { EUR: 0.9 } }) {
  const hits: { url: string; headers: Record<string, string>; method?: string; body?: string }[] = []
  const fetch = (async (url: URL | string, init: { headers?: Record<string, string>; method?: string; body?: string } = {}) => {
    hits.push({ url: String(url), headers: { ...(init.headers ?? {}) }, method: init.method, body: init.body })
    return new Response(JSON.stringify(answer), { status: 200, headers: { 'content-type': 'application/json' } })
  }) as unknown as typeof globalThis.fetch
  return { hits, fetch, resolve: async () => ['93.184.216.34'] }
}

/** What a wallet does with the delegation message: eth_signTypedData_v4 (viem takes the types without EIP712Domain). */
export async function signDelegation(account: PrivateKeyAccount, m: { typedData: { domain: any; types: Record<string, unknown>; primaryType: string; message: Record<string, any> } }) {
  const { EIP712Domain: _domain, ...types } = m.typedData.types as Record<string, any>
  return account.signTypedData({
    domain: m.typedData.domain, types, primaryType: m.typedData.primaryType,
    message: { ...m.typedData.message, expires: BigInt(m.typedData.message.expires) },
  } as never)
}

/** Ask for the delegation message, sign it with `signer` (the holder, normally) and submit it. Returns the PUT reply. */
export async function delegate(t: TestApp, token: string, signer: PrivateKeyAccount, site: string, days = 30) {
  const m = (await t.api.call('GET', `/api/sites/${site}/delegation/message?days=${days}`, { token })).body
  return t.api.call('PUT', `/api/sites/${site}/delegation`, { token, body: { signature: await signDelegation(signer, m), expires: m.expires } })
}
