import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import { z } from 'zod'
import { CurrentSession, SessionGuard } from '../auth/session.guard.js'
import type { Session } from '../auth/session.store.js'
import { PrismaService } from '../database/prisma.service.js'
import { ROUTE_NAME_RE } from '../routes/route-config.schema.js'
import { parseBody } from '../shared/validate.js'
import { SitesService } from '../sites/sites.service.js'

const query = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  before: z.coerce.date().optional(),
  route: z.string().regex(ROUTE_NAME_RE).optional(),
})
const summaryQuery = z.object({ days: z.coerce.number().int().min(1).max(90).default(7) })

/** The owner view of calls. A row holds route, time, result, paid, payment tx, price and duration: nothing about the visitor. */
@Controller('api/sites/:site/logs')
@UseGuards(SessionGuard)
export class LogsController {
  constructor(private readonly prisma: PrismaService, private readonly sites: SitesService) {}

  /** Newest first. `route` narrows to one route; `before` pages backwards. */
  @Get()
  async list(@CurrentSession() s: Session, @Param('site') name: string, @Query() q: unknown) {
    const { limit, before, route } = parseBody(query, q)
    const site = await this.sites.requireOwned(s, name)
    return this.prisma.callLog.findMany({
      where: { siteId: site.id, ...(before ? { at: { lt: before } } : {}), ...(route ? { routeName: route } : {}) },
      orderBy: { at: 'desc' }, take: limit,
      select: { routeName: true, at: true, result: true, errorCode: true, paid: true, paymentTx: true, priceUsd: true, durationMs: true },
    })
  }

  /** Counts per route and result over the last `days` days, plus how many calls were paid and their total in USD. */
  @Get('summary')
  async summary(@CurrentSession() s: Session, @Param('site') name: string, @Query() q: unknown) {
    const { days } = parseBody(summaryQuery, q)
    const site = await this.sites.requireOwned(s, name)
    const since = new Date(Date.now() - days * 86_400_000)
    const where = { siteId: site.id, at: { gte: since } }
    const [byResult, paid] = await Promise.all([
      this.prisma.callLog.groupBy({ by: ['routeName', 'result'], where, _count: { _all: true } }),
      this.prisma.callLog.groupBy({ by: ['routeName'], where: { ...where, paid: true }, _count: { _all: true }, _sum: { priceUsd: true } }),
    ])
    const routes: Record<string, { calls: number; OK: number; ERROR: number; RATE_LIMITED: number; REFUSED: number; paidCalls: number; paidUsd: string }> = {}
    const row = (r: string) => (routes[r] ??= { calls: 0, OK: 0, ERROR: 0, RATE_LIMITED: 0, REFUSED: 0, paidCalls: 0, paidUsd: '0' })
    for (const g of byResult) { const x = row(g.routeName); x[g.result] += g._count._all; x.calls += g._count._all }
    for (const g of paid) { const x = row(g.routeName); x.paidCalls = g._count._all; x.paidUsd = (g._sum.priceUsd ?? 0).toString() }
    const totals = Object.values(routes).reduce(
      (t, r) => ({ calls: t.calls + r.calls, paidCalls: t.paidCalls + r.paidCalls, paidUsd: (Number(t.paidUsd) + Number(r.paidUsd)).toString() }),
      { calls: 0, paidCalls: 0, paidUsd: '0' },
    )
    return { days, since, routes, totals }
  }
}
