import { isAddress } from 'viem'

/** The one stored form of every wallet and contract address: lowercase 0x + 40 hex. Throws on anything else. */
export function normalizeAddress(value: string): string {
  if (typeof value !== 'string' || !isAddress(value, { strict: false })) throw new Error('not an address')
  return value.toLowerCase()
}

export const tryNormalizeAddress = (value: unknown): string | null => {
  try { return normalizeAddress(value as string) } catch { return null }
}

/** Compare two addresses in the normalized form. */
export const sameAddress = (a: string, b: string): boolean => {
  const x = tryNormalizeAddress(a), y = tryNormalizeAddress(b)
  return x !== null && x === y
}
