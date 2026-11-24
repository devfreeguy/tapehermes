import { createHash, randomBytes } from 'node:crypto'
import { createTapeAPI, MANIFEST_KEY } from '@tapeapi/sdk'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildFileTxs, FILE_CHUNK_BYTES } from '../src/chain/site-file-txs.js'
import { MAX_SITE_FILE_BYTES, parseSiteBundle, validSitePath } from '../src/site-files/site-files.schema.js'
import { newWallet, resetState, startTestApp, type TestApp } from './helpers/app.js'

const REGISTRY = '0xd6efb7adcc9c83dc4924ad56f6a8e4e969b9adb6'
const CONTAINER = '0x' + '22'.repeat(20)
const HTML = 'text/html; charset=utf-8', JS = 'text/javascript; charset=utf-8'
const b64 = (s: string | Buffer) => Buffer.from(s).toString('base64')
const sha = (b: Buffer) => '0x' + createHash('sha256').update(b).digest('hex')

describe('building the transactions for one site file', () => {
  it('encodes the manifest exactly as the SDK does, so the file path is the only difference', () => {
    const manifest = Buffer.from(JSON.stringify({ tapeapi: '0.1', name: 'x.tape', note: 'a'.repeat(30_000) }))
    const mine = buildFileTxs(196, CONTAINER, MANIFEST_KEY, 'application/json', manifest)
    // The SDK builds the same transactions from the same bytes (publishManifest validates the manifest, so compare the encoding of its split instead).
    expect(mine.txs.length).toBe(Math.ceil(manifest.length / FILE_CHUNK_BYTES))
    expect(mine.sha256).toBe(sha(manifest))
    expect(mine.txs.every((t) => t.to.toLowerCase() === REGISTRY && t.value === '0x0')).toBe(true)
  })

  it('matches the SDK publishManifest output byte for byte for a real manifest', () => {
    const manifest = {
      tapeapi: '0.1', name: '1.2.396.tape', circuits: '0x' + '11'.repeat(20), tokenId: '1', container: CONTAINER, signer: '0x' + '33'.repeat(20),
      delegation: { expires: 1_900_000_000, sig: '0x' + '44'.repeat(65) }, endpoints: { live: ['https://api.example.test/sites/1.2.396.tape/tapeapi/v1'], async: false },
      methods: [{ name: 'a', priceBEM: '0', params: {}, returns: {} }], payment: { unit: 'BEM', decimals: 8 },
    }
    const json = JSON.stringify(manifest)
    const sdk = createTapeAPI({ chainId: 196, rpcUrls: ['https://rpc.example.test'], quorum: 1, allowSingleNode: true, quiet: true }).tx.publishManifest({ container: CONTAINER as `0x${string}`, manifest: json })
    const mine = buildFileTxs(196, CONTAINER, MANIFEST_KEY, 'application/json', Buffer.from(json))
    expect(mine.txs).toEqual(sdk.txs.map((t) => ({ ...t, value: String(t.value) })))
    expect(mine.sha256).toBe(sdk.sha256Hash)
  })

  it('splits a file into one putFile and then appendChunk transactions of at most 24,000 bytes', () => {
    const bytes = randomBytes(51_034)
    const r = buildFileTxs(196, CONTAINER, 'tapehermes.min.js', JS, bytes)
    expect(r.txs).toHaveLength(3)
    expect(r.txs[0].data.startsWith('0xfab2ed82')).toBe(true) // putFile
    expect(r.txs[1].data.startsWith('0xe2b51347')).toBe(true) // appendChunk
    expect(r.txs[2].data.startsWith('0xe2b51347')).toBe(true)
    expect(r.size).toBe(51_034)
    expect(buildFileTxs(196, CONTAINER, 'a.js', JS, randomBytes(24_000)).txs).toHaveLength(1)
    expect(buildFileTxs(196, CONTAINER, 'a.js', JS, randomBytes(24_001)).txs).toHaveLength(2)
  })

  it('refuses an empty file', () => { expect(() => buildFileTxs(196, CONTAINER, 'a.js', JS, Buffer.alloc(0))).toThrow() })
})

describe('the bundle rules', () => {
  const ok = { files: [{ path: 'index.html', contentType: HTML, content: b64('<p>hi</p>') }] }

  it('accepts plain relative paths and refuses dot segments, absolute paths, odd characters and the manifest folder', () => {
    for (const p of ['index.html', 'a/b.js', 'x-y_z.1.css']) expect(validSitePath(p), p).toBe(true)
    for (const p of ['', '/a.js', '../a.js', 'a/../b.js', './a.js', 'a//b.js', 'a b.js', 'café.js', '.well-known/tapeapi.json', '.well-known/x', 'a\\b.js']) expect(validSitePath(p), p).toBe(false)
  })

  it('decodes the files, and refuses bad base64, duplicates, unknown types, extra fields, empty files and oversized files', () => {
    expect(parseSiteBundle(ok)[0].bytes.toString()).toBe('<p>hi</p>')
    const bad = (b: unknown) => expect(() => parseSiteBundle(b)).toThrow()
    bad({ files: [{ ...ok.files[0], content: '***' }] })
    bad({ files: [ok.files[0], ok.files[0]] })
    bad({ files: [{ ...ok.files[0], contentType: 'application/x-msdownload' }] })
    bad({ files: [{ ...ok.files[0], extra: 1 }] })
    bad({ files: [{ ...ok.files[0], content: '' }] })
    bad({ files: [{ ...ok.files[0], content: b64(Buffer.alloc(MAX_SITE_FILE_BYTES + 1, 97)) }] })
    bad({ files: [] })
    bad({})
  })
})

