import { Module } from '@nestjs/common'
import { ActivationController } from './activation.controller.js'
import { ActivationService } from './activation.service.js'
import { SitesApiController } from './sites.controller.js'
import { SitesService } from './sites.service.js'

@Module({ controllers: [SitesApiController, ActivationController], providers: [SitesService, ActivationService], exports: [SitesService] })
export class SitesModule {}
