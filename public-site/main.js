// Entry point: wires the real helper, the real wallet and the real page together. Logic lives in app.js so it can be tested.
import { mount, devSettings } from './app.js'
import { createHermes } from './tapehermes.min.js'

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
  themeToggle.setAttribute('aria-label', label)
  themeToggle.title = label
}

themeToggle.addEventListener('click', () => {
  theme = activeTheme() === 'dark' ? 'light' : 'dark'
  try { localStorage.setItem(themeKey, theme) } catch { /* Storage is unavailable. */ }
  renderTheme()
})
systemTheme.addEventListener('change', renderTheme)
renderTheme()

const hermes = createHermes({ ...devSettings(location), maxPriceUsd: '0.05' }) // never pay more than 5 cents from this page
mount({
  doc: document,
  hermes,
  ethereum: window.ethereum,
  fetchImpl: (...a) => fetch(...a),
  directUrl: 'https://api.nasa.gov/neo/rest/v1/neo/',
})
