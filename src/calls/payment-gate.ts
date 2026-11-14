/**
 * The payment seam. The call pipeline runs these steps in this order, and the order is the guarantee:
 *
 *   1. rate limit            (before anything touches the facilitator)
 *   2. gate.authorize()      (x402: answer 402, or verify the payment. NOTHING is charged here)
 *   3. the site provider     (worker + signing; the outside call happens here)
 *   4. decision.settle()     (ONLY if step 3 produced a successful answer; this is the one step that moves money)
 *
 * A failed or refused call never reaches step 4, so the visitor is never charged for it.
 */
export const PAYMENT_GATE = Symbol('PAYMENT_GATE')

export interface GateRequest {
  siteId: string
  siteName: string
  routeName: string
  priceUsd: number
  /** Where payments settle (the site payout address, normalized). */
  payoutAddress: string
  request: Request
}

export type SettleOutcome =
  | { ok: true; /** headers to add to the answer, e.g. PAYMENT-RESPONSE */ headers: Record<string, string>; paymentTx: string | null }
  | { ok: false; response: Response; errorCode: string }

export type GateDecision =
  | { allow: true; paid: false }
  | { allow: true; paid: true; settle(): Promise<SettleOutcome>; /** The call ends without a settle: free the used-payment record so the same payment can be retried. Idempotent. */ release(): Promise<void> }
  | { allow: false; response: Response; errorCode: string; /** plain 402 challenge: not worth a log row */ silent?: boolean }

export interface PaymentGate {
  authorize(req: GateRequest): Promise<GateDecision>
}
