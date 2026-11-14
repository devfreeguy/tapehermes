// Proof 1: ES-module-only @tapeapi/sdk and @tapeapi/server run inside NestJS 12.
import * as sdk from '@tapeapi/sdk'
import * as server from '@tapeapi/server'
import { startApp } from '../src/bootstrap.js'
import { createSiteProvider } from '../src/providers/create-site-provider.js'
import { callSite } from '../src/sites/call-site.js'
import { expect, info, step } from '../src/shared/log.js'

step('libraries load as ES modules')
expect(typeof sdk.createTapeAPI === 'function', `@tapeapi/sdk ${(sdk as any).VERSION ?? ''} loaded`)
expect(server.VERSION === '3.0.0', `@tapeapi/server ${server.VERSION} loaded`)

step('Nest app serves a signed answer from a provider')
const { registry, base, stop } = await startApp()
const zero = '0x0000000000000000000000000000000000000000'
registry.add('demo', createSiteProvider({
  name: 'demo', circuits: zero, tokenId: '0', container: zero, chainId: 196, rpcUrls: [],
  methods: { ping: async () => ({ pong: true }) },
}))
registry.publishAt(base)

const { svc, answer } = await callSite(`${base}/sites/demo`, 'ping')
info(`manifest signer ${svc.manifest.signer}`)
expect((answer.result as any).pong === true, 'result returned through Nest')
expect(answer.verified === true, 'SDK verified the signature')
await stop()
