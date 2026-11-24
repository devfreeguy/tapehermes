// The demo page logic. Everything that comes from outside (answers, errors) is put on the page with textContent only,
// never as HTML, because an answer is text from an outside service.
import { allGood, buildChecks, explainFailure, tamper } from './checks.js'

const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * Helper options taken from the address (?dev=SITE_URL, ?rpc=URL). A development manifest source is honoured ONLY when the
 * page itself is served from this computer, so a link on the real site can never point the page at someone else's manifest.
 */
export function devSettings(loc) {
  const q = new URLSearchParams(loc.search)
  const dev = q.get('dev'), rpc = q.get('rpc')
  return { ...(dev && LOCAL.has(loc.hostname) ? { dev: { siteUrl: dev } } : {}), ...(rpc ? { rpcUrl: rpc } : {}) }
}

const el = (doc, tag, text, cls) => { const e = doc.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e }
const set = (node, ...kids) => { node.replaceChildren(...kids); return node }
const MARK = { pass: 'Pass', fail: 'Fail', warn: 'Check', info: 'Info' }
const accountPermission = [{ eth_accounts: {} }]
const unsupported = (error) => [-32601, 4200].includes(Number(error?.code))

export function mount({ doc, hermes, ethereum, fetchImpl, directUrl }) {
  const $ = (id) => doc.getElementById(id)
  let last = null // { result, verdict } of the latest good call
  let walletAccount = null
  const walletButton = $('connect')
  const switchWalletButton = $('switch-wallet')
  const walletStatus = $('wallet-status')

  function setWalletBusy(busy) {
    walletButton.disabled = busy
    switchWalletButton.disabled = busy
  }

  function renderChecks(rows) {
    set($('checks'), ...rows.map((r) => {
      const li = el(doc, 'li'); li.dataset.status = r.status; li.dataset.id = r.id
      const body = el(doc, 'div'); body.append(el(doc, 'div', r.label, 'what'), el(doc, 'div', r.detail, 'why'))
      li.append(el(doc, 'span', MARK[r.status], 'mark'), body)
      return li
    }))
  }

  function renderProof(result, verdict) {
    const env = result.proof.envelope
    const fields = [['Container', env.container], ['Request id', env.id], ['Signed at', new Date(env.ts * 1000).toUTCString()], ['Signature', env.sig], ['Recovered signer', verdict.signer || 'none'], ['Manifest signer', verdict.expected]]
    set($('proof-fields'), ...fields.flatMap(([k, v]) => [el(doc, 'dt', k), el(doc, 'dd', v)]))
    $('proof').hidden = false
  }

  async function show(result) {
    const verdict = await hermes.verify(result.proof)
    last = { result, verdict }
    renderChecks(buildChecks(result, verdict))
    renderProof(result, verdict)
    $('tamper').disabled = false
    $('direct').disabled = false
    $('source-line').textContent = `Manifest source: ${result.trust.source}${result.trust.gateway && result.trust.gateway.mode ? `, gateway tier: ${result.trust.gateway.mode}` : ''}.`
    return verdict
  }

  function fail(out, e) { set($(out), el(doc, 'p', explainFailure(e), 'bad')) }

  async function run(out, button, method, params, draw) {
    const usesWallet = method !== 'asteroid'
    if (usesWallet) setWalletBusy(true)
    button.disabled = true
    set($(out), el(doc, 'p', 'Working...', 'muted'))
    try {
      const result = await hermes.call(method, params)
      set($(out), draw(result.result))
      await show(result)
    } catch (e) { fail(out, e) } finally {
      button.disabled = false
      if (usesWallet) setWalletBusy(false)
    }
  }

  // --- wallet
  function setWallet(account) {
    walletAccount = typeof account === 'string' && account ? account : null
    walletButton.textContent = walletAccount ? 'Disconnect wallet' : 'Connect wallet'
    switchWalletButton.hidden = !walletAccount
    walletStatus.textContent = walletAccount
      ? `Connected ${walletAccount.slice(0, 8)}...${walletAccount.slice(-6)}`
      : 'Wallet disconnected.'
  }

  async function chooseAccount(switching = false) {
    if (!ethereum) { walletStatus.textContent = 'No wallet was found in this browser. Install a wallet extension to use the paid actions.'; return }
    setWalletBusy(true)
    try {
      let method = 'eth_accounts'
      try {
        await ethereum.request({ method: 'wallet_requestPermissions', params: accountPermission })
      } catch (error) {
        if (!unsupported(error)) throw error
        if (switching) {
          walletStatus.textContent = 'Choose another account in your wallet to switch.'
          return
        }
        method = 'eth_requestAccounts'
      }
      const [account] = await ethereum.request({ method })
      if (!account) throw new Error('No account was returned')
      setWallet(account)
    } catch (error) {
      if (walletAccount) {
        setWallet(walletAccount)
      } else if (Number(error?.code) === -32002) {
        walletStatus.textContent = 'Open your wallet to finish the pending connection.'
      } else {
        walletStatus.textContent = 'The wallet did not connect.'
      }
    } finally { setWalletBusy(false) }
  }

  walletButton.addEventListener('click', async () => {
    if (!walletAccount) { await chooseAccount(); return }
    setWalletBusy(true)
    setWallet(null)
    try {
      await ethereum.request({ method: 'wallet_revokePermissions', params: accountPermission })
    } catch {
      walletStatus.textContent = 'Disconnected here. You can also remove this site’s access in your wallet.'
    } finally { setWalletBusy(false) }
  })
  switchWalletButton.addEventListener('click', () => chooseAccount(true))
  ethereum?.on?.('accountsChanged', (accounts) => { if (walletAccount) setWallet(accounts[0]) })
  ethereum?.on?.('disconnect', () => { if (walletAccount) setWallet(null) })

  // --- free route
  $('free-form').addEventListener('submit', (ev) => {
    ev.preventDefault()
    const id = $('asteroid-id').value.trim()
    if (!/^\d{1,10}$/.test(id)) { set($('free-out'), el(doc, 'p', 'Enter the asteroid number, digits only.', 'bad')); return }
    run('free-out', ev.submitter ?? $('free-form').querySelector('button'), 'asteroid', { id }, (r) => {
      const box = el(doc, 'div', undefined, 'answer')
      box.append(el(doc, 'div', `${r.name}`), el(doc, 'div', `Potentially hazardous: ${r.hazardous ? 'yes' : 'no'}`), el(doc, 'div', `Largest size: about ${Math.round(r.diameterMaxMeters)} m`), el(doc, 'div', `First recorded approach: ${r.firstApproach}`))
      return box
    })
  })

  // --- paid routes: the food lookup, and the short AI answer (its section only appears when the manifest offers it)
  function bindPaid({ method, form, input, count, price, out, button, empty, draw }) {
    const box = $(input)
    const refresh = () => { $(count).textContent = `${box.value.length} of ${box.maxLength}` }
    box.addEventListener('input', refresh); refresh()
    $(form).addEventListener('submit', (ev) => {
      ev.preventDefault()
      const text = box.value.trim()
      if (!text) { set($(out), el(doc, 'p', empty, 'bad')); return }
      if (!walletAccount) { set($(out), el(doc, 'p', 'Connect your wallet before paying.', 'muted')); return }
      if (walletButton.disabled) { set($(out), el(doc, 'p', 'Wait for the current wallet request to finish.', 'muted')); return }
      run(out, ev.submitter ?? $(form).querySelector(button), method, { [method === 'ask' ? 'input' : 'query']: text }, draw)
    })
    return (m) => { const p = m.tapehermes && m.tapehermes.price && m.tapehermes.price[method]; $(price).textContent = p ? `$${p} per request` : 'not set' }
  }
  const showFood = bindPaid({
    method: 'food', form: 'paid-form', input: 'food-input', count: 'food-count', price: 'food-price', out: 'paid-out', button: 'button', empty: 'Write a food first.',
    draw: (r) => set(el(doc, 'div', undefined, 'answer'), el(doc, 'div', r.description), el(doc, 'div', `${r.dataType}${r.brand ? `, ${r.brand}` : ''}`), el(doc, 'div', `${r.matches} matches in the database`)),
  })
  const showAi = bindPaid({
    method: 'ask', form: 'ai-form', input: 'ai-input', count: 'ai-count', price: 'ai-price', out: 'ai-out', button: 'button', empty: 'Write a question first.',
    draw: (r) => set(el(doc, 'div', undefined, 'answer'), el(doc, 'span', r.text)),
  })
  hermes.manifest().then(({ manifest: m }) => {
    showFood(m)
    if ((m.methods || []).some((x) => x.name === 'ask')) { $('ai-section').hidden = false; showAi(m) }
  }).catch((e) => { $('food-price').textContent = 'unavailable'; set($('paid-out'), el(doc, 'p', explainFailure(e), 'bad')) })

  // --- see for yourself
  $('tamper').addEventListener('click', async () => {
    if (!last) return
    const t = tamper(last.result.proof)
    const verdict = await hermes.verify(t.proof)
    const rows = buildChecks(last.result, verdict)
    renderChecks(rows)
    set($('side-out'), el(doc, 'p', allGood(rows) ? 'The change was NOT noticed. This should never happen.' : `One character of "${t.changed}" was changed. The signature check now fails, so a page using this helper would refuse the answer.`, allGood(rows) ? 'bad' : 'muted'))
  })

  $('direct').addEventListener('click', async () => {
    set($('side-out'), el(doc, 'p', 'Asking the outside service directly, with no key...', 'muted'))
    try {
      const res = await fetchImpl(`${directUrl}${encodeURIComponent($('asteroid-id').value.trim() || '3542519')}`)
      const body = await res.json().catch(() => ({}))
      set($('side-out'), el(doc, 'p', `The service answered ${res.status}${body && body.error && body.error.code ? ` (${body.error.code})` : ''}. It does not answer without a key, and this page does not have one.`, 'muted'))
    } catch { set($('side-out'), el(doc, 'p', 'The service could not be reached from this page.', 'bad')) }
  })

  return { get last() { return last } }
}