describe('POST /api/sites/:site/files/plan', () => {
  let t: TestApp
  let holder: ReturnType<typeof newWallet>
  let token: string
  const SITE = '1.2.396.tape'
  const FILES = [
    { path: 'index.html', contentType: HTML, content: b64('<h1>hello</h1>') },
    { path: 'app.js', contentType: JS, content: b64('console.log(1)') },
    { path: 'big.js', contentType: JS, content: b64(Buffer.alloc(50_000, 97)) },
  ]
  const plan = (files: unknown = FILES, tk = token) => t.api.call('POST', `/api/sites/${SITE}/files/plan`, { token: tk, body: { files } })

  beforeAll(async () => { t = await startTestApp() })
  afterAll(async () => { await t.stop() })
  beforeEach(async () => {
    await resetState(t.prisma, t.redis); t.cache.clear(); t.chain.sites.clear(); t.chain.files.clear(); t.chain.down = false
    holder = newWallet(); t.chain.set(SITE, holder.address)
    token = await t.api.signIn(holder)
    await t.api.call('POST', '/api/sites', { token, body: { name: SITE } })
  })

  it('returns unsigned transactions to the SiteRegistry, pages last, and sends nothing', async () => {
    const r = await plan()
    expect(r.status).toBe(200)
    expect(r.body.from).toBe(holder.address.toLowerCase())
    expect(r.body.chainId).toBe(196)
    expect(r.body.files.map((f: { path: string }) => f.path)).toEqual(['app.js', 'big.js', 'index.html'])
    expect(r.body.totalTxs).toBe(1 + 3 + 1) // big.js is 50,000 bytes: three chunks
    expect(r.body.txs.map((x: { label: string }) => x.label)).toEqual(['app.js 1/1', 'big.js 1/3', 'big.js 2/3', 'big.js 3/3', 'index.html 1/1'])
    for (const tx of r.body.txs) { expect(tx.to.toLowerCase()).toBe(REGISTRY); expect(tx.data).toMatch(/^0x[0-9a-f]+$/) }
    expect(r.body.files.every((f: { state: string }) => f.state === 'new')).toBe(true)
    expect(r.body.note).toContain('Nothing has been sent')
  })

  it('reports a file the chain already holds as current, and plans no transaction for it', async () => {
    t.chain.files.set(`${'0x' + '22'.repeat(20)}|index.html`, sha(Buffer.from('<h1>hello</h1>')))
    t.chain.files.set(`${'0x' + '22'.repeat(20)}|app.js`, '0x' + '9'.repeat(64)) // something else is there
    const r = await plan()
    const by = Object.fromEntries(r.body.files.map((f: { path: string; state: string; txCount: number }) => [f.path, f]))
    expect(by['index.html']).toMatchObject({ state: 'current', txCount: 0 })
    expect(by['app.js']).toMatchObject({ state: 'changed', txCount: 1 })
    expect(by['big.js']).toMatchObject({ state: 'new', txCount: 3 })
    expect(r.body.totalTxs).toBe(4)
  })

  it('plans nothing once every file is current (the check after sending)', async () => {
    for (const f of FILES) t.chain.files.set(`${'0x' + '22'.repeat(20)}|${f.path}`, sha(Buffer.from(f.content, 'base64')))
    const r = await plan()
    expect(r.body.totalTxs).toBe(0)
    expect(r.body.files.every((f: { state: string }) => f.state === 'current')).toBe(true)
  })

  it('refuses invalid files with a clear error and never echoes the content', async () => {
    const r = await plan([{ path: '../x.js', contentType: JS, content: b64('SECRET-CONTENT') }])
    expect(r.status).toBe(400)
    expect(r.body.code).toBe('INVALID_SITE_FILES')
    expect(JSON.stringify(r.body)).not.toContain('SECRET-CONTENT')
    expect((await plan([{ path: '.well-known/tapeapi.json', contentType: 'application/json', content: b64('{}') }])).status).toBe(400)
  })

  it('accepts a bundle larger than the normal 64 KB body limit, and refuses one over its own limit', async () => {
    const big = [{ path: 'big.js', contentType: JS, content: b64(Buffer.alloc(150_000, 97)) }] // about 200 KB of base64
    expect((await plan(big)).status).toBe(200)
    const huge = Array.from({ length: 3 }, (_, i) => ({ path: `h${i}.js`, contentType: JS, content: b64(Buffer.alloc(150_000, 97)) }))
    const r = await plan(huge) // 450,000 bytes in total: inside the body limit, over the 400,000 byte limit on the files
    expect(r.status).toBe(400)
    expect(r.body.code).toBe('SITE_FILES_TOO_LARGE')
    const tooBig = { files: [{ path: 'z.js', contentType: JS, content: 'A'.repeat(700_000) }] }
    expect((await t.api.call('POST', `/api/sites/${SITE}/files/plan`, { token, body: tooBig })).status).toBeGreaterThanOrEqual(400)
  })

  it('refuses when the wallet is no longer the holder, the site is not switched on, or someone else asks', async () => {
    const other = await t.api.signIn(newWallet())
    expect((await plan(FILES, other)).status).toBe(404)
    t.chain.setInactive(SITE, holder.address)
    expect((await plan()).status).toBe(409)
    t.chain.set(SITE, newWallet().address)
    expect((await plan()).status).toBe(403)
  })

  it('answers 503 when the chain cannot be read, and needs a signed-in session', async () => {
    t.chain.down = true
    expect((await plan()).status).toBe(503)
    expect((await t.api.call('POST', `/api/sites/${SITE}/files/plan`, { body: { files: FILES } })).status).toBe(401)
  })
})
