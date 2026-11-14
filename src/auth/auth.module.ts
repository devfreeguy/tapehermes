import { Global, Module } from '@nestjs/common'
import { AuthController } from './auth.controller.js'
import { AuthService } from './auth.service.js'
import { SessionGuard } from './session.guard.js'
import { SessionStore } from './session.store.js'

@Global()
@Module({ controllers: [AuthController], providers: [AuthService, SessionStore, SessionGuard], exports: [SessionStore, SessionGuard] })
export class AuthModule {}
