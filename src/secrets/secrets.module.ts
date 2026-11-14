import { Module } from '@nestjs/common'
import { SitesModule } from '../sites/sites.module.js'
import { SecretsController } from './secrets.controller.js'
import { SecretsService } from './secrets.service.js'

@Module({ imports: [SitesModule], controllers: [SecretsController], providers: [SecretsService] })
export class SecretsModule {}
