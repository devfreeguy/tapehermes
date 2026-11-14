// Browser half of proof 5. Bundled to dist/pay.js by `pnpm proof:5:page-build`. Any EIP-1193 wallet (window.ethereum).
import { custom, createWalletClient } from 'viem'
import { xLayerTestnet } from 'viem/chains'
import { decodePaymentResponseHeader } from '@okxweb3/x402-fetch'
import { buyerFetch } from '../../src/payments/buyer-fetch.js'

const out = document.getElementById('log') as HTMLPreElement
const log = (m: string) => { out.textContent += `${m}\n` }
const eth = (window as any).ethereum
let account: `0x${string}` | undefined

document.getElementById('connect')!.onclick = async () => {
  try {
    if (!eth) return log('No injected wallet found (window.ethereum is undefined).')
    const wc = createWalletClient({ chain: xLayerTestnet, transport: custom(eth) })
    ;[account] = await wc.requestAddresses()
    try { await wc.switchChain({ id: xLayerTestnet.id }) } catch { await wc.addChain({ chain: xLayerTestnet }); await wc.switchChain({ id: xLayerTestnet.id }) }
    log(`Connected ${account} on chain ${xLayerTestnet.id}`)
  } catch (e: any) { log(`Connect failed: ${e.message}`) }
}

document.getElementById('pay')!.onclick = async () => {
  try {
    if (!account) return log('Connect first.')
    const url = `${location.origin}/sites/demo/tapeapi/v1/paid`
    log('Calling the paid route; your wallet should ask you to sign a payment authorization...')
    const t0 = performance.now()
    const res = await buyerFetch(account, custom(eth))(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 'browser', params: {} }) })
    const h = res.headers.get('payment-response')
    log(`HTTP ${res.status} after ${Math.round(performance.now() - t0)} ms`)
    if (h) log(`PAYMENT-RESPONSE ${JSON.stringify(decodePaymentResponseHeader(h))}`)
    log(`Body ${await res.text()}`)
  } catch (e: any) { log(`Pay failed: ${e.message}`) }
}
