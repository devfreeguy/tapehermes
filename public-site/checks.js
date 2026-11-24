// The checklist the visitor sees under each answer. Pure functions: no page, no network, so they can be tested alone.

const short = (a) => (a && a.length > 14 ? `${a.slice(0, 8)}...${a.slice(-6)}` : a || '')

/**
 * One row per thing the helper checked, each with a plain status:
 *   pass = checked and good, fail = checked and bad, warn = could not be fully checked here, info = nothing to check
 * @param {{trust:object, signer:string, price:string, paid:boolean, transaction:string|null}} result  what hermes.call returned
 * @param {{ok:boolean, signer:string|null, expected:string}} verdict  what hermes.verify says about the answer as it is NOW
 */
const interpolate = (text, ...values) => text.replace(/\{(\d+)\}/g, (_, index) => values[index])

export function buildChecks(result, verdict, tMessage = interpolate) {
  const t = result.trust
  const dev = t.source.startsWith('endpoint')
  const rows = []
  rows.push({
    id: 'source', label: 'Where the manifest came from',
    status: dev ? 'warn' : t.gateway && t.gateway.mode === 'server' ? 'warn' : 'pass',
    detail: dev ? 'A local development server, not this site (development only).'
      : t.gateway && t.gateway.mode === 'server' ? 'This site, read by the gateway server. You are trusting the gateway for that read.'
      : t.gateway && t.gateway.mode === 'client' ? 'This site, checked against the chain by your own browser.' : 'This site.',
  })
  rows.push({
    id: 'delegation', label: 'The site holder allowed this signer',
    status: t.delegation === 'signature-valid' ? 'pass' : 'warn',
    detail: t.delegation === 'signature-valid' ? tMessage('Signed by the holder, valid until {0}.', t.expiresAt ? new Date(t.expiresAt).toUTCString() : 'a set date') : 'No holder signature is checked on a development manifest.',
  })
  rows.push({
    id: 'holder', label: 'The signer is the current holder',
    status: t.holderCheck === 'verified' ? 'pass' : 'warn',
    detail: t.holderCheck === 'verified' ? tMessage('Confirmed on X Layer: {0}.', short(t.holder)) : t.holderCheck === 'unchecked' ? 'Could not be read from the chain in this browser.' : 'Not applicable to a development manifest.',
  })
  rows.push({
    id: 'signature', label: 'The answer is signed by that signer',
    status: verdict.ok ? 'pass' : 'fail',
    detail: verdict.ok ? tMessage('Recovered {0}, which matches the manifest signer.', short(verdict.signer)) : tMessage('The signature gives {0}, not {1}. Do not trust this answer.', short(verdict.signer) || 'no valid signer', short(verdict.expected)),
  })
  rows.push({
    id: 'price', label: 'The price matches the manifest',
    status: result.paid ? 'pass' : 'info',
    detail: result.paid ? tMessage('You paid {0} USD, exactly the price in the manifest.', result.price) : 'This route is free.',
  })
  rows.push({
    id: 'payment', label: 'Payment',
    status: result.paid ? (result.transaction ? 'pass' : 'warn') : 'info',
    detail: result.paid ? (result.transaction ? tMessage('Settled in transaction {0}.', short(result.transaction)) : 'Paid, but no transaction hash came back.') : 'Nothing was charged.',
  })
  return rows
}

/** True when no row failed. Warnings do not fail an answer, but the page shows them. */
export const allGood = (rows) => rows.every((r) => r.status !== 'fail')

/** The same answer with one character of the result changed, to show what a tampered answer looks like to the check. */
export function tamper(proof) {
  const copy = JSON.parse(JSON.stringify(proof))
  const r = copy.envelope.result
  const key = Object.keys(r).find((k) => typeof r[k] === 'string' && r[k].length > 0) || Object.keys(r)[0]
  r[key] = typeof r[key] === 'string' ? (r[key][0] === 'X' ? 'Y' : 'X') + r[key].slice(1) : !r[key]
  return { proof: copy, changed: key }
}

/** Plain words for a failed call, by the helper's error code. */
export function explainFailure(e, localized) {
  const words = {
    NO_WALLET: 'No wallet was found in this browser. Install a wallet extension to use the paid route.',
    WRONG_CHAIN: 'Switch your wallet to the payment network and try again.',
    PRICE_MISMATCH: 'The price asked is not the price in the manifest, so nothing was signed.',
    PRICE_TOO_HIGH: 'The price is above the limit set on this page, so nothing was signed.',
    PAYMENT_REJECTED: 'The payment was not accepted. You were not charged.',
    PAYMENT_SERVICE_UNAVAILABLE: 'The payment service cannot be reached right now. Nothing was charged. Try again in a moment.',
    BAD_SIGNATURE: 'The answer was not signed by this site. It was not used.',
    MANIFEST_UNAVAILABLE: 'This site has no published manifest yet, so there is nothing to call.',
    DEV_MANIFEST: 'This site publishes a development manifest, so it is not trusted.',
    DELEGATION_EXPIRED: 'The site holder delegation has expired. The owner must sign a new one.',
    DELEGATION_NOT_FROM_HOLDER: 'The delegation was not signed by the current holder of this site.',
    RATE_LIMITED: 'Too many requests. Wait a moment and try again.',
    BAD_REQUEST: 'The site refused this input.',
  }
  if (Object.hasOwn(words, e?.code)) return words[e.code]
  const fallback = 'Something went wrong. Try again.'
  if (localized) return {
    ...(e?.code ? localized('Something went wrong ({0}). Try again.', { literal: e.code }) : localized(fallback)),
    english: e?.message || fallback,
  }
  return e?.message || fallback
}
