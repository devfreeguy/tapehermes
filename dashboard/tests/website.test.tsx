import './sections-mocks'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WebsiteSection } from '@/components/sections/website-section'
import { createApiClient } from '@/lib/api/client'
import { estimateUploadFeeWei, estimateUploadGas, gatewayUrl, readSiteBundle } from '@/lib/site-bundle'
import { done, HOLDER, S, site } from './sections-state'

const b64 = (s: string) => Buffer.from(s).toString('base64')
const bundle = { files: [{ path: 'index.html', contentType: 'text/html; charset=utf-8', content: b64('<p>hi</p>') }, { path: 'app.js', contentType: 'text/javascript; charset=utf-8', content: b64('1') }] }
const tx = (label: string) => ({ to: '0x' + 'd6'.repeat(20), data: '0xfab2ed82', value: '0x0', label })
const plan = (over: Record<string, unknown> = {}) => ({
  from: HOLDER, chainId: 196, note: 'Unsigned.', totalTxs: 2,
  files: [
    { path: 'app.js', contentType: 'text/javascript; charset=utf-8', size: 1, sha256: '0x' + '1'.repeat(64), state: 'new', txCount: 1 },
    { path: 'index.html', contentType: 'text/html; charset=utf-8', size: 9, sha256: '0x' + '2'.repeat(64), state: 'changed', txCount: 1 },
  ],
  txs: [tx('app.js 1/1'), tx('index.html 1/1')],
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(S.wallet, { address: null, isConnected: false, onXLayer: true, noWallet: false })
  S.site = done(site())
  for (const m of [S.planFiles, S.publishFiles]) Object.assign(m, { mutate: vi.fn(), reset: vi.fn(), isPending: false, isSuccess: false, error: null, data: undefined })
})

describe('reading the site bundle file', () => {
  it('accepts the bundle and counts the files and the bytes', () => {
    const r = readSiteBundle(JSON.stringify(bundle))
    expect(r).toMatchObject({ ok: true, files: 2, bytes: 10 })
  })

  it('refuses text that is not JSON, JSON of the wrong shape, and a file that is far too large', () => {
    expect(readSiteBundle('not json')).toEqual({ ok: false, reason: 'NOT_A_BUNDLE' })
    expect(readSiteBundle(JSON.stringify({ files: [] }))).toEqual({ ok: false, reason: 'NOT_A_BUNDLE' })
    expect(readSiteBundle(JSON.stringify({ files: [{ path: 'a' }] }))).toEqual({ ok: false, reason: 'NOT_A_BUNDLE' })
    expect(readSiteBundle('x'.repeat(700_000))).toEqual({ ok: false, reason: 'TOO_LARGE' })
  })

  it('gives the public address of a .tape site, and nothing for any other name', () => {
    expect(gatewayUrl('26.2.2.tape')).toBe('https://26-2-2.tapekit.org/')
    expect(gatewayUrl('example.com')).toBeNull()
  })

  it('estimates the upload cost close to what was measured on X Layer (11 transactions, 111,801 bytes: 27.6 million gas)', () => {
    const gas = estimateUploadGas(11, 111_801)
    expect(gas).toBeGreaterThan(27_000_000n)
    expect(gas).toBeLessThan(30_000_000n)
    expect(estimateUploadFeeWei(11, 111_801, 20_000_001n)).toBe((gas * 20_000_001n * 12n) / 10n)
  })
})

describe('the plan call', () => {
  it('posts the bundle to the files plan route and parses the answer', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(plan()), { status: 200, headers: { 'content-type': 'application/json' } }))
    const api = createApiClient({ baseUrl: 'http://api.test', getToken: () => 'tok', fetchImpl: fetchImpl as never })
    const r = await api.files.plan('1.2.396.tape', bundle)
    expect(r.totalTxs).toBe(2)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://api.test/api/sites/1.2.396.tape/files/plan')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual(bundle)
  })
})

