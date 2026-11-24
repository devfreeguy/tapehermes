// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { SITE_FILES, startDevServer } from '../dev-server.mjs'

let server, base
beforeAll(async () => { server = await startDevServer({ port: 0, api: 'https://api.example.test/sites/x.tape' }); base = `http://127.0.0.1:${server.address().port}` })
afterAll(() => new Promise((ok) => server.close(ok)))

describe('the local preview server', () => {
  it('sends the bare address to the page with the API list source set', async () => {
    const r = await fetch(`${base}/`, { redirect: 'manual' })
    expect(r.status).toBe(302)
    expect(r.headers.get('location')).toBe(`/?dev=${encodeURIComponent('https://api.example.test/sites/x.tape')}`)
  })

  it('opens the standalone playground with the API list source set', async () => {
    const r = await fetch(`${base}/playground.html`)
    expect(r.status).toBe(200)
    expect(new URL(r.url).searchParams.get('dev')).toBe('https://api.example.test/sites/x.tape')
    expect(await r.text()).toContain('<h1 data-en="API Playground">API 试用台</h1>')
    for (const asset of ['playground.css', 'trace.js', 'locale.js']) {
      expect((await fetch(`${base}/${asset}`)).status).toBe(200)
    }
  })

  it('serves every published file with a type the browser will run', async () => {
    for (const f of SITE_FILES) {
      const r = await fetch(`${base}/${f === 'index.html' ? '?x=1' : f}`)
      expect(r.status, f).toBe(200)
      expect(r.headers.get('content-type'), f).toMatch(/^(text\/html|text\/css|text\/javascript)/)
    }
  })

  it('serves nothing else: not the route settings, the design notes, the tests or anything outside the folder', async () => {
    for (const p of ['/routes.json', '/design/BRIEF.md', '/package.json', '/tests/app.test.js', '/dev-server.mjs', '/..%2fpackage.json', '/%2e%2e/package.json']) {
      expect((await fetch(`${base}${p}`)).status, p).toBe(404)
    }
  })
})
