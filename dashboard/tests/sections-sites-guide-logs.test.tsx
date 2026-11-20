import './sections-mocks'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConnectWallet } from '@/components/molecules/connect-wallet'
import { CallLogSection } from '@/components/sections/call-log-section'
import { GuidedPathSection } from '@/components/sections/guided-path-section'
import { SignInSection } from '@/components/sections/sign-in-section'
import { SiteOverviewSection } from '@/components/sections/site-overview-section'
import { SelectedSiteView } from '@/components/sections/selected-site-view'
import { SiteSelectionProvider, useSelectedSiteName } from '@/components/molecules/site-selection-provider'
import { rememberSite } from '@/lib/site-selection'
import { ApiError } from '@/lib/api/errors'
import { activationFacts, done, HOLDER, route, S, site } from './sections-state'

const session = { token: 't', wallet: HOLDER, expiresAt: Date.now() + 60_000 }

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  Object.assign(S.wallet, { address: null, isConnected: false, onXLayer: true, noWallet: false, connecting: false })
  S.session.session = null
  S.sites = done([])
  S.register.mutate = vi.fn(); S.register.isPending = false; S.register.error = null
  S.signInMutation.mutate = vi.fn(); S.signInMutation.isPending = false; S.signInMutation.error = null
  S.setPayout.mutate = vi.fn(); S.setStatus.mutate = vi.fn()
  S.activation = done(activationFacts())
})

