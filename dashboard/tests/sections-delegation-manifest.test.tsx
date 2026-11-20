import './sections-mocks'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DelegationSection } from '@/components/sections/delegation-section'
import { ManifestSection } from '@/components/sections/manifest-section'
import { MANIFEST_LOOK } from '@/components/molecules/manifest-state-badge'
import { ApiError } from '@/lib/api/errors'
import { done, HOLDER, S, site } from './sections-state'

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(S.wallet, { address: null, isConnected: false, onXLayer: true, noWallet: false })
  S.site = done(site())
  S.signing.mutate = vi.fn(); S.signing.isPending = false; S.signing.isSuccess = false; S.signing.error = null
  S.publish.mutate = vi.fn(); S.publish.isPending = false; S.publish.isSuccess = false; S.publish.error = null; S.publish.data = undefined
})

function openDelegation() {
  fireEvent.click(screen.getByRole('button', { name: /Give permission|Renew permission/ }))
}

function openPublish() {
  fireEvent.click(screen.getByRole('button', { name: 'Review before publishing' }))
}

describe('DelegationSection', () => {
  it('blocks signing when the connected wallet is not the holder, and says which wallet to use', () => {
    Object.assign(S.wallet, { address: '0x' + 'ee'.repeat(20), isConnected: true })
    render(<DelegationSection siteName="1.2.396.tape" />)
    openDelegation()
    expect(screen.getByText(/is not the holder of 1\.2\.396\.tape/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign and save' })).toBeDisabled()
  })

  it('lets the holder sign for the chosen number of days', async () => {
    const user = userEvent.setup()
    Object.assign(S.wallet, { address: HOLDER, isConnected: true })
    render(<DelegationSection siteName="1.2.396.tape" />)
    openDelegation()
    const button = screen.getByRole('button', { name: 'Sign and save' })
    expect(button).toBeEnabled()
    await user.click(button)
    expect(S.signing.mutate).toHaveBeenLastCalledWith(30) // the default length
    await user.click(screen.getByRole('button', { name: '90' }))
    await user.click(button)
    expect(S.signing.mutate).toHaveBeenLastCalledWith(90)
  })

  it('refuses a length outside 1 to 366 days, in words', async () => {
    const user = userEvent.setup()
    Object.assign(S.wallet, { address: HOLDER, isConnected: true })
    render(<DelegationSection siteName="1.2.396.tape" />)
    expect(screen.queryByLabelText(/How long should it last/)).toBeNull()
    openDelegation()
    const input = screen.getByLabelText(/How long should it last/)
    for (const bad of ['0', '367', '1.5', '']) {
      await user.clear(input)
      if (bad) await user.type(input, bad)
      expect(screen.getByRole('button', { name: 'Sign and save' })).toBeDisabled()
      expect(screen.getByText('Enter a whole number from 1 to 366.')).toBeInTheDocument()
    }
  })

  it('explains what the wallet will do BEFORE the button that opens it', () => {
    Object.assign(S.wallet, { address: HOLDER, isConnected: true })
    render(<DelegationSection siteName="1.2.396.tape" />)
    openDelegation()
    const notice = screen.getByTestId('wallet-step-notice')
    const button = screen.getByRole('button', { name: 'Sign and save' })
    expect(notice.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(notice).toHaveTextContent('Free to sign')
  })

  it('offers renewal, and warns before an expiring or expired delegation', () => {
    Object.assign(S.wallet, { address: HOLDER, isConnected: true })
    S.site = done(site({ delegation: { stored: true, status: 'expiring', expiresAt: '2026-11-20T10:00:00.000Z', daysLeft: 5 } }))
    const { unmount } = render(<DelegationSection siteName="1.2.396.tape" />)
    openDelegation()
    expect(screen.getByRole('button', { name: 'Sign and renew' })).toBeInTheDocument()
    expect(screen.getByText(/ends soon/)).toBeInTheDocument()
    expect(screen.getByText('5 days left')).toBeInTheDocument()
    unmount()
    S.site = done(site({ delegation: { stored: true, status: 'expired', expiresAt: '2026-11-01T10:00:00.000Z', daysLeft: 0 } }))
    render(<DelegationSection siteName="1.2.396.tape" />)
    openDelegation()
    expect(screen.getByText(/has ended, so your site cannot answer/)).toBeInTheDocument()
  })

  it('shows a refused signature in plain words and reminds the owner to publish after a save', () => {
    Object.assign(S.wallet, { address: HOLDER, isConnected: true })
    S.signing.error = new ApiError(400, 'DELEGATION_SIGNATURE_MISMATCH', 'x')
    const { unmount } = render(<DelegationSection siteName="1.2.396.tape" />)
    openDelegation()
    expect(screen.getByRole('alert')).toHaveTextContent('The signature must come from the site owner')
    unmount()
    S.signing.error = null; S.signing.isSuccess = true
    render(<DelegationSection siteName="1.2.396.tape" />)
    openDelegation()
    expect(screen.getByText(/Publish your API list again/)).toBeInTheDocument()
  })
})

const preview = (over: Record<string, unknown> = {}) => ({ manifest: { tapeapi: '0.1' }, size: 800, sha256: '0x' + 'ab'.repeat(32), delegation: { stored: true, status: 'valid', expiresAt: null, daysLeft: 20 }, publishable: true, problems: [], ...over })
const status = (state: string, over: Record<string, unknown> = {}) => ({ state, expected: { sha256: '0x' + 'ab'.repeat(32), size: 800 }, problems: [], onChain: null, ...over })

describe('ManifestSection', () => {
  beforeEach(() => { Object.assign(S.wallet, { address: HOLDER, isConnected: true }); S.preview = done(preview()) })

  it.each(['not-ready', 'not-published', 'current', 'out-of-date'] as const)('says what "%s" means in a sentence', (state) => {
    S.status = done(status(state))
    render(<ManifestSection siteName="1.2.396.tape" />)
    expect(screen.getByTestId('manifest-sentence')).toHaveTextContent(MANIFEST_LOOK[state].sentence)
  })

  it('shows clearly when the on-chain manifest is out of date, and offers to publish the update', async () => {
    const user = userEvent.setup()
    S.status = done(status('out-of-date', { onChain: { sha256: '0x' + 'cd'.repeat(32), size: 700, updatedAt: '2026-11-10T10:00:00.000Z' } }))
    render(<ManifestSection siteName="1.2.396.tape" />)
    expect(screen.getByText('Out of date')).toHaveAttribute('data-tone', 'bad')
    expect(screen.getByTestId('manifest-sentence')).toHaveTextContent('changed your settings after')
    expect(S.publish.mutate).not.toHaveBeenCalled()
    openPublish()
    expect(S.publish.mutate).not.toHaveBeenCalled()
    const publish = screen.getByRole('button', { name: 'Publish update' })
    await user.click(publish)
    expect(S.publish.mutate).toHaveBeenCalledTimes(1)
  })

  it('does not offer to publish when the chain already holds the same manifest', () => {
    S.status = done(status('current'))
    render(<ManifestSection siteName="1.2.396.tape" />)
    expect(screen.getByText('Up to date')).toHaveAttribute('data-tone', 'good')
    expect(screen.getByRole('button', { name: 'Review before publishing' })).toBeDisabled()
  })

  it('lists what is missing before publishing, in words, and blocks the button', () => {
    S.preview = done(preview({ publishable: false, problems: ['NO_ROUTES: the site has no enabled route', 'DELEGATION_REQUIRED: x'] }))
    S.status = done(status('not-ready', { expected: null }))
    render(<ManifestSection siteName="1.2.396.tape" />)
    expect(screen.getByText('Add at least one action and turn it on.')).toBeInTheDocument()
    expect(screen.getByText('The wallet that owns this site has not given signing permission yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Review before publishing' })).toBeDisabled()
  })

  it('only the holder wallet can publish', () => {
    Object.assign(S.wallet, { address: '0x' + 'ee'.repeat(20) })
    S.status = done(status('not-published'))
    render(<ManifestSection siteName="1.2.396.tape" />)
    openPublish()
    expect(screen.getByText(/Connect the holder wallet/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publish API list' })).toBeDisabled()
  })

  it('explains the wallet step and its cost before the publish button, and the switch to X Layer when needed', () => {
    Object.assign(S.wallet, { onXLayer: false })
    S.status = done(status('not-published'))
    render(<ManifestSection siteName="1.2.396.tape" />)
    openPublish()
    const notices = screen.getAllByTestId('wallet-step-notice')
    expect(notices.map((n) => n.textContent).join(' ')).toMatch(/Switch to X Layer/)
    expect(notices.map((n) => n.textContent).join(' ')).toMatch(/network fee in OKB/)
    const button = screen.getByRole('button', { name: 'Publish API list' })
    for (const n of notices) expect(n.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('still shows the preview when the chain cannot be read, and says so in words', () => {
    S.status = { data: undefined, isPending: false, error: new ApiError(503, 'CHAIN_UNAVAILABLE', 'x') }
    render(<ManifestSection siteName="1.2.396.tape" />)
    expect(screen.getByRole('alert')).toHaveTextContent('X Layer could not be read')
    expect(screen.getByText(/View JSON/)).toBeInTheDocument()
  })

  it('reports a finished publish and a refused one', () => {
    S.status = done(status('not-published'))
    S.publish.isSuccess = true; S.publish.data = ['0x1', '0x2']
    const { unmount } = render(<ManifestSection siteName="1.2.396.tape" />)
    openPublish()
    expect(screen.getByText('Published in 2 transactions.')).toBeInTheDocument()
    unmount()
    S.publish.isSuccess = false; S.publish.data = undefined; S.publish.error = new ApiError(409, 'NOT_PUBLISHABLE', 'x', { problems: ['DELEGATION_EXPIRED: x'] })
    render(<ManifestSection siteName="1.2.396.tape" />)
    openPublish()
    expect(screen.getAllByRole('alert')[0]).toHaveTextContent('not ready to publish')
  })
})
