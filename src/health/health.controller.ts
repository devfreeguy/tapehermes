import { Controller, Get, Res } from '@nestjs/common'
import type { Response } from 'express'
import { PrismaService } from '../database/prisma.service.js'
import { RedisService } from '../redis/redis.service.js'

/** Liveness plus the two stores. Reports only up or down: no URLs, no error text. */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService) {}

  @Get()
  async health(@Res() res: Response) {
    const database = await this.prisma.$queryRaw`SELECT 1`.then(() => true, () => false)
    const redis = await this.redis.ping()
    const ok = database && redis
    res.status(ok ? 200 : 503).json({ ok, database: database ? 'up' : 'down', redis: redis ? 'up' : 'down' })
  }
}
