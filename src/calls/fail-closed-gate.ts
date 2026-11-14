import { Injectable } from '@nestjs/common'
import { jsonResponse } from './fetch-bridge.js'
import type { GateDecision, GateRequest, PaymentGate } from './payment-gate.js'

/** Phase 1: free routes pass; any route with a price is refused (503) and the upstream is never called. */
@Injectable()
export class FailClosedPaymentGate implements PaymentGate {
  async authorize(req: GateRequest): Promise<GateDecision> {
    if (req.priceUsd <= 0) return { allow: true, paid: false }
    return {
      allow: false, errorCode: 'PAYMENTS_NOT_AVAILABLE',
      response: jsonResponse(503, { ok: false, error: { code: 'PAYMENTS_NOT_AVAILABLE', message: 'paid routes are not available yet' } }),
    }
  }
}
