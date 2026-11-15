// Run the demo site against the real Phase 2 backend on this computer.
//   pnpm demo:dev            MOCK: fake outside services and a mock payment facilitator. No keys, no network, no money.
//   pnpm demo:dev -- live    LIVE: real NASA and USDA calls (DEMO_NASA_API_KEY, DEMO_USDA_API_KEY; the AI route stays off unless DEMO_ENABLE_AI and DEMO_OPENAI_API_KEY are set) and real OKX testnet payments (OKX_* in .env).
// Uses the TEST database. The page opens against a local manifest source; on the real chain site it reads its own origin instead.
import { requireEnv } from '../src/shared/env.js'
import { startDemo } from './lib/demo-server.js'

process.env.DATABASE_URL = requireEnv('TEST_DATABASE_URL')
process.env.REDIS_PREFIX = 'tapehermes-demo:'
const live = process.argv.includes('live')
const d = await startDemo({ mock: !live, apiPort: Number(process.env.DEMO_API_PORT ?? 3100), sitePort: Number(process.env.DEMO_SITE_PORT ?? 3200) })

console.log(`\nTapeHermes demo (${live ? 'LIVE' : 'MOCK'})\n`)
console.log(`  open:  ${d.pageUrl}\n`)
console.log(`  backend ${d.apiBase}   site ${d.siteUrl}`)
console.log(live
  ? '  Payments settle on X Layer TESTNET (eip155:1952): add that network to your wallet and fund it with test USDT0.'
  : '  Mock mode: payments are checked (your wallet really signs) but nothing is settled. Your wallet still needs the X Layer TESTNET (chain 1952) added.')
console.log('  Press Ctrl+C to stop.\n')
process.on('SIGINT', async () => { await d.stop(); process.exit(0) })
