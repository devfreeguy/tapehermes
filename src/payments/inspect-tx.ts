import { testnetClient } from './chain-client.js'

/** Who sent a transaction, what it called, and what it cost (from chain reads). */
export async function inspectTx(hash: `0x${string}`) {
  const c = testnetClient()
  const [tx, rc] = await Promise.all([c.getTransaction({ hash }), c.getTransactionReceipt({ hash })])
  return {
    hash, block: rc.blockNumber, from: tx.from, to: tx.to, status: rc.status,
    gasUsed: rc.gasUsed, gasPriceWei: rc.effectiveGasPrice, feeWei: rc.gasUsed * rc.effectiveGasPrice,
  }
}
