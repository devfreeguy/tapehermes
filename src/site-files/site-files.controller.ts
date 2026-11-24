import { Body, Controller, HttpCode, Param, Post, UseGuards } from '@nestjs/common'
import { CurrentSession, SessionGuard } from '../auth/session.guard.js'
import type { Session } from '../auth/session.store.js'
import { SiteFilesService } from './site-files.service.js'

@Controller('api/sites/:site/files')
@UseGuards(SessionGuard)
export class SiteFilesController {
  constructor(private readonly files: SiteFilesService) {}

  /** Which files the chain already holds, and the unsigned transactions for the rest. Read only. */
  @Post('plan') @HttpCode(200)
  plan(@CurrentSession() s: Session, @Param('site') site: string, @Body() body: unknown) { return this.files.plan(s, site, body) }
}