describe('SignInSection', () => {
  it('asks to connect first, and says there is no wallet when the browser has none', () => {
    const { unmount } = render(<SignInSection />)
    expect(screen.getByRole('button', { name: 'Connect wallet' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Sign in with this wallet/ })).toBeNull()
    unmount()
    S.wallet.noWallet = true
    render(<SignInSection />)
    expect(screen.getByText(/No wallet was found in this browser/)).toBeInTheDocument()
  })
  it('explains the signature BEFORE the sign-in button, then signs in and goes to the sites', async () => {
    const user = userEvent.setup()
    Object.assign(S.wallet, { address: HOLDER, isConnected: true })
    S.signInMutation.mutate = vi.fn((_v: unknown, o?: { onSuccess?: () => void }) => o?.onSuccess?.())
    render(<SignInSection />)
    const notice = screen.getByTestId('wallet-step-notice')
    const button = screen.getByRole('button', { name: 'Sign in with this wallet' })
    expect(notice.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(notice).toHaveTextContent('No transaction is sent')
    await user.click(button)
    expect(S.router.push).toHaveBeenCalledWith('/sites')
  })
  it('shows a failed sign-in in plain words', () => {
    Object.assign(S.wallet, { address: HOLDER, isConnected: true })
    S.signInMutation.error = new ApiError(401, 'SIGN_IN_FAILED', 'x')
    render(<SignInSection />)
    expect(screen.getByRole('alert')).toHaveTextContent('Sign-in did not work')
  })
})

describe('ConnectWallet', () => {
  it('shows the connected address with a way to disconnect', async () => {
    const user = userEvent.setup()
    render(<ConnectWallet wallet={{ ...S.wallet, address: HOLDER, isConnected: true } as never} />)
    expect(screen.getByText('Connected')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Disconnect' }))
    expect(S.wallet.disconnect).toHaveBeenCalled()
  })
})

describe('Selected site view', () => {
  function SelectedName() { return <p>{useSelectedSiteName()}</p> }

  function renderSiteView() {
    S.session.session = session
    return render(<SiteSelectionProvider><SelectedSiteView><SelectedName /></SelectedSiteView></SiteSelectionProvider>)
  }

  it('puts the registration form first for an owner with no sites', () => {
    renderSiteView()
    expect(screen.getByRole('heading', { name: 'Add your first site' })).toBeInTheDocument()
    expect(screen.getByLabelText('Site name')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open the setup guide' })).toHaveAttribute('href', '/guide')
  })

  it('opens the first owned site when a saved choice is unavailable', () => {
    S.session.session = session
    S.sites = done([site(), site({ name: '1.2.400.tape' })])
    rememberSite(HOLDER, '9.2.396.tape')
    renderSiteView()
    expect(screen.getByText('1.2.396.tape')).toBeInTheDocument()
    expect(S.router.replace).not.toHaveBeenCalled()
  })

  it('restores the saved site for the signed-in wallet', () => {
    S.session.session = session
    S.sites = done([site(), site({ name: '1.2.400.tape' })])
    rememberSite(HOLDER, '1.2.400.tape')
    renderSiteView()
    expect(screen.getByText('1.2.400.tape')).toBeInTheDocument()
    expect(S.router.replace).not.toHaveBeenCalled()
  })

  it('checks the site name shape, then registers it', async () => {
    const user = userEvent.setup()
    renderSiteView()
    const input = screen.getByLabelText('Site name')
    await user.type(input, 'nope')
    expect(screen.getByText(/looks like 1\.2\.396\.tape/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add site' })).toBeDisabled()
    await user.clear(input)
    await user.type(input, '1.2.396.tape')
    await user.click(screen.getByRole('button', { name: 'Add site' }))
    expect(S.register.mutate).toHaveBeenCalledWith('1.2.396.tape', expect.anything())
  })
  it('says why a registration was refused, in words', () => {
    S.register.error = new ApiError(403, 'NOT_HOLDER', 'x')
    renderSiteView()
    expect(screen.getByRole('alert')).toHaveTextContent('This wallet is not the holder')
  })
})

describe('SiteOverviewSection', () => {
  beforeEach(() => { S.site = done(site()) })
  it('shows holder, payout, signing key and delegation', () => {
    render(<SiteOverviewSection siteName="1.2.396.tape" />)
    expect(screen.getByText('Holder')).toBeInTheDocument()
    expect(screen.getByText('No delegation')).toBeInTheDocument()
    expect(screen.getByText('0x' + 'bb'.repeat(20))).toBeInTheDocument()
  })
  it('changes the payout address and pauses the site', async () => {
    const user = userEvent.setup()
    S.setPayout.mutate = vi.fn((_address, options) => options.onSuccess())
    render(<SiteOverviewSection siteName="1.2.396.tape" />)
    expect(screen.queryByLabelText('Where payments go')).toBeNull()
    expect(screen.queryByLabelText('Months to switch on for')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Edit payout address' }))
    await user.type(screen.getByLabelText('Where payments go'), '0x' + 'dd'.repeat(20))
    await user.click(screen.getByRole('button', { name: 'Save payout address' }))
    expect(S.setPayout.mutate).toHaveBeenCalledWith('0x' + 'dd'.repeat(20), expect.anything())
    await user.click(screen.getByRole('button', { name: 'Pause calls' }))
    expect(S.setStatus.mutate).not.toHaveBeenCalled()
    await user.click(within(screen.getByRole('dialog', { name: 'Pause calls' })).getByRole('button', { name: 'Pause calls' }))
    expect(S.setStatus.mutate).toHaveBeenCalledWith('DISABLED', expect.anything())
  })
  it('offers to resume a paused site', () => {
    S.site = done(site({ status: 'DISABLED' }))
    render(<SiteOverviewSection siteName="1.2.396.tape" />)
    expect(screen.getByRole('button', { name: 'Resume calls' })).toBeInTheDocument()
  })
})

describe('CallLogSection', () => {
  it('shows totals and rows without any visitor detail, and says paid and free apart', () => {
    S.summary = done({ days: 7, since: '2026-11-08T00:00:00.000Z', routes: { fx: { calls: 3, OK: 2, ERROR: 1, RATE_LIMITED: 0, REFUSED: 0, paidCalls: 2, paidUsd: '0.004' } }, totals: { calls: 3, paidCalls: 2, paidUsd: '0.004' } })
    S.logs = done([
      { routeName: 'fx', at: '2026-11-15T10:00:00.000Z', result: 'OK', errorCode: null, paid: true, paymentTx: '0x' + 'ab'.repeat(32), priceUsd: '0.002', durationMs: 120 },
      { routeName: 'fx', at: '2026-11-15T09:00:00.000Z', result: 'REFUSED', errorCode: 'PAYMENT_INVALID', paid: false, paymentTx: null, priceUsd: '0.002', durationMs: 4 },
    ])
    render(<CallLogSection siteName="1.2.396.tape" />)
    expect(screen.getByText('Earned').nextSibling).toHaveTextContent('$0.004')
    expect(screen.getAllByText('Paid').some((e) => e.getAttribute('data-tone') === 'good')).toBe(true)
    expect(screen.getByText('Refused')).toBeInTheDocument()
    expect(screen.getByText('PAYMENT_INVALID')).toBeInTheDocument()
    expect(screen.getByText('120 ms')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/ip address|user agent/i)
  })
  it('has an empty state before the first call', () => {
    S.summary = done({ days: 7, since: '', routes: {}, totals: { calls: 0, paidCalls: 0, paidUsd: '0' } })
    S.logs = done([])
    render(<CallLogSection siteName="1.2.396.tape" />)
    expect(screen.getByText('No calls yet')).toBeInTheDocument()
  })
})

describe('GuidedPathSection', () => {
  const steps = () => screen.getAllByRole('listitem').filter((li) => li.hasAttribute('data-state'))
  const states = () => steps().map((li) => li.getAttribute('data-state'))

  it('starts a signed-out owner at sign-in, with every later step waiting and showing no action', () => {
    render(<GuidedPathSection />)
    expect(states()).toEqual(['current', 'upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming'])
    expect(screen.getByRole('button', { name: 'Connect wallet' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Go to delegation' })).toBeNull()
  })

  it('stops at "Switch on your site" while the site is off, with the wallet notice before the link', () => {
    S.session.session = session
    S.sites = done([site()])
    S.secrets = done([]); S.routes = done([]); S.status = done({ state: 'not-ready', expected: null, problems: [], onChain: null })
    S.activation = done(activationFacts({ activated: false, paidUntil: null }))
    render(<GuidedPathSection />)
    expect(states().slice(0, 4)).toEqual(['done', 'done', 'current', 'upcoming'])
    const notice = screen.getByTestId('wallet-step-notice')
    const link = screen.getByRole('link', { name: 'Go to switch on' })
    expect(notice.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(notice).toHaveTextContent('Switch on your site')
  })

  it('moves to adding a site once signed in, and offers the registration form', () => {
    S.session.session = session
    render(<GuidedPathSection />)
    expect(states().slice(0, 2)).toEqual(['done', 'current'])
    expect(screen.getByLabelText('Site name')).toBeInTheDocument()
  })

  it('walks on as work is finished: secret skipped, route made, then delegation is current with its wallet notice BEFORE the link', async () => {
    const user = userEvent.setup()
    S.session.session = session
    S.sites = done([site()])
    S.secrets = done([]); S.routes = done([]); S.status = done({ state: 'not-ready', expected: null, problems: [], onChain: null })
    const first = render(<GuidedPathSection />)
    expect(states().slice(0, 4)).toEqual(['done', 'done', 'done', 'current'])
    await user.click(screen.getByRole('button', { name: 'My service needs no key' }))
    expect(states()[4]).toBe('current')
    expect(screen.getByRole('link', { name: 'Create a route' })).toHaveAttribute('href', '/sites/routes/new')
    first.unmount()

    S.routes = done([route()])
    S.sites = done([site()])
    render(<GuidedPathSection />)
    expect(states().slice(0, 6)).toEqual(['done', 'done', 'done', 'done', 'done', 'current'])
    const notice = screen.getByTestId('wallet-step-notice')
    const link = screen.getByRole('link', { name: 'Go to delegation' })
    expect(notice.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(notice).toHaveTextContent('Sign the delegation')
  })

  it('shows the publish notice (gas) before the publish link, and "live" once the manifest is current', () => {
    S.session.session = session
    S.sites = done([site({ delegation: { stored: true, status: 'valid', expiresAt: '2026-12-20T00:00:00.000Z', daysLeft: 30 } })])
    S.secrets = done([]); S.routes = done([route()])
    S.status = done({ state: 'not-published', expected: null, problems: [], onChain: null })
    const first = render(<GuidedPathSection />)
    expect(states()[6]).toBe('current')
    expect(screen.getByTestId('wallet-step-notice')).toHaveTextContent('network gas in OKB')
    first.unmount()
    S.status = done({ state: 'current', expected: null, problems: [], onChain: null })
    render(<GuidedPathSection />)
    expect(states()[7]).toBe('current')
    expect(screen.getByRole('link', { name: 'Open the call log' })).toHaveAttribute('href', '/sites/logs')
  })
})
