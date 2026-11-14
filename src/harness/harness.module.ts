import { Module } from '@nestjs/common'
import { SiteProvidersService } from './site-providers.service.js'
import { SitesController } from './sites.controller.js'

/** Phase 0 proof harness: a registry of hand-made providers, no database. Used only by /proofs. */
@Module({ controllers: [SitesController], providers: [SiteProvidersService], exports: [SiteProvidersService] })
export class HarnessModule {}
