import { Module, type DynamicModule } from '@nestjs/common'
import { AuthModule } from './auth/auth.module.js'
import { CallsModule } from './calls/calls.module.js'
import { ChainModule } from './chain/chain.module.js'
import type { AppConfig } from './config/app-config.js'
import { ConfigModule } from './config/config.module.js'
import { PrismaModule } from './database/prisma.module.js'
import { HealthModule } from './health/health.module.js'
import { LogsModule } from './logs/logs.module.js'
import { ProvidersModule } from './providers/providers.module.js'
import { RateLimitModule } from './ratelimit/ratelimit.module.js'
import { RedisModule } from './redis/redis.module.js'
import { RoutesModule } from './routes/routes.module.js'
import { SecretsModule } from './secrets/secrets.module.js'
import { SitesModule } from './sites/sites.module.js'
import { VaultModule } from './vault/vault.module.js'

@Module({})
export class AppModule {
  /** `overrides` replaces single settings (tests use it); everything else comes from the environment. */
  static register(overrides: Partial<AppConfig> = {}): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(overrides), PrismaModule, RedisModule, VaultModule, RateLimitModule, ChainModule, ProvidersModule,
        AuthModule, SitesModule, SecretsModule, RoutesModule, LogsModule, HealthModule, CallsModule,
      ],
    }
  }
}
