import { sig } from '@tapeapi/sdk'

/** The signed answer a provider returns (TAP-13 envelope, fields as seen on the wire). */
export interface Envelope { id: string; ok: boolean; result?: unknown; error?: unknown; container: string; ts: number; sig: string }

/** True when the envelope was signed by `signer` for exactly this container, method and params. */
export function verifyEnvelope(env: Envelope, method: string, params: object, signer: string): boolean {
  const body = env.result ?? env.error
  const who = sig.recoverResponseSigner({ container: env.container, id: env.id, method, params, ok: env.ok, body, ts: env.ts }, env.sig)
  return who.toLowerCase() === signer.toLowerCase()
}
