import { Module } from '@nestjs/common'
import { SitesModule } from '../sites/sites.module.js'
import { RoutesController } from './routes.controller.js'
import { RoutesService } from './routes.service.js'

@Module({ imports: [SitesModule], controllers: [RoutesController], providers: [RoutesService] })
export class RoutesModule {}
