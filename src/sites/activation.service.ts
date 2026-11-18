import { ConflictException, ForbiddenException, Injectable, BadRequestException, ServiceUnavailableException } from '@nestjs/common'
import type { Session } from '../auth/session.store.js'
import { bindTx, MAX_MONTHS, NATIVE_SYMBOL } from '../chain/activation.js'
import { ChainService } from '../chain/chain.service.js'
import { ChainUnavailableError } from '../chain/read-site.js'
import { sameAddress } from '../shared/address.js'
import { SitesService } from './sites.service.js'

/** Wei as a plain decimal amount of the coin ("0", "0.026"). */
const formatCoin = (wei: bigint) => {
  const frac = (wei % 10n ** 18n).toString().padStart(18, '0').replace(/0+$/, '')
  return `${wei / 10n ** 18n}${frac ? `.${frac}` : ''}`
}

/** Is the site switched on, and the unsigned transaction that switches it on. Nothing here sends or signs anything. */
@Injectable()
export class ActivationService {
  constructor(private readonly sites: SitesService, private readonly chain: ChainService) {}

  private async facts(container: string) {
    try { return await this.chain.activationFacts(container) } catch (e) {
      if (e instanceof ChainUnavailableError) throw new ServiceUnavailableException({ code: 'CHAIN_UNAVAILABLE', message: 'the chain could not be read; try again shortly' })
      throw e
    }
  }

  async status(session: Session, name: string) {
    const site = await this.sites.requireOwned(session, name)
    const chain = await this.sites.readChain(site.name)
    const a = await this.facts(chain.container)
    return {
      activated: chain.activated, paidUntil: chain.activated && a.paidUntil ? new Date(a.paidUntil * 1000) : null,
      fee: { perMonthWei: a.feeWei.toString(), perMonth: formatCoin(a.feeWei), symbol: NATIVE_SYMBOL }, maxMonths: MAX_MONTHS,
      holder: chain.holder, isHolder: sameAddress(chain.holder, session.wallet),
    }
  }

  async txFor(session: Session, name: string, months: number) {
    if (!Number.isInteger(months) || months < 1 || months > MAX_MONTHS) throw new BadRequestException({ code: 'BAD_REQUEST', message: `months must be a whole number from 1 to ${MAX_MONTHS}` })
    const site = await this.sites.requireOwned(session, name)
    const chain = await this.sites.readChain(site.name)
    if (!sameAddress(chain.holder, session.wallet)) throw new ForbiddenException({ code: 'NOT_HOLDER', message: 'the signed-in wallet is not the holder of this site' })
    if (chain.activated) throw new ConflictException({ code: 'ALREADY_ACTIVE', message: 'this site is already switched on' })
    const a = await this.facts(chain.container)
    const tx = bindTx(chain.name, chain.container, months, a.feeWei)
    return {
      from: chain.holder, chainId: chain.chainId, months, totalWei: tx.value, total: formatCoin(BigInt(tx.value)), symbol: NATIVE_SYMBOL,
      txs: [tx], note: 'Unsigned. Send it from the holder wallet. Nothing has been sent.',
    }
  }
}
