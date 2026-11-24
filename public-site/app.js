// The demo page logic. Everything that comes from outside (answers, errors) is put on the page with textContent only,
// never as HTML, because an answer is text from an outside service.
import { allGood, buildChecks, explainFailure, tamper } from './checks.js'
import { englishCopy, message } from './locale.js'

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

const set = (node, ...kids) => { node.replaceChildren(...kids); return node }
const MARK = { pass: 'Pass', fail: 'Fail', warn: 'Check', info: 'Info' }
const accountPermission = [{ eth_accounts: {} }]
const unsupported = (error) => [-32601, 4200].includes(Number(error?.code))

export function mount({ doc, hermes, ethereum, fetchImpl, directUrl, trace, copy = englishCopy }) {
  const el = (doc, tag, text, cls) => {
    const node = doc.createElement(tag)
    if (text !== undefined) copy(node, text)
    if (cls) node.className = cls
    return node
  }
  const raw = (text) => ({ literal: String(text) })
  const failure = (error) => explainFailure(error, copy === englishCopy ? undefined : message)
  const $ = (id) => doc.getElementById(id)
  let last = null // { result, verdict } of the latest good call
  let walletAccount = null
  let running = false
  const requestWallet = (input) => (trace?.wallet ?? ethereum).request(input)
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
    const fields = [['Container', env.container], ['Request id', env.id], ['Signed at', new Date(env.ts * 1000).toUTCString()], ['Signature', env.sig], ['Recovered signer', verdict.signer ? raw(verdict.signer) : 'none'], ['Manifest signer', verdict.expected]]
    set($('proof-fields'), ...fields.flatMap(([k, v]) => [el(doc, 'dt', k), el(doc, 'dd', v)]))
    $('proof').hidden = false
  }

  async function show(result) {
    const verdict = await hermes.verify(result.proof)
    last = { result, verdict }
    renderChecks(buildChecks(result, verdict, message))
    renderProof(result, verdict)
    $('tamper').disabled = false
    $('direct').disabled = false
    copy($('source-line'), message('Manifest source: {0}{1}.', result.trust.source, result.trust.gateway?.mode ? message(', gateway tier: {0}', result.trust.gateway.mode) : ''))
    return verdict
  }

  function fail(out, e) { set($(out), el(doc, 'p', failure(e), 'bad')) }

  async function run(out, method, params, draw) {
    if (running || walletButton.disabled) return
    running = true
    setWalletBusy(true)
    const controls = [...doc.querySelectorAll('form button'), $('tamper'), $('direct')]
    for (const control of controls) control.disabled = true
    last = null
    $('proof').hidden = true
    set($('side-out'))
    set($('checks'), el(doc, 'li', 'Waiting for the reply.', 'empty'))
    set($(out), el(doc, 'p', 'Working...', 'muted'))
    try {
      await setup
      trace?.begin(message('Running {0}', method))
      if (manifestReady) trace?.note('Load API list', 'Using the manifest already loaded by this page.')
      const result = await hermes.call(method, params)
      set($(out), draw(result.result))
      const verdict = await show(result)
      trace?.note('Verify response signature', verdict.ok ? 'Signature matches the published signer.' : 'Signature check failed.', verdict.ok ? 'ok' : 'error')
      trace?.finish(verdict.ok ? 'Run complete' : 'Response could not be verified')
    } catch (e) {
      fail(out, e)
      set($('checks'), el(doc, 'li', 'No result is available to verify.', 'empty'))
      trace?.note('Action stopped', failure(e), 'error')
      trace?.finish('Run failed')
    } finally {
      running = false
      for (const control of controls) control.disabled = false
      $('tamper').disabled = $('direct').disabled = !last
      setWalletBusy(false)
    }
  }

  // --- wallet
  function setWallet(account) {
    walletAccount = typeof account === 'string' && account ? account : null
    copy(walletButton, walletAccount ? 'Disconnect wallet' : 'Connect wallet')
    switchWalletButton.hidden = !walletAccount
    copy(walletStatus, walletAccount
      ? message('Connected {0}', `${walletAccount.slice(0, 8)}...${walletAccount.slice(-6)}`)
      : 'Wallet disconnected.')
  }

  async function chooseAccount(switching = false) {
    if (!ethereum) { copy(walletStatus, 'No wallet was found in this browser. Install a wallet extension to use the paid actions.'); return }
    setWalletBusy(true)
    try {
      let method = 'eth_accounts'
      try {
        await requestWallet({ method: 'wallet_requestPermissions', params: accountPermission })
      } catch (error) {
        if (!unsupported(error)) throw error
        if (switching) {
          copy(walletStatus, 'Choose another account in your wallet to switch.')
          return
        }
        method = 'eth_requestAccounts'
      }
      const [account] = await requestWallet({ method })
      if (!account) throw new Error('No account was returned')
      setWallet(account)
    } catch (error) {
      if (walletAccount) {
        setWallet(walletAccount)
      } else if (Number(error?.code) === -32002) {
        copy(walletStatus, 'Open your wallet to finish the pending connection.')
      } else {
        copy(walletStatus, 'The wallet did not connect.')
      }
    } finally { setWalletBusy(false) }
  }

  walletButton.addEventListener('click', async () => {
    if (!walletAccount) { await chooseAccount(); return }
    setWalletBusy(true)
    setWallet(null)
    try {
      await requestWallet({ method: 'wallet_revokePermissions', params: accountPermission })
    } catch {
      copy(walletStatus, 'Disconnected here. You can also remove this site’s access in your wallet.')
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
    run('free-out', 'asteroid', { id }, (r) => {
      const box = el(doc, 'div', undefined, 'answer')
      box.append(el(doc, 'div', raw(r.name)), el(doc, 'div', message('Potentially hazardous: {0}', r.hazardous ? 'yes' : 'no')), el(doc, 'div', message('Largest size: about {0} m', Math.round(r.diameterMaxMeters))), el(doc, 'div', message('First recorded approach: {0}', raw(r.firstApproach))))
      return box
    })
  })

  // --- paid routes: the food lookup, and the short AI answer (its section only appears when the manifest offers it)
  function bindPaid({ method, form, input, count, price, out, empty, draw }) {
    const box = $(input)
    const refresh = () => { copy($(count), message('{0} of {1}', box.value.length, box.maxLength)) }
    box.addEventListener('input', refresh); refresh()
    $(form).addEventListener('submit', (ev) => {
      ev.preventDefault()
      const text = box.value.trim()
      if (!text) { set($(out), el(doc, 'p', empty, 'bad')); return }
      if (!walletAccount) { set($(out), el(doc, 'p', 'Connect your wallet before paying.', 'muted')); return }
      if (walletButton.disabled) { set($(out), el(doc, 'p', 'Wait for the current wallet request to finish.', 'muted')); return }
      run(out, method, { [method === 'ask' ? 'input' : 'query']: text }, draw)
    })
    return (m) => { const p = m.tapehermes && m.tapehermes.price && m.tapehermes.price[method]; copy($(price), p ? message('${0} per request', p) : 'not set') }
  }
  const showFood = bindPaid({
    method: 'food', form: 'paid-form', input: 'food-input', count: 'food-count', price: 'food-price', out: 'paid-out', empty: 'Write a food first.',
    draw: (r) => set(el(doc, 'div', undefined, 'answer'), el(doc, 'div', raw(r.description)), el(doc, 'div', raw(`${r.dataType}${r.brand ? `, ${r.brand}` : ''}`)), el(doc, 'div', message('{0} matches in the database', r.matches))),
  })
  const showAi = bindPaid({
    method: 'ask', form: 'ai-form', input: 'ai-input', count: 'ai-count', price: 'ai-price', out: 'ai-out', empty: 'Write a question first.',
    draw: (r) => set(el(doc, 'div', undefined, 'answer'), el(doc, 'span', raw(r.text))),
  })
  let manifestReady = false
  trace?.finish('Loading API list')
  const setup = hermes.manifest().then(({ manifest: m }) => {
    manifestReady = true
    trace?.finish('Ready for an action')
    showFood(m)
    if ((m.methods || []).some((x) => x.name === 'ask')) { $('ai-section').hidden = false; showAi(m) }
  }).catch((e) => { trace?.finish('API list unavailable'); copy($('food-price'), 'unavailable'); set($('paid-out'), el(doc, 'p', failure(e), 'bad')) })

  // --- see for yourself
  $('tamper').addEventListener('click', async () => {
    if (!last || running) return
    const current = last
    const t = tamper(last.result.proof)
    const verdict = await hermes.verify(t.proof)
    if (last !== current) return
    const rows = buildChecks(current.result, verdict, message)
    renderChecks(rows)
    trace?.note('Verify a changed response', verdict.ok ? 'The change was accepted.' : 'The signature no longer matches.', verdict.ok ? 'error' : 'ok')
    set($('side-out'), el(doc, 'p', allGood(rows) ? 'The change was NOT noticed. This should never happen.' : message('One character of "{0}" was changed. The signature check now fails, so a page using this helper would refuse the answer.', raw(t.changed)), allGood(rows) ? 'bad' : 'muted'))
  })

  $('direct').addEventListener('click', async () => {
    if (running) return
    running = true
    $('direct').disabled = true
    set($('side-out'), el(doc, 'p', 'Asking the outside service directly, with no key...', 'muted'))
    try {
      const res = await fetchImpl(`${directUrl}${encodeURIComponent($('asteroid-id').value.trim() || '3542519')}`)
      const body = await res.json().catch(() => ({}))
      set($('side-out'), el(doc, 'p', message('The service answered {0}{1}. It does not answer without a key, and this page does not have one.', res.status, body?.error?.code ? ` (${body.error.code})` : ''), 'muted'))
    } catch { set($('side-out'), el(doc, 'p', 'The service could not be reached from this page.', 'bad')) } finally { running = false; $('direct').disabled = false }
  })

  return { get last() { return last } }
}
