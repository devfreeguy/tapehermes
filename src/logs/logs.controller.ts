import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import { z } from 'zod'
import { CurrentSession, SessionGuard } from '../auth/session.guard.js'
import type { Session } from '../auth/session.store.js'
import { PrismaService } from '../database/prisma.service.js'
import { parseBody } from '../shared/validate.js'
import { SitesService } from '../sites/sites.service.js'

const query = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50), before: z.coerce.date().optional() })

/** The owner view of calls. A row holds route, time, result, paid, payment tx and duration: nothing about the visitor. */
@Controller('api/sites/:site/logs')
@UseGuards(SessionGuard)
export class LogsController {
  constructor(private readonly prisma: PrismaService, private readonly sites: SitesService) {}

  @Get()
  async list(@CurrentSession() s: Session, @Param('site') name: string, @Query() q: unknown) {
    const { limit, before } = parseBody(query, q)
    const site = await this.sites.requireOwned(s, name)
    const rows = await this.prisma.callLog.findMany({
      where: { siteId: site.id, ...(before ? { at: { lt: before } } : {}) }, orderBy: { at: 'desc' }, take: limit,
      select: { routeName: true, at: true, result: true, errorCode: true, paid: true, paymentTx: true, priceUsd: true, durationMs: true },
    })
    return rows
  }
}
