import { Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common'
import { CurrentSession, SessionGuard } from '../auth/session.guard.js'
import type { Session } from '../auth/session.store.js'
import { ManifestService } from './manifest.service.js'

@Controller('api/sites/:site/manifest')
@UseGuards(SessionGuard)
export class ManifestController {
  constructor(private readonly manifests: ManifestService) {}

  @Get()
  preview(@CurrentSession() s: Session, @Param('site') site: string) { return this.manifests.preview(s, site) }

  /** not-published, current or out-of-date, by comparing the on-chain file hash with what we would publish. */
  @Get('status')
  status(@CurrentSession() s: Session, @Param('site') site: string) { return this.manifests.status(s, site) }

  @Post('publish-tx') @HttpCode(200)
  publishTx(@CurrentSession() s: Session, @Param('site') site: string) { return this.manifests.publishTx(s, site) }
}
