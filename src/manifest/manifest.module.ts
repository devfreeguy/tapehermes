import { Module } from '@nestjs/common'
import { SitesModule } from '../sites/sites.module.js'
import { ManifestController } from './manifest.controller.js'
import { ManifestService } from './manifest.service.js'

@Module({ imports: [SitesModule], controllers: [ManifestController], providers: [ManifestService] })
export class ManifestModule {}