describe('WebsiteSection', () => {
  it('asks the server to plan as soon as a valid bundle file is chosen, and shows what is wrong with a bad file', async () => {
    render(<WebsiteSection siteName="1.2.396.tape" />)
    const input = screen.getByLabelText('Site bundle file') as HTMLInputElement
    await userEvent.upload(input, new File([JSON.stringify(bundle)], 'site-bundle.json', { type: 'application/json' }))
    await waitFor(() => expect(S.planFiles.mutate).toHaveBeenCalledWith(bundle))
    await userEvent.upload(input, new File(['not json'], 'other.json', { type: 'application/json' }))
    expect(await screen.findByText(/is not a site bundle/)).toBeInTheDocument()
  })

  it('lists every file with whether it is new, changed or already on X Layer, and the transaction count', () => {
    S.planFiles.data = plan({ files: [...plan().files, { path: 'styles.css', contentType: 'text/css; charset=utf-8', size: 5, sha256: '0x' + '3'.repeat(64), state: 'current', txCount: 0 }] })
    render(<WebsiteSection siteName="1.2.396.tape" />)
    expect(screen.getByTestId('website-summary')).toHaveTextContent('2 files will be written in 2 transactions.')
    expect(screen.getByText('styles.css')).toBeInTheDocument()
    expect(screen.getByText('New')).toBeInTheDocument()
    expect(screen.getByText('Changed')).toBeInTheDocument()
    expect(screen.getByText('On X Layer')).toBeInTheDocument()
  })

  it('cannot be published before a bundle is chosen, or when every file is already on X Layer', () => {
    const { rerender } = render(<WebsiteSection siteName="1.2.396.tape" />)
    expect(screen.getByRole('button', { name: 'Review before publishing' })).toBeDisabled()
    S.planFiles.data = plan({ totalTxs: 0, txs: [], files: plan().files.map((f) => ({ ...f, state: 'current', txCount: 0 })) })
    rerender(<WebsiteSection siteName="1.2.396.tape" />)
    expect(screen.getByTestId('website-summary')).toHaveTextContent('Every file is already on X Layer.')
    expect(screen.getByRole('button', { name: 'Review before publishing' })).toBeDisabled()
  })

  it('needs the holder wallet: another wallet is told which one to connect, and the publish button stays off', async () => {
    S.planFiles.data = plan()
    Object.assign(S.wallet, { address: '0x' + 'ee'.repeat(20), isConnected: true })
    render(<WebsiteSection siteName="1.2.396.tape" />)
    fireEvent.click(screen.getByRole('button', { name: 'Review before publishing' }))
    expect(await screen.findByText(/Connect the holder wallet/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publish website' })).toBeDisabled()
  })

  it('lets the holder publish the planned files from the dialog, and shows the check read back from the chain', async () => {
    S.planFiles.data = plan()
    Object.assign(S.wallet, { address: HOLDER, isConnected: true })
    const { rerender } = render(<WebsiteSection siteName="1.2.396.tape" />)
    // choose the file so the section holds the bundle
    await userEvent.upload(screen.getByLabelText('Site bundle file'), new File([JSON.stringify(bundle)], 'site-bundle.json', { type: 'application/json' }))
    await waitFor(() => expect(S.planFiles.mutate).toHaveBeenCalled())
    S.planFiles.data = plan()
    rerender(<WebsiteSection siteName="1.2.396.tape" />)
    fireEvent.click(screen.getByRole('button', { name: 'Review before publishing' }))
    const publish = await screen.findByRole('button', { name: 'Publish website' })
    expect(publish).toBeEnabled()
    fireEvent.click(publish)
    expect(S.publishFiles.mutate).toHaveBeenCalledWith(expect.objectContaining({ bundle, plan: expect.objectContaining({ totalTxs: 2 }) }))
    // after the transactions, the server's second plan reads "current" for every file
    const check = plan({ totalTxs: 0, txs: [], files: plan().files.map((f) => ({ ...f, state: 'current', txCount: 0 })) })
    Object.assign(S.publishFiles, { isSuccess: true, data: { hashes: ['0x1', '0x2'], check } })
    rerender(<WebsiteSection siteName="1.2.396.tape" />)
    expect(await screen.findByText('Published. Every file was checked on X Layer and matches.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'https://1-2-396.tapekit.org/', hidden: true })).toHaveAttribute('target', '_blank')
  })
})
