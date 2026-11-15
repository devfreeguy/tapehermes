import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { envNames } from '../web2-adapter/adapter.mjs'
import type { Session } from '../auth/session.store.js'
import { PrismaService } from '../database/prisma.service.js'
import { ProviderCache } from '../providers/provider-cache.service.js'
import { SitesService } from '../sites/sites.service.js'
import { VaultService } from '../vault/vault.service.js'

export const SECRET_NAME_RE = /^[A-Z][A-Z0-9_]{0,63}$/

const meta = (s: { name: string; createdAt: Date; updatedAt: Date }) => ({ name: s.name, createdAt: s.createdAt, updatedAt: s.updatedAt })

/** Secrets are write-only: after saving, the API shows the name and dates, never the value. */
@Injectable()
export class SecretsService {
  constructor(
    private readonly prisma: PrismaService, private readonly vault: VaultService,
    private readonly sites: SitesService, private readonly cache: ProviderCache,
  ) {}

  async list(session: Session, siteName: string) {
    const site = await this.sites.requireOwned(session, siteName)
    return (await this.prisma.secret.findMany({ where: { siteId: site.id }, orderBy: { name: 'asc' } })).map(meta)
  }

  async put(session: Session, siteName: string, name: string, value: string) {
    if (!SECRET_NAME_RE.test(name)) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'secret name must be A-Z, 0-9 and _, starting with a letter (max 64)' })
    const site = await this.sites.requireOwned(session, siteName)
    const count = await this.prisma.secret.count({ where: { siteId: site.id } })
    const exists = await this.prisma.secret.findUnique({ where: { siteId_name: { siteId: site.id, name } } })
    if (!exists && count >= 20) throw new ConflictException({ code: 'TOO_MANY_SECRETS', message: 'at most 20 secrets per site' })
    const valueEnc = this.vault.encrypt(value, { purpose: 'secret', siteId: site.id, name })
    const row = await this.prisma.secret.upsert({
      where: { siteId_name: { siteId: site.id, name } },
      create: { id: randomUUID(), siteId: site.id, name, valueEnc }, update: { valueEnc },
    })
    this.cache.evict(site.name)
    return meta(row)
  }

  /**
   * Rename a secret. The ciphertext is bound to the secret name, so the value is re-encrypted under the new name, and every
   * route header that used ${OLD} now uses ${NEW}, all in one transaction. The value is never returned.
   */
  async rename(session: Session, siteName: string, oldName: string, newName: string) {
    if (!SECRET_NAME_RE.test(newName)) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'secret name must be A-Z, 0-9 and _, starting with a letter (max 64)' })
    const site = await this.sites.requireOwned(session, siteName)
    const row = await this.prisma.secret.findUnique({ where: { siteId_name: { siteId: site.id, name: oldName } } })
    if (!row) throw new NotFoundException({ code: 'SECRET_NOT_FOUND', message: 'no such secret' })
    if (newName === oldName) return meta(row)
    if (await this.prisma.secret.findUnique({ where: { siteId_name: { siteId: site.id, name: newName } } })) {
      throw new ConflictException({ code: 'SECRET_EXISTS', message: 'a secret with this name already exists' })
    }
    const valueEnc = this.vault.encrypt(this.vault.decrypt(row.valueEnc, { purpose: 'secret', siteId: site.id, name: oldName }), { purpose: 'secret', siteId: site.id, name: newName })
    const routes = await this.prisma.route.findMany({ where: { siteId: site.id } })
    const from = '${' + oldName + '}', to = '${' + newName + '}'
    const updated = await this.prisma.$transaction(async (tx) => {
      for (const r of routes) {
        const cfg = r.config as { headers?: Record<string, string> } | null
        if (!cfg?.headers || !Object.values(cfg.headers).some((v) => v.includes(from))) continue
        const headers = Object.fromEntries(Object.entries(cfg.headers).map(([k, v]) => [k, v.split(from).join(to)]))
        await tx.route.update({ where: { id: r.id }, data: { config: { ...cfg, headers } } })
      }
      return tx.secret.update({ where: { id: row.id }, data: { name: newName, valueEnc } })
    })
    this.cache.evict(site.name)
    return meta(updated)
  }

  async remove(session: Session, siteName: string, name: string) {
    const site = await this.sites.requireOwned(session, siteName)
    const routes = await this.prisma.route.findMany({ where: { siteId: site.id } })
    const users = routes.filter((r) => envNames([(r.config as any)?.headers]).includes(name)).map((r) => r.name)
    if (users.length) throw new ConflictException({ code: 'SECRET_IN_USE', message: 'a route still uses this secret', routes: users })
    const r = await this.prisma.secret.deleteMany({ where: { siteId: site.id, name } })
    if (!r.count) throw new NotFoundException({ code: 'SECRET_NOT_FOUND', message: 'no such secret' })
    this.cache.evict(site.name)
  }
}
