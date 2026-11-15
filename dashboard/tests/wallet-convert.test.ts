import { describe, expect, it } from 'vitest'
import { toSignableTypedData } from '@/lib/wallet/typed-data'
import { toSendParams } from '@/lib/wallet/tx'

const apiTypedData = {
  domain: { name: 'TapeAPI', version: '1', chainId: 196, verifyingContract: '0x' + 'ab'.repeat(20) },
  types: {
    EIP712Domain: [{ name: 'name', type: 'string' }],
    Delegation: [{ name: 'container', type: 'address' }, { name: 'signer', type: 'address' }, { name: 'expires', type: 'uint64' }],
  },
  primaryType: 'Delegation',
  message: { container: '0x' + '11'.repeat(20), signer: '0x' + '22'.repeat(20), expires: 1_800_000_000 },
}

describe('delegation typed data for the wallet', () => {
  it('drops the EIP712Domain type, which viem derives itself', () => {
    expect(Object.keys(toSignableTypedData(apiTypedData).types)).toEqual(['Delegation'])
  })
  it('turns integer fields into bigint and leaves addresses alone', () => {
    const m = toSignableTypedData(apiTypedData).message
    expect(m.expires).toBe(1_800_000_000n)
    expect(m.container).toBe('0x' + '11'.repeat(20))
  })
  it('keeps the domain and primary type exactly as the server sent them', () => {
    const t = toSignableTypedData(apiTypedData)
    expect(t.domain).toEqual(apiTypedData.domain)
    expect(t.primaryType).toBe('Delegation')
  })
  it('does not touch the input', () => {
    const copy = JSON.stringify(apiTypedData)
    toSignableTypedData(apiTypedData)
    expect(JSON.stringify(apiTypedData)).toBe(copy)
  })
})

describe('publish transactions for the wallet', () => {
  const to = '0x' + 'cd'.repeat(20)
  it('reads a hex value, a decimal value and a missing value', () => {
    expect(toSendParams({ to, data: '0x1234', value: '0x0' }).value).toBe(0n)
    expect(toSendParams({ to, data: '0x1234', value: '0x10' }).value).toBe(16n)
    expect(toSendParams({ to, data: '0x1234', value: '5' }).value).toBe(5n)
    expect(toSendParams({ to, data: '0x1234' }).value).toBe(0n)
  })
  it('passes the target and the data through untouched', () => {
    expect(toSendParams({ to, data: '0xabcdef' })).toMatchObject({ to, data: '0xabcdef' })
  })
})
