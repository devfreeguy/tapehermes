import { x402ResourceServer } from '@okxweb3/x402-core/server'
import { ExactEvmScheme } from '@okxweb3/x402-evm/exact/server'
import { watchFacilitator } from '../../src/calls/facilitator-watch.js'
import { PAYMENT_GATE } from '../../src/calls/payment-gate.js'
import type { X402PaymentGate } from '../../src/calls/x402-payment-gate.js'
import { mockFacilitator } from '../../proofs/fixtures/mock-facilitator.js'
import type { TestApp } from './app.js'

export const NETWORK = 'eip155:1952' as const
export const MOCK_TX = `0x${'ab'.repeat(32)}`

export interface FacilitatorScript { failVerify?: boolean; failSettle?: boolean; throwOnVerify?: boolean; throwOnSettle?: boolean }

/**
 * The mock facilitator (it really checks the buyer EIP-3009 signature, receiver and amount) wrapped with counters.
 * `settleCalls` is THE number the tests watch: money moves only when it goes up.
 */
export function countingFacilitator(script: FacilitatorScript = {}) {
  const inner = mockFacilitator(NETWORK) as any
  const state = { verifyCalls: 0, settleCalls: 0, script, lastRequirements: null as any }
  const client = {
    getSupported: () => inner.getSupported(),
    verify: async (payload: unknown, req: any) => {
      state.verifyCalls++; state.lastRequirements = req
      if (state.script.throwOnVerify) throw new Error('facilitator down')
      if (state.script.failVerify) return { isValid: false, invalidReason: 'insufficient_funds' }
      return inner.verify(payload, req)
    },
    settle: async (payload: unknown, req: any) => {
      state.settleCalls++
      if (state.script.throwOnSettle) throw new Error('OKX settle failed: 500')
      if (state.script.failSettle) return { success: false, errorReason: 'settle_failed', transaction: '', network: NETWORK }
      return inner.settle(payload, req)
    },
  }
  return { state, client }
}

export const gateOf = (t: TestApp) => t.app.get(PAYMENT_GATE) as X402PaymentGate

/** Put a counting mock facilitator behind the app's x402 gate. */
export function attachFacilitator(t: TestApp, script: FacilitatorScript = {}) {
  const f = countingFacilitator(script)
  const server = new x402ResourceServer(watchFacilitator(f.client) as never).register(NETWORK, new ExactEvmScheme())
  gateOf(t).useResourceServer(server)
  return f.state
}
