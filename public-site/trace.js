import { englishCopy, message } from './locale.js'

const json = (value) => {
  try { return JSON.parse(value) } catch { return undefined }
}
const payment = (value) => {
  if (!value) return undefined
  try { return json(atob(value)) } catch { return undefined }
}

export function createTrace({ doc, fetchImpl, ethereum, local, explorerUrl, copy = englishCopy }) {
  const activity = doc.getElementById('activity')
  const status = doc.getElementById('run-status')

  function step(title) {
    const row = doc.createElement('li')
    const heading = doc.createElement('strong')
    const detail = doc.createElement('span')
    copy(heading, title)
    copy(detail, 'Pending')
    row.append(heading, detail)
    activity.append(row)
    return {
      finish(value, state = 'ok') {
        copy(detail, value)
        row.dataset.state = state
      },
      data(label, value) {
        if (value === undefined) return
        const disclosure = doc.createElement('details')
        const summary = doc.createElement('summary')
        const code = doc.createElement('pre')
        copy(summary, label)
        code.textContent = JSON.stringify(value, null, 2)
        code.tabIndex = 0
        copy(code, label, 'aria-label')
        disclosure.append(summary, code)
        row.append(disclosure)
      },
      receipt(receipt) {
        if (typeof receipt?.transaction !== 'string' || !receipt.transaction) return
        const hash = receipt.transaction
        const link = !local && /^0x[0-9a-f]{64}$/i.test(hash) && explorerUrl(receipt.network, hash)
        const label = doc.createElement('div')
        copy(label, local ? 'Development receipt' : 'Transaction hash')
        const target = doc.createElement(link ? 'a' : 'code')
        target.textContent = hash
        if (link) {
          target.href = link
          target.target = '_blank'
          target.rel = 'noopener noreferrer'
          copy(target, 'View transaction on X Layer explorer (opens in a new tab)', 'aria-label')
        }
        row.append(label, target)
      },
    }
  }

  async function tracedFetch(url, init) {
    const method = init?.method ?? 'GET'
    const reply = new Headers(init?.headers).has('payment-signature')
    // Show the destination without query parameters or embedded credentials.
    const destination = new URL(url, doc.baseURI)
    const row = step(reply ? 'Retry with payment authorization' : `${method} ${destination.pathname}`)
    row.data('Request JSON', json(init?.body))
    row.data('Request URL', destination.origin + destination.pathname)
    const started = performance.now()
    try {
      const response = await fetchImpl(url, init)
      const elapsed = Math.round(performance.now() - started)
      row.finish(`HTTP ${response.status} · ${elapsed} ms`, response.ok ? 'ok' : response.status === 402 ? 'payment' : 'error')
      const body = await response.clone().json().catch(() => undefined)
      row.data('Response JSON', body)
      const offer = payment(response.headers.get('payment-required'))
      if (offer) row.data('Payment terms', offer)
      const receipt = payment(response.headers.get('payment-response'))
      if (receipt) {
        row.data('Settlement receipt', receipt)
        row.receipt(receipt)
      }
      return response
    } catch (error) {
      row.finish('Request failed before a readable response', 'error')
      throw error
    }
  }

  async function request(input) {
    const row = step(message('Wallet · {0}', input.method))
    try {
      const value = await ethereum.request(input)
      row.finish(input.method === 'eth_signTypedData_v4' ? 'Payment authorization signed' : 'Wallet responded')
      return value
    } catch (error) {
      row.finish(Number(error?.code) === 4001 ? 'Request declined' : 'Wallet request failed', 'error')
      throw error
    }
  }

  return {
    fetch: tracedFetch,
    wallet: ethereum && { request },
    begin(label) { activity.replaceChildren(); copy(status, label) },
    finish(label) { copy(status, label) },
    note(title, detail, state) { step(title).finish(detail, state) },
  }
}
