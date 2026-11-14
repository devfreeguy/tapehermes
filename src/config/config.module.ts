import { Global, Module, type DynamicModule } from '@nestjs/common'
import { APP_CONFIG, loadConfig, type AppConfig } from './app-config.js'

@Global()
@Module({})
export class ConfigModule {
  static forRoot(overrides: Partial<AppConfig> = {}): DynamicModule {
    return { module: ConfigModule, providers: [{ provide: APP_CONFIG, useFactory: () => loadConfig(process.env, overrides) }], exports: [APP_CONFIG] }
  }
}
