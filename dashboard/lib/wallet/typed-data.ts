import type { DelegationMessage } from '@/lib/api/schemas'

type Td = DelegationMessage['typedData']

/**
 * The API sends the payload in the eth_signTypedData_v4 form (with an EIP712Domain type and plain numbers).
 * wagmi and viem want the domain types left out and integers as bigint. The same signature results; this only reshapes it.
 */
export function toSignableTypedData(td: Td) {
  const { EIP712Domain: _domain, ...types } = td.types
  const fieldType = new Map((types[td.primaryType] ?? []).map((f) => [f.name, f.type]))
  const message = Object.fromEntries(
    Object.entries(td.message).map(([k, v]) => [k, /^u?int\d*$/.test(fieldType.get(k) ?? '') && (typeof v === 'number' || typeof v === 'string') ? BigInt(v) : v]),
  )
  return { domain: td.domain, types, primaryType: td.primaryType, message }
}
