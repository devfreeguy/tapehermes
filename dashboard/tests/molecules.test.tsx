import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { DelegationBadge } from '@/components/molecules/delegation-badge'
import { ErrorNotice } from '@/components/molecules/error-notice'
import { KeyValueEditor, type Pair } from '@/components/molecules/key-value-editor'
import { ManifestStateBadge, MANIFEST_LOOK } from '@/components/molecules/manifest-state-badge'
import { SecretRow } from '@/components/molecules/secret-row'
import { WalletStepNotice } from '@/components/molecules/wallet-step-notice'
import { WALLET_STEPS } from '@/copy/wallet-steps'
import { ApiError } from '@/lib/api/errors'

vi.mock('next/link', () => import('./mocks/next-link'))

describe('SecretRow: a value is never shown', () => {
  const secret = { name: 'WEATHER_KEY', createdAt: '2026-11-14T10:00:00.000Z', updatedAt: '2026-11-15T10:00:00.000Z' }
  const edit = () => ({
    mutate: vi.fn((_input: unknown, { onSuccess }: { onSuccess: () => void }) => onSuccess()),
    reset: vi.fn(),
    isPending: false,
    error: null,
  })
  const handlers = () => ({ save: edit(), rename: edit(), remove: { mutate: vi.fn() } })

  it('shows the name and says the value is hidden, with no way to reveal it', () => {
    render(<ul><SecretRow secret={secret} busy={false} actions={handlers()} /></ul>)
    expect(screen.getByText('WEATHER_KEY')).toBeInTheDocument()
    expect(screen.getByText('Value hidden')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /show|reveal|copy/i })).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('replaces the value through a password box and sends it once', async () => {
    const h = handlers()
    const user = userEvent.setup()
    render(<ul><SecretRow secret={secret} busy={false} actions={h} /></ul>)
    await user.click(screen.getByRole('button', { name: 'Replace value' }))
    const box = screen.getByLabelText('New value')
    expect(box).toHaveAttribute('type', 'password')
    expect(box).toHaveAttribute('autocomplete', 'off')
    await user.type(box, 'sk-new-value')
    await user.click(screen.getByRole('button', { name: 'Save new value' }))
    expect(h.save.mutate).toHaveBeenCalledWith({ name: 'WEATHER_KEY', value: 'sk-new-value' }, expect.anything())
    expect(screen.queryByLabelText('New value')).toBeNull() // the box is gone, so the value is not left on the page
    expect(document.body.textContent).not.toContain('sk-new-value')
  })

  it('renames with capital letters forced, and starts from the current name', async () => {
    const h = handlers()
    const user = userEvent.setup()
    render(<ul><SecretRow secret={secret} busy={false} actions={h} /></ul>)
    await user.click(screen.getByRole('button', { name: 'Rename' }))
    const box = screen.getByLabelText('New name')
    expect(box).toHaveValue('WEATHER_KEY')
    await user.clear(box)
    await user.type(box, 'rates_key')
    await user.click(screen.getByRole('button', { name: 'Save new name' }))
    expect(h.rename.mutate).toHaveBeenCalledWith({ name: 'WEATHER_KEY', to: 'RATES_KEY' }, expect.anything())
  })

  it('asks before deleting, and deletes only after the owner agrees', async () => {
    const h = handlers()
    const user = userEvent.setup()
    render(<ul><SecretRow secret={secret} busy={false} actions={h} /></ul>)
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(h.remove.mutate).not.toHaveBeenCalled()
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete secret' }))
    expect(h.remove.mutate).toHaveBeenCalledWith('WEATHER_KEY')
  })

  it('can cancel an edit, and disables actions while busy', async () => {
    const h = handlers()
    const user = userEvent.setup()
    const { rerender } = render(<ul><SecretRow secret={secret} busy={false} actions={h} /></ul>)
    await user.click(screen.getByRole('button', { name: 'Replace value' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('button', { name: 'Replace value' })).toBeInTheDocument()
    rerender(<ul><SecretRow secret={secret} busy actions={h} /></ul>)
    expect(screen.getByRole('button', { name: 'Replace value' })).toBeDisabled()
  })
})

describe('KeyValueEditor', () => {
  function Harness({ start = [] as Pair[] }) {
    const [rows, setRows] = useState<Pair[]>(start)
    return <><KeyValueEditor id="q" label="Query" rows={rows} onChange={setRows} keyLabel="Name" valueLabel="From" addLabel="Add row" /><output data-testid="out">{JSON.stringify(rows)}</output></>
  }
  it('adds, edits and removes rows', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add row' }))
    await user.type(screen.getByLabelText('Name 1'), 'symbol')
    await user.type(screen.getByLabelText('From 1'), 'sym')
    expect(screen.getByTestId('out').textContent).toBe('[{"key":"symbol","value":"sym"}]')
    await user.click(screen.getByRole('button', { name: 'Remove Name 1' }))
    expect(screen.getByTestId('out').textContent).toBe('[]')
  })
})

describe('ErrorNotice', () => {
  it('renders nothing without an error', () => {
    const { container } = render(<ErrorNotice error={null} />)
    expect(container).toBeEmptyDOMElement()
  })
  it('says a refusal in plain words and keeps the technical text inside a details fold', async () => {
    const user = userEvent.setup()
    render(<ErrorNotice error={new ApiError(400, 'ROUTE_REFUSED', 'upstream https://a.com not allowed: https only')} />)
    expect(screen.getByRole('alert')).toHaveTextContent('The address must start with https://')
    expect(screen.queryByText(/not allowed: https only/)).toBeNull() // hidden until opened
    await user.click(screen.getByText('Details'))
    expect(screen.getByText(/not allowed: https only/)).toBeInTheDocument()
  })
  it('lists the reasons a manifest cannot be published, and the routes that still use a secret', () => {
    render(<ErrorNotice error={new ApiError(409, 'NOT_PUBLISHABLE', 'x', { problems: ['NO_ROUTES: none', 'DELEGATION_REQUIRED: none'] })} />)
    expect(screen.getByText('Add at least one route and turn it on.')).toBeInTheDocument()
    expect(screen.getByText('The holder has not signed a delegation yet.')).toBeInTheDocument()
  })
  it('names routes that still use a secret', () => {
    render(<ErrorNotice error={new ApiError(409, 'SECRET_IN_USE', 'x', { routes: ['fx', 'ai'] })} />)
    expect(screen.getByText('Routes using it: fx, ai.')).toBeInTheDocument()
  })
})

describe('WalletStepNotice', () => {
  it.each(Object.entries(WALLET_STEPS))('%s says what happens, what it costs, and what it cannot do', (_k, step) => {
    render(<WalletStepNotice step={step} />)
    const n = screen.getByTestId('wallet-step-notice')
    expect(n).toHaveTextContent('What happens')
    expect(n).toHaveTextContent('Cost')
    expect(n).toHaveTextContent('What it cannot do')
    expect(n).toHaveTextContent(step.whatHappens)
  })
  it('tells the owner that publishing costs gas and signing the delegation is free', () => {
    expect(WALLET_STEPS.publish.cost).toMatch(/gas/i)
    expect(WALLET_STEPS.delegation.cost).toMatch(/free/i)
    expect(WALLET_STEPS.signIn.cost).toMatch(/free/i)
  })
})

describe('state badges', () => {
  it.each([['none', 'No delegation', 'neutral'], ['valid', 'Valid', 'good'], ['expiring', 'Expiring soon', 'warn'], ['expired', 'Expired', 'bad']] as const)('delegation %s', (state, label, tone) => {
    render(<DelegationBadge state={state} />)
    expect(screen.getByText(label)).toHaveAttribute('data-tone', tone)
  })
  it.each(Object.entries(MANIFEST_LOOK))('manifest %s', (state, look) => {
    render(<ManifestStateBadge state={state as keyof typeof MANIFEST_LOOK} />)
    expect(screen.getByText(look.label)).toHaveAttribute('data-tone', look.tone)
  })
  it('says out of date in red and up to date in green', () => {
    expect(MANIFEST_LOOK['out-of-date'].tone).toBe('bad')
    expect(MANIFEST_LOOK.current.tone).toBe('good')
  })
})
