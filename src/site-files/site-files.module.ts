import { Module } from '@nestjs/common'
import { SitesModule } from '../sites/sites.module.js'
import { SiteFilesController } from './site-files.controller.js'
import { SiteFilesService } from './site-files.service.js'

@Module({ imports: [SitesModule], controllers: [SiteFilesController], providers: [SiteFilesService] })
export class SiteFilesModule {}
