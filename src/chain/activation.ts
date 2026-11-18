import { decodeFunctionResult, encodeFunctionData, parseAbi } from 'viem'
import { CHAINS } from '@tapeapi/sdk'
import { chainReader } from './chain-reader.js'
import { ChainUnavailableError } from './read-site.js'

/** The DomainBinding calls TapeHermes needs. `bind` is the one the holder sends to switch a site on (TAP-10 6.3). */
const abi = parseAbi([
  'function bind(string name, address container, uint256 months) payable',
  'function monthlyFee() view returns (uint256)',
  'function containerPaidUntil(address container) view returns (uint40)',
])

export const MAX_MONTHS = 12
/** The coin the fee is paid in on chain 196. */
export const NATIVE_SYMBOL = 'OKB'
const BINDING = (CHAINS as Record<number, { binding: string }>)[196]!.binding as `0x${string}`

export interface ActivationFacts { feeWei: bigint; paidUntil: number | null }

/** The fee per month and the end of the paid period, read from chain 196 (never a number written down). */
export async function readActivationFacts(container: string, rpcUrls?: string[]): Promise<ActivationFacts> {
  const rpc = chainReader(196, rpcUrls).rpc
  if (!rpc) throw new ChainUnavailableError('no chain node is configured')
  const read = async (functionName: 'monthlyFee' | 'containerPaidUntil', args: readonly unknown[]) => {
    const data = encodeFunctionData({ abi, functionName, args } as never)
    return decodeFunctionResult({ abi, functionName, data: await rpc.ethCall(BINDING, data) } as never) as bigint
  }
  try {
    const feeWei = await read('monthlyFee', [])
    const until = Number(await read('containerPaidUntil', [container]).catch(() => 0n))
    return { feeWei, paidUntil: until > 0 ? until : null }
  } catch (e) { throw new ChainUnavailableError(`chain read failed: ${(e as Error).message.slice(0, 120)}`) }
}

/** The UNSIGNED bind transaction. The value is months x the fee read a moment ago; the wallet shows it before anything is sent. */
export function bindTx(name: string, container: string, months: number, feeWei: bigint) {
  return {
    to: BINDING,
    data: encodeFunctionData({ abi, functionName: 'bind', args: [name, container as `0x${string}`, BigInt(months)] }),
    value: (feeWei * BigInt(months)).toString(),
  }
}
