export type RpcReply = { result: string; error?: undefined } | { result?: undefined; error: string }

/** One JSON-RPC call to one node. Throws on transport failure; otherwise returns { result } or { error }. */
export async function rpcCall(url: string, method: string, params: unknown[] = [], timeoutMs = 20000): Promise<RpcReply> {
  const r = await fetch(url, {
    method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const j: any = await r.json()
  return j.error ? { error: `${j.error.code} ${j.error.message}` } : { result: j.result }
}
