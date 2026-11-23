// Copies the built helper into the demo site folder, so the folder is complete and self-contained (this is what gets published).
import { copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const from = new URL('../helper/dist/tapehermes.min.js', import.meta.url)
const to = new URL('./tapehermes.min.js', import.meta.url)
copyFileSync(from, to)
console.log(`copied the helper into ${fileURLToPath(to)}`)
