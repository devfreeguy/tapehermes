import { rpcCall } from './rpc-call.js'

export interface RpcProbe { url: string; ok: boolean; ms: number; block?: number; error?: string }

/** One eth_blockNumber call to one node, timed. Never throws. */
export async function probeRpc(url: string, timeoutMs = 15000): Promise<RpcProbe> {
  const t0 = Date.now()
  try {
    const r = await rpcCall(url, 'eth_blockNumber', [], timeoutMs)
    return r.error !== undefined ? { url, ok: false, ms: Date.now() - t0, error: r.error } : { url, ok: true, ms: Date.now() - t0, block: parseInt(r.result, 16) }
  } catch (e: any) {
    return { url, ok: false, ms: Date.now() - t0, error: e.message }
  }
}
