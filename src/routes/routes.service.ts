import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { envNames } from '../web2-adapter/adapter.mjs'
import type { Session } from '../auth/session.store.js'
import { PrismaService } from '../database/prisma.service.js'
import { ProviderCache } from '../providers/provider-cache.service.js'
import { SitesService } from '../sites/sites.service.js'
import { hostedMethods } from '../worker/hosted-methods.js'
import { secretOutsideHeaders, type RouteConfig } from './route-config.schema.js'
import type { Route } from '../generated/prisma/client.js'

const MAX_ROUTES = 50
const shape = (r: Route) => ({
  name: r.name, config: r.config, priceUsd: r.priceUsd.toString(), enabled: r.enabled, rateLimitPerMin: r.rateLimitPerMin, updatedAt: r.updatedAt,
})

/** Routes are settings only. Every change is checked against the hosted rules BEFORE it is saved. */
@Injectable()
export class RoutesService {
  constructor(private readonly prisma: PrismaService, private readonly sites: SitesService, private readonly cache: ProviderCache) {}

  async list(session: Session, siteName: string) {
    const site = await this.sites.requireOwned(session, siteName)
    return (await this.prisma.route.findMany({ where: { siteId: site.id }, orderBy: { name: 'asc' } })).map(shape)
  }

  /** Throws 400 with the reason when the whole set of enabled routes would break the hosted rules. */
  private async assertAllowed(siteId: string, routes: { name: string; config: RouteConfig; enabled: boolean }[]) {
    const secretNames = new Set((await this.prisma.secret.findMany({ where: { siteId }, select: { name: true } })).map((s) => s.name))
    const enabled = routes.filter((r) => r.enabled)
    for (const r of enabled) {
      if (secretOutsideHeaders(r.config)) throw new BadRequestException({ code: 'SECRET_NOT_IN_HEADER', message: `route ${r.name}: secrets may only be used in headers` })
      for (const n of envNames([r.config.headers])) {
        if (!secretNames.has(n)) throw new BadRequestException({ code: 'UNKNOWN_SECRET', message: `route ${r.name}: header uses secret ${n}, which is not saved for this site` })
      }
    }
    try {
      hostedMethods({ methods: Object.fromEntries(enabled.map((r) => [r.name, r.config])) }, Object.fromEntries([...secretNames].map((n) => [n, 'x'])))
    } catch (e) {
      // The adapter message names the rule that failed (https only, host limit, header not allowed...) and holds no secret.
      throw new BadRequestException({ code: 'ROUTE_REFUSED', message: (e as Error).message.slice(0, 300) })
    }
  }

  async create(session: Session, siteName: string, input: { name: string; config: RouteConfig; priceUsd: string; enabled: boolean; rateLimitPerMin: number }) {
    const site = await this.sites.requireOwned(session, siteName)
    const current = await this.prisma.route.findMany({ where: { siteId: site.id } })
    if (current.some((r) => r.name === input.name)) throw new ConflictException({ code: 'ROUTE_EXISTS', message: 'a route with this name exists' })
    if (current.length >= MAX_ROUTES) throw new ConflictException({ code: 'TOO_MANY_ROUTES', message: `at most ${MAX_ROUTES} routes per site` })
    await this.assertAllowed(site.id, [...current.map((r) => ({ name: r.name, config: r.config as RouteConfig, enabled: r.enabled })), input])
    const row = await this.prisma.route.create({
      data: { id: randomUUID(), siteId: site.id, name: input.name, config: input.config, priceUsd: input.priceUsd, enabled: input.enabled, rateLimitPerMin: input.rateLimitPerMin },
    })
    this.cache.evict(site.name)
    return shape(row)
  }

  async update(session: Session, siteName: string, name: string, patch: { config?: RouteConfig; priceUsd?: string; enabled?: boolean; rateLimitPerMin?: number }) {
    const site = await this.sites.requireOwned(session, siteName)
    const current = await this.prisma.route.findMany({ where: { siteId: site.id } })
    const target = current.find((r) => r.name === name)
    if (!target) throw new NotFoundException({ code: 'ROUTE_NOT_FOUND', message: 'no such route' })
    const merged = { config: patch.config ?? (target.config as RouteConfig), enabled: patch.enabled ?? target.enabled }
    await this.assertAllowed(site.id, current.map((r) => (r.id === target.id ? { name, ...merged } : { name: r.name, config: r.config as RouteConfig, enabled: r.enabled })))
    const row = await this.prisma.route.update({
      where: { id: target.id },
      data: { config: merged.config, enabled: merged.enabled, priceUsd: patch.priceUsd ?? target.priceUsd, rateLimitPerMin: patch.rateLimitPerMin ?? target.rateLimitPerMin },
    })
    this.cache.evict(site.name)
    return shape(row)
  }

  async remove(session: Session, siteName: string, name: string) {
    const site = await this.sites.requireOwned(session, siteName)
    const r = await this.prisma.route.deleteMany({ where: { siteId: site.id, name } })
    if (!r.count) throw new NotFoundException({ code: 'ROUTE_NOT_FOUND', message: 'no such route' })
    this.cache.evict(site.name)
  }
}
