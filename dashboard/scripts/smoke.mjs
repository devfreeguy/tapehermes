// Smoke test of the PRODUCTION build: starts it, fetches the pages, and checks what the server really sends.
// A strict CSP only works if every script carries the request nonce, which only a real build can show.
import { spawn } from 'node:child_process'

const PORT = 3911
const API = 'http://127.0.0.1:3000'
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(PORT)], { env: { ...process.env, NEXT_PUBLIC_API_URL: API }, stdio: 'ignore' })
const fails = []
const check = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) fails.push(msg) }

async function up() { for (let i = 0; i < 60; i++) { try { await fetch(`http://127.0.0.1:${PORT}/`); return } catch { await new Promise((r) => setTimeout(r, 1000)) } } throw new Error('server did not start') }

try {
  await up()
  for (const path of ['/', '/guide', '/sites', '/sites/secrets', '/sites/routes', '/sites/routes/new', '/sites/delegation', '/sites/manifest', '/sites/logs', '/sites/1.2.396.tape/manifest']) {
    const res = await fetch(`http://127.0.0.1:${PORT}${path}`)
    const html = await res.text()
    const csp = res.headers.get('content-security-policy') ?? ''
    const nonce = /'nonce-([^']+)'/.exec(csp)?.[1]
    check(res.status === 200, `${path}: 200`)
    check(!!nonce, `${path}: has a CSP with a nonce`)
    const tags = [...html.matchAll(/<script\b([^>]*)>/g)].map((m) => m[1])
    check(tags.length > 0 && tags.every((t) => nonce && t.includes(`nonce="${nonce}"`)), `${path}: every script tag (${tags.length}) carries the request nonce`)
    check(tags.every((t) => !/src="https?:/.test(t) && (!/src=/.test(t) || /src="\/_next\//.test(t))), `${path}: no script from another origin`)
    check(!/\son(click|load|error)=/i.test(html), `${path}: no inline event handlers`)
    check(!csp.includes("'unsafe-inline'") || csp.split('; ').find((d) => d.startsWith('script-src ')).indexOf('unsafe-inline') === -1, `${path}: script-src has no unsafe-inline`)
    check(csp.includes(`connect-src 'self' ${API}`), `${path}: connect-src is this page and the API only`)
    check(res.headers.get('x-content-type-options') === 'nosniff' && res.headers.get('referrer-policy') === 'no-referrer' && !res.headers.get('x-powered-by'), `${path}: security headers set, no x-powered-by`)
  }
  // Addresses the app does not have are a real 404, still with the CSP and a nonce on every script, and crawlers are kept out.
  for (const path of ['/no-such-page', '/sites/not-a-site', '/sites/1.2.396.tape/no-such-tab']) {
    const res = await fetch(`http://127.0.0.1:${PORT}${path}`)
    const html = await res.text()
    const csp = res.headers.get('content-security-policy') ?? ''
    const nonce = /'nonce-([^']+)'/.exec(csp)?.[1]
    const tags = [...html.matchAll(/<script\b([^>]*)>/g)].map((m) => m[1])
    check(res.status === 404, `${path}: 404`)
    check(html.includes('Page not found'), `${path}: shows the not-found page`)
    check(!!nonce && tags.every((t) => t.includes(`nonce="${nonce}"`)), `${path}: CSP nonce on every script (${tags.length})`)
  }
  const robots = await fetch(`http://127.0.0.1:${PORT}/robots.txt`)
  check(robots.status === 200 && /Disallow: \//.test(await robots.text()), '/robots.txt disallows everything')
  const home = await (await fetch(`http://127.0.0.1:${PORT}/`)).text()
  check(/<meta name="robots" content="noindex, nofollow"/.test(home), 'pages carry noindex, nofollow')
  const a = (await fetch(`http://127.0.0.1:${PORT}/`)).headers.get('content-security-policy')
  const b = (await fetch(`http://127.0.0.1:${PORT}/`)).headers.get('content-security-policy')
  check(a !== b, 'a fresh nonce for every request')
} finally { server.kill() }
if (fails.length) { console.log(`\n${fails.length} check(s) failed`); process.exit(1) }
console.log('\nsmoke test passed')
