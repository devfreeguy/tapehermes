import { chainReader } from './chain-reader.js'
import { tryNormalizeAddress } from '../shared/address.js'

/** The site does not exist (or is not a usable TapeOut site). Maps to a clean 404. */
export class SiteNotFoundError extends Error {}
/** The chain could not be read. Maps to 503: we do not guess. */
export class ChainUnavailableError extends Error {}

const NAME_RE = /^[0-9]+\.[0-9]+\.[0-9]+\.tape$/

/** On-chain facts about a TapeOut site (read only). Addresses are returned normalized. */
export async function readSite(name: string, chainId = 196, rpcUrls?: string[]) {
  if (!NAME_RE.test(name)) throw new SiteNotFoundError('not a TapeOut site name')
  let s
  try { s = await chainReader(chainId, rpcUrls).siteStatus(name) } catch (e) {
    throw new ChainUnavailableError(`chain read failed: ${(e as Error).message.slice(0, 120)}`)
  }
  if (s.status === 'store-changed') throw new ChainUnavailableError('site store changed; not trusted')
  if ((s.status !== 'ok' && s.status !== 'unpaid') || !s.circuits || !s.container || !s.holder) throw new SiteNotFoundError(`site status ${s.status}`)
  const holder = tryNormalizeAddress(s.holder), circuits = tryNormalizeAddress(s.circuits), container = tryNormalizeAddress(s.container)
  if (!holder || !circuits || !container) throw new ChainUnavailableError('chain returned a malformed address')
  // `unpaid` is a real site that is not switched on yet: the holder can still manage it, and switch it on.
  return { name, chainId, circuits, tokenId: String(s.tokenId), container, holder, activated: s.status === 'ok' }
}
export type SiteFacts = Awaited<ReturnType<typeof readSite>>
