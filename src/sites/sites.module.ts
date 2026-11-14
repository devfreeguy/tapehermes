import { Module } from '@nestjs/common'
import { SitesApiController } from './sites.controller.js'
import { SitesService } from './sites.service.js'

@Module({ controllers: [SitesApiController], providers: [SitesService], exports: [SitesService] })
export class SitesModule {}
