import { Body, Controller, Get, HttpCode, HttpException, Post, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { z } from 'zod'
import { RateLimiter } from '../ratelimit/rate-limiter.service.js'
import { parseBody } from '../shared/validate.js'
import { AuthService } from './auth.service.js'
import { CurrentSession, SessionGuard, type AuthedRequest } from './session.guard.js'
import type { Session } from './session.store.js'

const messageDto = z.object({ address: z.string() })
const verifyDto = z.object({ message: z.string().min(1).max(2000), signature: z.string().regex(/^0x[0-9a-fA-F]+$/).max(4000) })

@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly limiter: RateLimiter) {}

  private async throttle(req: Request, scope: string) {
    const d = await this.limiter.hit(scope, this.limiter.subject(req.ip ?? ''), 20, 60)
    if (!d.allowed) throw new HttpException({ code: 'RATE_LIMITED', message: 'too many attempts', retryAfterSeconds: d.retryAfterSeconds }, 429)
  }

  @Post('message') @HttpCode(200)
  async message(@Req() req: Request, @Body() body: unknown) {
    await this.throttle(req, 'auth-msg')
    return this.auth.issueMessage(parseBody(messageDto, body).address)
  }

  @Post('verify') @HttpCode(200)
  async verify(@Req() req: Request, @Body() body: unknown) {
    await this.throttle(req, 'auth-verify')
    const b = parseBody(verifyDto, body)
    return this.auth.verify(b.message, b.signature)
  }

  @Post('logout') @HttpCode(204) @UseGuards(SessionGuard)
  async logout(@Req() req: AuthedRequest) { await this.auth.logout(req.sessionToken!) }

  @Get('me') @UseGuards(SessionGuard)
  me(@CurrentSession() s: Session) { return { wallet: s.wallet } }
}
