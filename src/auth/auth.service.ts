import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import { getAddress, recoverMessageAddress } from 'viem'
import { createSiweMessage, parseSiweMessage, validateSiweMessage } from 'viem/siwe'
import { APP_CONFIG, type AppConfig } from '../config/app-config.js'
import { PrismaService } from '../database/prisma.service.js'
import { RedisService } from '../redis/redis.service.js'
import { sameAddress, tryNormalizeAddress } from '../shared/address.js'
import { SessionStore } from './session.store.js'

export const AUTH_CHAIN_ID = 196
const NONCE_TTL_SECONDS = 300
const STATEMENT = 'Sign in to TapeHermes. This does not cost gas and does not move funds.'

@Injectable()
export class AuthService {
  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly sessions: SessionStore,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Build the sign-in message for a wallet: bound to AUTH_DOMAIN and chain 196, with a one-time nonce kept 5 minutes. */
  async issueMessage(addressInput: string): Promise<{ message: string; expiresInSeconds: number }> {
    const address = tryNormalizeAddress(addressInput)
    if (!address) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'address is not a valid wallet address' })
    const nonce = randomBytes(16).toString('hex')
    const now = new Date()
    const message = createSiweMessage({
      address: getAddress(address), chainId: AUTH_CHAIN_ID, domain: this.config.authDomain, nonce, statement: STATEMENT,
      uri: `https://${this.config.authDomain}`, version: '1', issuedAt: now,
      expirationTime: new Date(now.getTime() + NONCE_TTL_SECONDS * 1000),
    })
    await this.redis.client.set(this.redis.keys.nonce(nonce), message, 'EX', NONCE_TTL_SECONDS)
    return { message, expiresInSeconds: NONCE_TTL_SECONDS }
  }

  /** Check the signed message and open a session. The nonce is consumed first, so any attempt (good or bad) uses it up. */
  async verify(message: string, signature: string) {
    const fail = (why: string) => new UnauthorizedException({ code: 'SIGN_IN_FAILED', message: why })
    const parsed = parseSiweMessage(message)
    if (!parsed.nonce || !/^[0-9a-f]{32}$/.test(parsed.nonce)) throw fail('sign-in message not recognised')
    const stored = await this.redis.client.getdel(this.redis.keys.nonce(parsed.nonce))
    if (!stored) throw fail('sign-in message expired or already used')
    if (stored !== message) throw fail('sign-in message does not match the one we issued')
    if (parsed.chainId !== AUTH_CHAIN_ID) throw fail('wrong chain')
    if (!validateSiweMessage({ message: parsed, domain: this.config.authDomain })) throw fail('sign-in message is invalid or expired')
    let recovered: string
    try {
      recovered = await recoverMessageAddress({ message, signature: signature as `0x${string}` })
    } catch {
      throw fail('signature could not be read')
    }
    // EOA wallets only in Phase 1: recovery must give the address in the message (contract wallets would need EIP-1271).
    if (!parsed.address || !sameAddress(recovered, parsed.address)) {
      throw fail('signature does not match the wallet (contract wallets are not supported yet)')
    }
    const wallet = recovered.toLowerCase()
    const owner = await this.prisma.owner.upsert({ where: { wallet }, create: { wallet }, update: {} })
    const s = await this.sessions.create({ ownerId: owner.id, wallet })
    return { ...s, wallet }
  }

  logout(token: string) { return this.sessions.destroy(token) }
}
