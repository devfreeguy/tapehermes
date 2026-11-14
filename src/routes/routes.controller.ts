import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { CurrentSession, SessionGuard } from '../auth/session.guard.js'
import type { Session } from '../auth/session.store.js'
import { parseBody } from '../shared/validate.js'
import { createRouteSchema, updateRouteSchema } from './route-config.schema.js'
import { RoutesService } from './routes.service.js'

@Controller('api/sites/:site/routes')
@UseGuards(SessionGuard)
export class RoutesController {
  constructor(private readonly routes: RoutesService) {}

  @Get()
  list(@CurrentSession() s: Session, @Param('site') site: string) { return this.routes.list(s, site) }

  @Post() @HttpCode(201)
  create(@CurrentSession() s: Session, @Param('site') site: string, @Body() body: unknown) {
    return this.routes.create(s, site, parseBody(createRouteSchema, body))
  }

  @Patch(':name')
  update(@CurrentSession() s: Session, @Param('site') site: string, @Param('name') name: string, @Body() body: unknown) {
    return this.routes.update(s, site, name, parseBody(updateRouteSchema, body))
  }

  @Delete(':name') @HttpCode(204)
  async remove(@CurrentSession() s: Session, @Param('site') site: string, @Param('name') name: string) {
    await this.routes.remove(s, site, name)
  }
}
