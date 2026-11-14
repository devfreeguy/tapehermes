import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException, createParamDecorator } from '@nestjs/common'
import type { Request } from 'express'
import { SessionStore, type Session } from './session.store.js'

export type AuthedRequest = Request & { session?: Session; sessionToken?: string }

export const bearerOf = (req: Request): string => {
  const h = req.headers.authorization ?? ''
  return h.startsWith('Bearer ') ? h.slice(7).trim() : ''
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessions: SessionStore) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>()
    const token = bearerOf(req)
    const s = token ? await this.sessions.get(token) : null
    if (!s) throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'sign in first' })
    req.session = s
    req.sessionToken = token
    return true
  }
}

export const CurrentSession = createParamDecorator((_d: unknown, ctx: ExecutionContext): Session => ctx.switchToHttp().getRequest<AuthedRequest>().session!)
