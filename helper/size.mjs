import { readFileSync } from 'node:fs'
import { gzipSync, brotliCompressSync } from 'node:zlib'
for (const f of ['tapehermes.min.js', 'tapehermes.iife.min.js']) {
  const b = readFileSync(new URL(`./dist/${f}`, import.meta.url))
  console.log(f.padEnd(26), `${b.length} bytes`.padEnd(14), `gzip ${gzipSync(b, { level: 9 }).length}`.padEnd(14), `brotli ${brotliCompressSync(b).length}`)
}
