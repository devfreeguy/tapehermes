// Local preview of the public site against the LIVE TapeHermes API. Run it in your own terminal: pnpm site:dev
// The site is not on the chain yet, so the page cannot read its own manifest from its own address. The ?dev= setting
// makes it read the manifest through the API instead (the page honours that setting only on this computer).
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = fileURLToPath(new URL('.', import.meta.url))
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' }
/** Exactly the files that get published. Nothing else in this folder is ever served. */
export const SITE_FILES = ['index.html', 'styles.css', 'app.js', 'main.js', 'checks.js', 'tapehermes.min.js']
export const DEFAULT_API = 'https://api.tapehermes.xyz/sites/26.2.2.tape'

export function startDevServer({ port = 3200, api = DEFAULT_API } = {}) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (url.pathname === '/' && !url.search) { res.writeHead(302, { location: `/?dev=${encodeURIComponent(api)}` }).end(); return }
    const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1)
    if (!SITE_FILES.includes(name)) { res.writeHead(404, { 'content-type': 'text/plain' }).end('not found'); return }
    res.writeHead(200, { 'content-type': TYPES[extname(name)], 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }).end(await readFile(join(DIR, name)))
  })
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok(server)))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT ?? 3200)
  await startDevServer({ port, api: process.env.SITE_API ?? DEFAULT_API })
  console.log(`public site: http://127.0.0.1:${port}/  (reads the API list through ${process.env.SITE_API ?? DEFAULT_API})`)
}
