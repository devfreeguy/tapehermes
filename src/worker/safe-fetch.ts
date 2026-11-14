import { lookup as dnsLookup, type LookupAddress } from 'node:dns'
import { Agent, fetch as undiciFetch } from 'undici'
import { isPrivateIp } from '../web2-adapter/adapter.mjs'

type LookupCallback = (err: NodeJS.ErrnoException | null, address?: string | LookupAddress[], family?: number) => void
export type LookupFn = (hostname: string, options: { all?: boolean; family?: number; hints?: number }, cb: (err: NodeJS.ErrnoException | null, addresses: LookupAddress[]) => void) => void

export class BlockedAddressError extends Error {
  constructor(host: string) { super(`${host} resolves to a private or reserved address`) }
}

/**
 * Closes the DNS rebinding gap. The adapter checks what a name resolves to, then fetch resolves it AGAIN, so a hostile
 * DNS server can answer "public" first and "127.0.0.1" second. This lookup runs at connect time, inside the socket
 * that will really be used: the address that is checked is the address that is connected to.
 */
export function guardedLookup(inner: LookupFn = dnsLookup as unknown as LookupFn) {
  return (hostname: string, options: { all?: boolean; family?: number; hints?: number }, cb: LookupCallback) => {
    inner(hostname, { ...options, all: true }, (err, addrs) => {
      if (err) return cb(err)
      if (!addrs?.length || addrs.some((a) => isPrivateIp(a.address))) return cb(new BlockedAddressError(hostname))
      if (options.all) return cb(null, addrs)
      cb(null, addrs[0].address, addrs[0].family)
    })
  }
}

/** A fetch whose every connection goes through guardedLookup. Pass it to the adapter's `fetch` option. */
export function createSafeFetch(opts: { lookup?: LookupFn } = {}) {
  const agent = new Agent({ connect: { lookup: guardedLookup(opts.lookup) as never } })
  const safeFetch = ((input: unknown, init: Record<string, unknown> = {}) =>
    undiciFetch(input as never, { ...init, dispatcher: agent } as never)) as unknown as typeof fetch
  return { fetch: safeFetch, close: () => agent.close() }
}
