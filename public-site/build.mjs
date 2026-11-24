// Prepares the public site for publishing: copies the built helper into this folder, then writes dist/site-bundle.json,
// the one file the dashboard takes (the site as it will be stored on the chain).
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { makeBundle } from './bundle.mjs'

const from = new URL('../helper/dist/tapehermes.min.js', import.meta.url)
const to = new URL('./tapehermes.min.js', import.meta.url)
copyFileSync(from, to)
console.log(`copied the helper into ${fileURLToPath(to)}`)

const bundle = makeBundle()
const out = new URL('./dist/site-bundle.json', import.meta.url)
mkdirSync(new URL('./dist/', import.meta.url), { recursive: true })
writeFileSync(out, JSON.stringify(bundle))
const bytes = bundle.files.reduce((n, f) => n + Buffer.from(f.content, 'base64').length, 0)
console.log(`wrote ${fileURLToPath(out)}: ${bundle.files.length} files, ${bytes} bytes`)
