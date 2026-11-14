import { Global, Module } from '@nestjs/common'
import { SigningModule } from '../signing/signing.module.js'
import { ProviderCache } from './provider-cache.service.js'

@Global()
@Module({ imports: [SigningModule], providers: [ProviderCache], exports: [ProviderCache, SigningModule] })
export class ProvidersModule {}
