/** One unsigned transaction from the API. `value` may arrive as hex or decimal text. */
export interface UnsignedTx { to: string; data: string; value?: string }

/** One unsigned transaction from the API, in the shape sendTransaction takes. */
export function toSendParams(tx: UnsignedTx): { to: `0x${string}`; data: `0x${string}`; value: bigint } {
  return { to: tx.to as `0x${string}`, data: tx.data as `0x${string}`, value: tx.value ? BigInt(tx.value) : 0n }
}

/** Send the transactions one by one, in order, waiting for each to be mined. The wallet asks the owner before each one. */
export async function sendAll(
  txs: UnsignedTx[], send: (p: ReturnType<typeof toSendParams>) => Promise<`0x${string}`>, mined: (hash: `0x${string}`) => Promise<unknown>,
  onProgress?: (done: number, total: number) => void,
): Promise<string[]> {
  const hashes: string[] = []
  for (const t of txs) {
    const hash = await send(toSendParams(t))
    await mined(hash)
    hashes.push(hash)
    onProgress?.(hashes.length, txs.length)
  }
  return hashes
}
