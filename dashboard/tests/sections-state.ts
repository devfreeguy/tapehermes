import { vi } from 'vitest'
import type { Route, Site } from '@/lib/api/schemas'

/** Hook results the section tests set before rendering. The vi.mock factories in sections-mocks.ts read them lazily. */
const build = () => {
  const noop = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false, isSuccess: false, error: null as unknown, data: undefined as unknown })
  return {
    router: { push: vi.fn(), replace: vi.fn() },
    wallet: {
      address: null as string | null, isConnected: false, onXLayer: true, noWallet: false, connectors: [] as unknown[], connecting: false,
      connect: vi.fn(async () => undefined), disconnect: vi.fn(), switchToXLayer: vi.fn(async () => undefined),
    },
    session: { session: null as null | { token: string; wallet: string; expiresAt: number }, ready: true, signIn: vi.fn(), signOut: vi.fn(), getToken: () => null },
    site: { data: undefined as unknown, isPending: false, error: null as unknown },
    sites: { data: undefined as unknown, isPending: false, error: null as unknown },
    secrets: { data: undefined as unknown, isPending: false, error: null as unknown },
    routes: { data: undefined as unknown, isPending: false, error: null as unknown },
    preview: { data: undefined as unknown, isPending: false, error: null as unknown },
    status: { data: undefined as unknown, isPending: false, error: null as unknown },
    logs: { data: undefined as unknown, isPending: false, error: null as unknown },
    summary: { data: undefined as unknown, isPending: false, error: null as unknown },
    register: noop(), setPayout: noop(), setStatus: noop(), signing: noop(), publish: noop(), signInMutation: noop(),
    secretActions: { save: noop(), rename: noop(), remove: noop() },
    routeActions: { create: noop(), update: noop(), remove: noop() },
  }
}
export const S = build()

export const site = (over: Partial<Site> = {}): Site => ({
  name: '1.2.396.tape', chainId: 196, tokenId: '1', holder: '0x' + 'aa'.repeat(20), payoutAddress: '0x' + 'bb'.repeat(20), signer: '0x' + 'cc'.repeat(20), status: 'ACTIVE',
  delegation: { stored: false, status: 'none', expiresAt: null, daysLeft: null }, createdAt: '2026-11-14T10:00:00.000Z', ...over,
})

export const route = (over: Partial<Route> = {}): Route => ({
  name: 'fx', priceUsd: '0.002', enabled: true, rateLimitPerMin: 60, updatedAt: '2026-11-15T10:00:00.000Z',
  config: { url: 'https://api.data-provider.com/v1/rate', query: { from: 'from' }, params: { from: 'string' } }, ...over,
})

export const HOLDER = '0x' + 'aa'.repeat(20)
export const done = <T,>(data: T) => ({ data, isPending: false, error: null as unknown })
