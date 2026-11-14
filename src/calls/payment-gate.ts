/**
 * The seam for Phase 2 payments. The call pipeline asks the gate BEFORE the worker runs, so an unpaid priced call
 * never reaches the upstream. Phase 1 ships only the fail-closed gate.
 */
export const PAYMENT_GATE = Symbol('PAYMENT_GATE')

export interface GateRequest {
  siteId: string
  siteName: string
  routeName: string
  priceUsd: number
  /** Where Phase 2 payments settle (the site payout address). */
  payoutAddress: string
  request: Request
}

export type GateDecision =
  | { allow: true; paid: boolean; paymentTx?: string | null }
  | { allow: false; response: Response; errorCode: string }

export interface PaymentGate {
  authorize(req: GateRequest): Promise<GateDecision>
}
