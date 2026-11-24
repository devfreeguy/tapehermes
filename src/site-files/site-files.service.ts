import { ConflictException, ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common'
import type { Session } from '../auth/session.store.js'
import { ChainService } from '../chain/chain.service.js'
import { ChainUnavailableError } from '../chain/read-site.js'
import { sameAddress } from '../shared/address.js'
import { SitesService } from '../sites/sites.service.js'
import { parseSiteBundle } from './site-files.schema.js'

/** Pages are written last, so a visitor never sees a page whose styles and scripts are not on the chain yet. */
const pagesLast = (a: { path: string }, b: { path: string }) => Number(a.path.endsWith('.html')) - Number(b.path.endsWith('.html')) || a.path.localeCompare(b.path)

@Injectable()
export class SiteFilesService {
  constructor(private readonly sites: SitesService, private readonly chain: ChainService) {}

  /**
   * The plan to put a set of files into the site store: for each file whether the chain already holds exactly those bytes
   * (same SHA-256), and the UNSIGNED transactions for the ones that do not. Send them in order from the holder wallet. Calling
   * it again after sending is the check: every file reads "current". Read only; nothing is sent and no key is involved.
   */
  async plan(session: Session, name: string, body: unknown) {
    const files = parseSiteBundle(body).sort(pagesLast)
    const site = await this.sites.requireOwned(session, name)
    const facts = await this.sites.readChain(site.name)
    if (!sameAddress(facts.holder, session.wallet)) throw new ForbiddenException({ code: 'NOT_HOLDER', message: 'the signed-in wallet is no longer the holder of this site' })
    if (!facts.activated) throw new ConflictException({ code: 'NOT_ACTIVATED', message: 'the site is not switched on yet; switch it on first' })
    let onChain
    try { onChain = await Promise.all(files.map((f) => this.chain.fileOnChain(site.container, f.path))) } catch (e) {
      if (e instanceof ChainUnavailableError) throw new ServiceUnavailableException({ code: 'CHAIN_UNAVAILABLE', message: 'the chain could not be read; try again shortly' })
      throw e
    }
    const planned = files.map((f, i) => {
      const built = this.chain.siteFileTxs(site.container, f.path, f.contentType, f.bytes)
      const here = onChain[i]
      const state = !here.published ? 'new' : here.sha256 === built.sha256 ? 'current' : 'changed'
      return { path: f.path, contentType: f.contentType, size: built.size, sha256: built.sha256, state, txs: state === 'current' ? [] : built.txs }
    })
    const txs = planned.flatMap((f) => f.txs.map((tx, i) => ({ ...tx, label: `${f.path} ${i + 1}/${f.txs.length}` })))
    return {
      from: facts.holder, chainId: site.chainId,
      files: planned.map(({ txs: t, ...f }) => ({ ...f, txCount: t.length })),
      txs, totalTxs: txs.length,
      note: 'Unsigned. Send each transaction in order from the holder wallet. Nothing has been sent.',
    }
  }
}
