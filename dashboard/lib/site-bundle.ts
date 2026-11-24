import { siteBundle, type SiteBundle } from '@/lib/api/schemas'

/** The most a site bundle file may hold, matching the server (the server checks again). */
export const MAX_BUNDLE_FILE_BYTES = 640_000

export type BundleRead = { ok: true; bundle: SiteBundle; files: number; bytes: number } | { ok: false; reason: 'TOO_LARGE' | 'NOT_A_BUNDLE' }

/** Read the text of a site bundle file (made by `pnpm site:build`). Checks the shape only; the server validates every file. */
export function readSiteBundle(text: string): BundleRead {
  if (text.length > MAX_BUNDLE_FILE_BYTES) return { ok: false, reason: 'TOO_LARGE' }
  let json: unknown
  try { json = JSON.parse(text) } catch { return { ok: false, reason: 'NOT_A_BUNDLE' } }
  const parsed = siteBundle.safeParse(json)
  if (!parsed.success) return { ok: false, reason: 'NOT_A_BUNDLE' }
  // Each base64 character is six bits, so four characters are three bytes (less the padding).
  const bytes = parsed.data.files.reduce((n, f) => n + Math.floor((f.content.length * 3) / 4) - (f.content.endsWith('==') ? 2 : f.content.endsWith('=') ? 1 : 0), 0)
  return { ok: true, bundle: parsed.data, files: parsed.data.files.length, bytes }
}

/** The address of a site on the public gateway: 26.2.2.tape is served at 26-2-2.tapekit.org. */
export function gatewayUrl(siteName: string): string | null {
  return siteName.endsWith('.tape') ? `https://${siteName.slice(0, -5).replaceAll('.', '-')}.tapekit.org/` : null
}

/** Gas for writing site files, measured on X Layer: about 300,000 per transaction plus 221 per stored byte. */
export function estimateUploadGas(txCount: number, bytes: number): bigint {
  return BigInt(txCount) * 300_000n + BigInt(bytes) * 221n
}

/** What the upload may cost at this gas price, with a fifth added for a rising price. The holder must hold at least this much OKB. */
export function estimateUploadFeeWei(txCount: number, bytes: number, gasPriceWei: bigint): bigint {
  return (estimateUploadGas(txCount, bytes) * gasPriceWei * 12n) / 10n
}
