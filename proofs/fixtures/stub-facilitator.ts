import type { FacilitatorClient } from '@okxweb3/x402-core/server'

/**
 * TEST-ONLY stand-in for the OKX facilitator, used while www.okx.com is unreachable from this machine.
 * It lets the resource server start and build 402 responses. It never verifies or settles anything.
 */
export const stubFacilitator = (network: `${string}:${string}`): FacilitatorClient => ({
  getSupported: async () => ({ kinds: [{ x402Version: 2, scheme: 'exact', network }], extensions: [], signers: {} }),
  verify: async () => { throw new Error('stub facilitator: verify not available') },
  settle: async () => { throw new Error('stub facilitator: settle not available') },
}) as unknown as FacilitatorClient
