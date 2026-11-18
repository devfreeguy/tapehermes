import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common'
import { z } from 'zod'
import { CurrentSession, SessionGuard } from '../auth/session.guard.js'
import type { Session } from '../auth/session.store.js'
import { parseBody } from '../shared/validate.js'
import { ActivationService } from './activation.service.js'

const monthsDto = z.object({ months: z.number().int().min(1).max(12).default(1) })

@Controller('api/sites/:site/activation')
@UseGuards(SessionGuard)
export class ActivationController {
  constructor(private readonly activation: ActivationService) {}

  /** Is the site switched on, until when, and what one month costs (read from the chain now). */
  @Get()
  status(@CurrentSession() s: Session, @Param('site') site: string) { return this.activation.status(s, site) }

  /** The unsigned transaction that switches the site on. Only the holder gets one. */
  @Post('tx') @HttpCode(200)
  tx(@CurrentSession() s: Session, @Param('site') site: string, @Body() body: unknown) {
    return this.activation.txFor(s, site, parseBody(monthsDto, body ?? {}).months)
  }
}
