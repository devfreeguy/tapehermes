import type { FacilitatorClient } from '@okxweb3/x402-core/server'
import { authorizationTypes } from '@okxweb3/x402-evm'
import { verifyTypedData } from 'viem'

/**
 * TEST-ONLY local facilitator for when OKX is unreachable. verify() really checks the buyer's EIP-3009
 * signature (domain from the requirements, signer == authorization.from, recipient and amount match).
 * settle() moves NOTHING and returns a fake transaction hash. It proves our pipeline and the buyer signing,
 * NOT anything about OKX (fees, settlement time, per-site receiver acceptance).
 */
export const mockFacilitator = (network: `${string}:${string}`): FacilitatorClient => ({
  getSupported: async () => ({ kinds: [{ x402Version: 2, scheme: 'exact', network }], extensions: [], signers: {} }),
  verify: async (payload: any, req: any) => {
    const a = payload.payload.authorization
    const ok = await verifyTypedData({
      address: a.from, signature: payload.payload.signature,
      domain: { name: req.extra.name, version: req.extra.version, chainId: Number(req.network.split(':')[1]), verifyingContract: req.asset },
      types: authorizationTypes, primaryType: 'TransferWithAuthorization',
      message: { ...a, value: BigInt(a.value), validAfter: BigInt(a.validAfter), validBefore: BigInt(a.validBefore) },
    })
    const good = ok && a.to.toLowerCase() === req.payTo.toLowerCase() && BigInt(a.value) >= BigInt(req.amount)
    return good ? { isValid: true, payer: a.from } : { isValid: false, invalidReason: 'mock_verify_failed' }
  },
  settle: async (payload: any) => ({ success: true, status: 'success', payer: payload.payload.authorization.from, transaction: `0x${'ab'.repeat(32)}`, network }),
}) as unknown as FacilitatorClient
