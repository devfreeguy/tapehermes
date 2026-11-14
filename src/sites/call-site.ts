import { createTapeAPI } from '@tapeapi/sdk'

/**
 * Buyer side: resolve a site's manifest in dev mode and call one method. The SDK verifies the signed
 * answer (TAP-13 envelope) before returning. Dev mode: the manifest is fetched from `url`, not from the chain.
 */
export async function callSite(url: string, method: string, params: Record<string, unknown> = {}, rpcUrls: string[] = []) {
  const api = createTapeAPI({ dev: true, rpcUrls, quorum: Math.min(2, rpcUrls.length) || undefined, quiet: true })
  const svc = await api.resolve({ dev: url })
  const answer = await api.call(svc, method, params)
  return { svc, answer }
}
