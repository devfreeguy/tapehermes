import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common'
import { z } from 'zod'
import { CurrentSession, SessionGuard } from '../auth/session.guard.js'
import type { Session } from '../auth/session.store.js'
import { parseBody } from '../shared/validate.js'
import { SitesService } from './sites.service.js'

const registerDto = z.object({ name: z.string().min(1).max(100) })
const statusDto = z.object({ status: z.enum(['ACTIVE', 'DISABLED']) })
const payoutDto = z.object({ payoutAddress: z.string() })
const delegationDto = z.object({ signature: z.string().regex(/^0x(?:[0-9a-fA-F]{2}){65}$/), expires: z.number().int().positive() })
const daysDto = z.object({ days: z.coerce.number().min(1).max(366).default(30) })

@Controller('api/sites')
@UseGuards(SessionGuard)
export class SitesApiController {
  constructor(private readonly sites: SitesService) {}

  @Post() @HttpCode(200)
  register(@CurrentSession() s: Session, @Body() body: unknown) { return this.sites.register(s, parseBody(registerDto, body).name) }

  @Get()
  list(@CurrentSession() s: Session) { return this.sites.list(s) }

  @Get(':name')
  get(@CurrentSession() s: Session, @Param('name') name: string) { return this.sites.get(s, name) }

  @Patch(':name/status')
  status(@CurrentSession() s: Session, @Param('name') name: string, @Body() body: unknown) {
    return this.sites.setStatus(s, name, parseBody(statusDto, body).status)
  }

  @Put(':name/payout')
  payout(@CurrentSession() s: Session, @Param('name') name: string, @Body() body: unknown) {
    return this.sites.setPayout(s, name, parseBody(payoutDto, body).payoutAddress)
  }

  /** The exact typed data to sign, for ?days=1..366 (default 30). */
  @Get(':name/delegation/message')
  delegationMessage(@CurrentSession() s: Session, @Param('name') name: string, @Query() q: unknown) {
    return this.sites.delegationMessage(s, name, parseBody(daysDto, q).days)
  }

  @Put(':name/delegation')
  delegation(@CurrentSession() s: Session, @Param('name') name: string, @Body() body: unknown) {
    const b = parseBody(delegationDto, body)
    return this.sites.saveDelegation(s, name, b.signature, b.expires)
  }
}
