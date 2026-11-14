import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import express from 'express'
import { AppModule } from './app.module.js'
import type { AppConfig } from './config/app-config.js'
import { HarnessModule } from './harness/harness.module.js'
import { SiteProvidersService } from './harness/site-providers.service.js'

/**
 * The product app. bodyParser is off globally (the site provider reads the raw request stream itself);
 * JSON parsing is switched on for /api only. Listens on 127.0.0.1 unless a host is given.
 */
export async function createApp(overrides: Partial<AppConfig> = {}, opts: { port?: number; host?: string; trustProxyHops?: number } = {}) {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.register(overrides), { bodyParser: false, logger: ['error', 'warn'] })
  app.use('/api', express.json({ limit: '64kb' }))
  const hops = opts.trustProxyHops ?? overrides.trustProxyHops ?? 0
  if (hops > 0) app.set('trust proxy', hops)
  await app.listen(opts.port ?? 0, opts.host ?? '127.0.0.1')
  const base = `http://127.0.0.1:${new URL(await app.getUrl()).port}`
  return { app, base, stop: () => app.close() }
}

/** Phase 0 proof harness (no database): starts a hand-made registry of providers. Used only by /proofs. */
export async function startApp(configure?: (app: NestExpressApplication) => void, port = 0) {
  const app = await NestFactory.create<NestExpressApplication>(HarnessModule, { bodyParser: false, logger: ['error'] })
  configure?.(app) // e.g. app.use(paymentMiddleware(...)): must run before the routes
  await app.listen(port, '127.0.0.1')
  const base = `http://127.0.0.1:${new URL(await app.getUrl()).port}`
  return { app, registry: app.get(SiteProvidersService), base, stop: () => app.close() }
}
