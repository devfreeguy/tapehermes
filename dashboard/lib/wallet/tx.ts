import type { PublishTx } from '@/lib/api/schemas'

type Tx = PublishTx['txs'][number]

/** One unsigned transaction from the API, in the shape sendTransaction takes. `value` may arrive as hex or decimal text. */
export function toSendParams(tx: Tx): { to: `0x${string}`; data: `0x${string}`; value: bigint } {
  return { to: tx.to as `0x${string}`, data: tx.data as `0x${string}`, value: tx.value ? BigInt(tx.value) : 0n }
}
