import { createLocale } from './locale.js'

const { copy } = createLocale(document, window)
// Entry point: wires the real helper, the real wallet and the real page together. Logic lives in app.js so it can be tested.
const social = document.getElementById('social-link')
if (social) social.href = 'https://x.com/TapeHermes'

for (const link of document.querySelectorAll('[data-playground]')) {
  if (!['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) continue
  const query = new URLSearchParams(location.search)
  const search = new URLSearchParams()
  for (const key of ['dev', 'rpc']) if (query.has(key)) search.set(key, query.get(key))
  if (search.size) link.href = './playground.html?' + search
}

const themeKey = 'tapehermes-public-theme'
const themeToggle = document.getElementById('theme-toggle')
const systemTheme = matchMedia('(prefers-color-scheme: dark)')
let theme
try {
  const savedTheme = localStorage.getItem(themeKey)
  if (savedTheme === 'light' || savedTheme === 'dark') theme = savedTheme
} catch {
  // Use the device setting when storage is unavailable.
}

function activeTheme() {
  return theme ?? (systemTheme.matches ? 'dark' : 'light')
}

function renderTheme() {
  if (theme) document.documentElement.dataset.theme = theme
  const dark = activeTheme() === 'dark'
  const label = `Switch to ${dark ? 'light' : 'dark'} mode`
  themeToggle.firstElementChild.textContent = dark ? '☾' : '☼'
  copy(themeToggle, label, 'aria-label')
  copy(themeToggle, label, 'title')
}

themeToggle.addEventListener('click', () => {
  theme = activeTheme() === 'dark' ? 'light' : 'dark'
  try { localStorage.setItem(themeKey, theme) } catch { /* Storage is unavailable. */ }
  renderTheme()
})
systemTheme.addEventListener('change', renderTheme)
renderTheme()

if (document.getElementById('activity')) {
  const [{ mount, devSettings }, { createHermes }, { createTrace }] = await Promise.all([
    import('./app.js'), import('./tapehermes.min.js'), import('./trace.js'),
  ])
  const settings = devSettings(location)
  const local = Boolean(settings.dev)
  document.getElementById('dev-notice').hidden = !local
  const trace = createTrace({
    doc: document,
    ethereum: window.ethereum,
    fetchImpl: (...args) => fetch(...args),
    local,
    copy,
    explorerUrl(network, hash) {
      if (network === 'eip155:196') return `https://www.oklink.com/xlayer/tx/${hash}`
      if (network === 'eip155:1952') return `https://www.oklink.com/x-layer-testnet/tx/${hash}`
    },
  })
  const hermes = createHermes({ ...settings, maxPriceUsd: '0.05', fetch: trace.fetch, ethereum: trace.wallet })
  mount({ doc: document, hermes, ethereum: window.ethereum, fetchImpl: trace.fetch, trace, copy,
    directUrl: 'https://api.nasa.gov/neo/rest/v1/neo/',
  })
}
