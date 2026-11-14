import { createTapeAPI, rpcUrlsFor } from '@tapeapi/sdk'
import { envList } from '../shared/env.js'

/** Read-only SDK client. Explicit rpcUrls win; else RPC_URLS_<chainId> from .env; else the SDK defaults (slow from some regions). */
export function chainReader(chainId: number, rpcUrls?: string[]) {
  const fromEnv = envList(`RPC_URLS_${chainId}`)
  const urls = rpcUrls?.length ? rpcUrls : fromEnv.length ? fromEnv : rpcUrlsFor(chainId)
  return createTapeAPI({ chainId, rpcUrls: urls, quorum: Math.min(2, urls.length), quiet: true })
}
