import './sections-mocks'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ActivationSection } from '@/components/sections/activation-section'
import { ApiError } from '@/lib/api/errors'
import { activationFacts, done, HOLDER, S } from './sections-state'

const OFF = activationFacts({ activated: false, paidUntil: null })

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(S.wallet, { address: null, isConnected: false, onXLayer: true, noWallet: false, connecting: false })
  S.activation = done(OFF)
  S.recheck = vi.fn()
  S.switchOn.mutate = vi.fn(); S.switchOn.isPending = false; S.switchOn.isSuccess = false; S.switchOn.error = null
})

describe('ActivationSection', () => {
  it('says the site is on and until when, with no button', () => {
    S.activation = done(activationFacts())
    render(<ActivationSection siteName="26.2.2.tape" />)
    expect(screen.getByText('Switched on')).toBeInTheDocument()
    expect(screen.getByText(/Your site is switched on until/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Switch on my site' })).toBeNull()
  })

  it('says the site is off, shows the price read from the chain, and shows the wallet notice BEFORE the button', () => {
    S.activation = done({ ...OFF, fee: { perMonthWei: '26000000000000000', perMonth: '0.026', symbol: 'OKB' } })
    render(<ActivationSection siteName="26.2.2.tape" />)
    expect(screen.getByText('Not switched on')).toBeInTheDocument()
    expect(screen.getByText(/Price: 0\.026 OKB per month/)).toBeInTheDocument()
    const notice = screen.getByTestId('wallet-step-notice')
    expect(notice).toHaveTextContent('Switch on your site')
    expect(notice.compareDocumentPosition(screen.getByRole('button', { name: 'Switch on my site' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('blocks the button for a wallet that is not the holder, and says which wallet to use', () => {
    Object.assign(S.wallet, { address: '0x' + 'ee'.repeat(20), isConnected: true })
    render(<ActivationSection siteName="26.2.2.tape" />)
    expect(screen.getByText(/Connect the holder wallet/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Switch on my site' })).toBeDisabled()
  })

  it('lets the holder switch on for one month by default, and for the number chosen', async () => {
    const user = userEvent.setup()
    Object.assign(S.wallet, { address: HOLDER, isConnected: true })
    render(<ActivationSection siteName="26.2.2.tape" />)
    const button = screen.getByRole('button', { name: 'Switch on my site' })
    await user.click(button)
    expect(S.switchOn.mutate).toHaveBeenLastCalledWith(1)
    const months = screen.getByLabelText('Months to switch on for')
    await user.clear(months); await user.type(months, '3')
    await user.click(button)
    expect(S.switchOn.mutate).toHaveBeenLastCalledWith(3)
  })

  it('refuses 0, 13 and fractions of a month', async () => {
    const user = userEvent.setup()
    Object.assign(S.wallet, { address: HOLDER, isConnected: true })
    render(<ActivationSection siteName="26.2.2.tape" />)
    const months = screen.getByLabelText('Months to switch on for')
    for (const bad of ['0', '13', '1.5', '']) {
      await user.clear(months)
      if (bad) await user.type(months, bad)
      expect(screen.getByRole('button', { name: 'Switch on my site' })).toBeDisabled()
    }
  })

  it('offers a way to check again, and says what happened while the wallet is open and after it was sent', async () => {
    const user = userEvent.setup()
    S.switchOn.isPending = true
    const first = render(<ActivationSection siteName="26.2.2.tape" />)
    expect(screen.getByText(/Waiting for the transaction/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Check again' }))
    expect(S.recheck).toHaveBeenCalled()
    first.unmount()
    S.switchOn.isPending = false; S.switchOn.isSuccess = true
    render(<ActivationSection siteName="26.2.2.tape" />)
    expect(screen.getByText(/press Check again/)).toBeInTheDocument()
  })

  it('explains a refusal in plain words', () => {
    S.switchOn.error = new ApiError(403, 'NOT_HOLDER', 'not the holder')
    render(<ActivationSection siteName="26.2.2.tape" />)
    expect(screen.getByText('This wallet is not the holder')).toBeInTheDocument()
  })
})
