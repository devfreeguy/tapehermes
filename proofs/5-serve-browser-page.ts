// Proof 5 (browser half): serves the paid demo and the wallet page at a fixed local port, until Ctrl+C.
// `pnpm proof:5:serve -- mock` uses the local mock facilitator (OKX not involved; nothing is settled).
import { startPaidDemo } from './lib/paid-demo.js'

const PORT = 8787
const mock = process.argv.includes('mock')
const demo = await startPaidDemo({ port: PORT, mock })
console.log(`\nOpen in the browser that has your wallet:  http://127.0.0.1:${PORT}/pay/pay.html`)
console.log(`Paid endpoint: ${demo.url}   (testnet eip155:1952, $0.001)${mock ? '   MOCK facilitator: nothing is settled' : ''}\nCtrl+C to stop.`)
