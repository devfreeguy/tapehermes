import { lookup } from 'node:dns/promises'
import { buildMethods, manifestMethods, envNames, HOSTED_POLICY } from '../web2-adapter/adapter.mjs'
import { withLocked, type LockableMethod } from './locked-settings.js'
import { createSafeFetch } from './safe-fetch.js'

export interface AdapterConfig {
  upstream?: { timeoutMs?: number; headers?: Record<string, string> }
  methods: Record<string, any>
}

/** Resolve a host and return every address, so the adapter can refuse private or reserved ones (an early check). */
const resolveAll = async (host: string): Promise<string[]> => (await lookup(host, { all: true })).map((a) => a.address)

/** One shared guarded fetch for all sites: connect-time address check, see safe-fetch.ts. */
const defaultSafeFetch = createSafeFetch()

export interface HostedOptions {
  resolve?: (host: string) => Promise<string[]>
  fetch?: typeof fetch
}

/**
 * Handlers and manifest entries for a site's settings, under the hosted rules (https 443 only, max 3 hosts,
 * no redirects, header allow-list, 256 KiB cap, no private addresses). `secrets` is the ONLY source of ${NAME}.
 * The adapter itself is used unmodified; the rebinding fix is the `fetch` we hand it.
 */
export function hostedMethods(config: AdapterConfig, secrets: Record<string, string | undefined> = {}, opts: HostedOptions = {}) {
  // Every ${NAME} the config uses must be a key of env (unset value = header dropped); nothing else can expand.
  const names = envNames([config.upstream?.headers, ...Object.values(config.methods).map((m) => m.headers)])
  const env = Object.fromEntries(names.map((n: string) => [n, secrets[n]]))
  const built = buildMethods(config, { policy: HOSTED_POLICY, env, resolve: opts.resolve ?? resolveAll, fetch: opts.fetch ?? defaultSafeFetch.fetch }) as Record<string, (p: unknown) => Promise<unknown>>
  return {
    // owner-locked values and limits are enforced here, before the adapter (see locked-settings.ts)
    handlers: Object.fromEntries(Object.entries(built).map(([name, fn]) => [name, withLocked(fn, config.methods[name] as LockableMethod)])),
    manifestMethods: manifestMethods(config),
    secretNames: [...new Set<string>(names)],
  }
}
