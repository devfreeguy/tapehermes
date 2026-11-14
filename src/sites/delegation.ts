import { chainById, sig } from '@tapeapi/sdk'
import { getAddress } from 'viem'

export const MIN_DAYS = 1
export const MAX_DAYS = 366
export const DEFAULT_DAYS = 30
const DAY_S = 86_400

export type DelegationState = 'none' | 'valid' | 'expiring' | 'expired'
export interface DelegationStatus { stored: boolean; status: DelegationState; expiresAt: Date | null; daysLeft: number | null }

/** Expiry status of a site delegation. "expiring" = at most `expiringDays` days left (PRD v0.5: 7). */
export function delegationStatus(
  site: { delegationSig: string | null; delegationExpires: Date | null },
  expiringDays: number,
  nowMs = Date.now(),
): DelegationStatus {
  if (!site.delegationSig || !site.delegationExpires) return { stored: false, status: 'none', expiresAt: null, daysLeft: null }
  const left = site.delegationExpires.getTime() - nowMs
  const daysLeft = Math.max(0, Math.floor(left / (DAY_S * 1000)))
  const status: DelegationState = left <= 0 ? 'expired' : left <= expiringDays * DAY_S * 1000 ? 'expiring' : 'valid'
  return { stored: true, status, expiresAt: site.delegationExpires, daysLeft }
}

/** The hub contract the delegation domain is anchored on (chain 196, from the SDK chain table). */
export const hubOf = (chainId: number): string => {
  const c = chainById(chainId) as { hub?: string } | undefined
  if (!c?.hub) throw new Error(`no hub for chain ${chainId}`)
  return c.hub
}

export interface DelegationSubject { container: string; signerAddress: string; chainId: number }

/** Unix seconds for a delegation lasting `days` from now. */
export const expiryFor = (days: number, nowMs = Date.now()): number => Math.floor(nowMs / 1000) + Math.round(days * DAY_S)

/**
 * The exact EIP-712 payload the holder signs with `eth_signTypedData_v4` (TAP-11 section 4):
 * Delegation(address container, address signer, uint64 expires) in the "TapeAPI" v1 domain anchored on the hub.
 */
export function delegationPayload(s: DelegationSubject, expires: number) {
  return sig.delegationTypedData(s.chainId, getAddress(hubOf(s.chainId)) as `0x${string}`, {
    container: getAddress(s.container), signer: getAddress(s.signerAddress), expires,
  })
}

/** Who signed. Throws on a malformed signature. */
export function recoverDelegationSigner(s: DelegationSubject, expires: number, signature: string): string {
  const digest = sig.delegationDigest(s.chainId, getAddress(hubOf(s.chainId)) as `0x${string}`, {
    container: getAddress(s.container), signer: getAddress(s.signerAddress), expires,
  })
  return sig.recoverAddress(digest, signature).toLowerCase()
}
