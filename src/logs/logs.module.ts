import { Module } from '@nestjs/common'
import { SitesModule } from '../sites/sites.module.js'
import { LogsController } from './logs.controller.js'

@Module({ imports: [SitesModule], controllers: [LogsController] })
export class LogsModule {}
