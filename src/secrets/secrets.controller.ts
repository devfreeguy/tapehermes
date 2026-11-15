import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Put, UseGuards } from '@nestjs/common'
import { z } from 'zod'
import { CurrentSession, SessionGuard } from '../auth/session.guard.js'
import type { Session } from '../auth/session.store.js'
import { parseBody } from '../shared/validate.js'
import { SecretsService } from './secrets.service.js'

const putDto = z.object({ value: z.string().min(1).max(4096) })
const renameDto = z.object({ name: z.string().min(1).max(64) })

@Controller('api/sites/:site/secrets')
@UseGuards(SessionGuard)
export class SecretsController {
  constructor(private readonly secrets: SecretsService) {}

  @Get()
  list(@CurrentSession() s: Session, @Param('site') site: string) { return this.secrets.list(s, site) }

  @Put(':name')
  put(@CurrentSession() s: Session, @Param('site') site: string, @Param('name') name: string, @Body() body: unknown) {
    return this.secrets.put(s, site, name, parseBody(putDto, body).value)
  }

  /** Rename: the value never leaves the server. */
  @Patch(':name')
  rename(@CurrentSession() s: Session, @Param('site') site: string, @Param('name') name: string, @Body() body: unknown) {
    return this.secrets.rename(s, site, name, parseBody(renameDto, body).name)
  }

  @Delete(':name') @HttpCode(204)
  async remove(@CurrentSession() s: Session, @Param('site') site: string, @Param('name') name: string) {
    await this.secrets.remove(s, site, name)
  }
}
