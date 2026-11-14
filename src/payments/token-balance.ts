import { parseAbi } from 'viem'
import { testnetClient } from './chain-client.js'

const abi = parseAbi(['function balanceOf(address) view returns (uint256)'])

/** ERC-20 balance on X Layer testnet. */
export function tokenBalance(token: `0x${string}`, holder: `0x${string}`, blockNumber?: bigint): Promise<bigint> {
  return testnetClient().readContract({ address: token, abi, functionName: 'balanceOf', args: [holder], blockNumber })
}

/** Native OKB balance on X Layer testnet, optionally at a past block. */
export const nativeBalance = (holder: `0x${string}`, blockNumber?: bigint): Promise<bigint> =>
  testnetClient().getBalance({ address: holder, blockNumber })

export const txReceiptTime = (hash: `0x${string}`, timeoutMs = 120000) =>
  testnetClient().waitForTransactionReceipt({ hash, timeout: timeoutMs })
