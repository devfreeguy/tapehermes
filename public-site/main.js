// Entry point: wires the real helper, the real wallet and the real page together. Logic lives in app.js so it can be tested.
import { mount, devSettings } from './app.js'
import { createHermes } from './tapehermes.min.js'

const hermes = createHermes({ ...devSettings(location), maxPriceUsd: '0.05' }) // never pay more than 5 cents from this page
mount({
  doc: document,
  hermes,
  ethereum: window.ethereum,
  fetchImpl: (...a) => fetch(...a),
  directUrl: 'https://api.nasa.gov/neo/rest/v1/neo/',
})
