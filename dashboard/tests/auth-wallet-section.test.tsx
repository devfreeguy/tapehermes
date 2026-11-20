import './sections-mocks'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { AuthWalletSection } from '@/components/sections/auth-wallet-section'
import { HOLDER, S } from './sections-state'

const connect = vi.fn()
const sign = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  connect.mockResolvedValue({ accounts: [HOLDER] })
  sign.mockResolvedValue(undefined)
  Object.assign(S.wallet, { connect, address: null, isConnected: false, noWallet: false })
  Object.assign(S.signInMutation, { mutateAsync: sign })
})

it('requires consent, then connects and requests a signature without a second click', async () => {
  const user = userEvent.setup()
  render(<AuthWalletSection secondaryAction={<a href="/guide">Read the guide</a>} />)

  await user.click(screen.getByRole('button', { name: 'Connect wallet' }))
  const dialog = within(screen.getByRole('alertdialog', { name: 'Before you connect' }))
  const proceed = dialog.getByRole('button', { name: 'Proceed' })
  expect(proceed).toBeDisabled()
  expect(connect).not.toHaveBeenCalled()
  expect(sign).not.toHaveBeenCalled()

  await user.click(dialog.getByRole('checkbox'))
  await user.click(proceed)

  await waitFor(() => expect(S.router.push).toHaveBeenCalledWith('/sites'))
  expect(connect).toHaveBeenCalledExactlyOnceWith(0)
  expect(sign).toHaveBeenCalledExactlyOnceWith(HOLDER)
  expect(connect.mock.invocationCallOrder[0]).toBeLessThan(sign.mock.invocationCallOrder[0])
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

it('resets consent when canceled and lets a connected wallet retry a declined signature', async () => {
  const user = userEvent.setup()
  Object.assign(S.wallet, { address: HOLDER, isConnected: true })
  sign.mockRejectedValueOnce(new Error('User rejected the request'))
  render(<AuthWalletSection secondaryAction={null} />)

  const trigger = screen.getByRole('button', { name: 'Connect wallet' })
  await user.click(trigger)
  await user.click(screen.getByRole('checkbox'))
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(sign).not.toHaveBeenCalled()

  await user.click(trigger)
  expect(screen.getByRole('button', { name: 'Proceed' })).toBeDisabled()
  await user.click(screen.getByRole('checkbox'))
  await user.click(screen.getByRole('button', { name: 'Proceed' }))
  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(sign).toHaveBeenCalledExactlyOnceWith(HOLDER)
  expect(connect).not.toHaveBeenCalled()
  expect(S.router.push).not.toHaveBeenCalled()
  expect(trigger).toHaveAttribute('aria-disabled', 'false')
})
