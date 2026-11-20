import './sections-mocks'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RouteEditorSection } from '@/components/sections/route-editor-section'
import { RoutesSection } from '@/components/sections/routes-section'
import { SecretsSection } from '@/components/sections/secrets-section'
import { ApiError } from '@/lib/api/errors'
import { done, route, S } from './sections-state'

const VALUE = 'sk-live-super-secret-4471'
const secret = (name: string) => ({ name, createdAt: '2026-11-14T10:00:00.000Z', updatedAt: '2026-11-15T10:00:00.000Z' })

beforeEach(() => {
  vi.clearAllMocks()
  for (const m of [S.secretActions.save, S.secretActions.rename, S.secretActions.remove, S.routeActions.create, S.routeActions.update, S.routeActions.remove]) {
    m.mutate = vi.fn(); m.isPending = false; m.error = null
  }
  S.secrets = done([secret('WEATHER_KEY')])
  S.routes = done([route()])
})

describe('SecretsSection', () => {
  it('lists secrets by name only, and no value appears anywhere on the page', () => {
    const { container } = render(<SecretsSection siteName="1.2.396.tape" />)
    expect(screen.getByText('WEATHER_KEY')).toBeInTheDocument()
    expect(container.textContent).not.toContain(VALUE)
    for (const el of container.querySelectorAll('input')) expect((el as HTMLInputElement).value).not.toContain(VALUE)
  })

  it('adds a secret: the name is forced to capitals, the value sits in a password box, and both are cleared after saving', async () => {
    const user = userEvent.setup()
    S.secretActions.save.mutate = vi.fn((_v: unknown, o?: { onSuccess?: () => void }) => o?.onSuccess?.())
    render(<SecretsSection siteName="1.2.396.tape" />)
    expect(screen.queryByLabelText('Value')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add secret' }))
    const value = screen.getByLabelText('Value')
    expect(value).toHaveAttribute('type', 'password')
    await user.type(screen.getByLabelText('Name'), 'rates_key')
    await user.type(value, VALUE)
    await user.click(screen.getByRole('button', { name: 'Save secret' }))
    expect(S.secretActions.save.mutate).toHaveBeenCalledWith({ name: 'RATES_KEY', value: VALUE }, expect.anything())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add secret' }))
    expect(screen.getByLabelText('Name')).toHaveValue('')
    expect(screen.getByLabelText('Value')).toHaveValue('') // the key does not stay on the page
  })

  it('will not save a bad name, or an empty value', async () => {
    const user = userEvent.setup()
    render(<SecretsSection siteName="1.2.396.tape" />)
    await user.click(screen.getByRole('button', { name: 'Add secret' }))
    await user.type(screen.getByLabelText('Name'), '1BAD')
    await user.type(screen.getByLabelText('Value'), 'x')
    expect(screen.getByText(/Use capital letters, numbers and underscores/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save secret' })).toBeDisabled()
  })

  it('shows a refusal in plain words, including which routes still use a secret', () => {
    S.secretActions.remove.error = new ApiError(409, 'SECRET_IN_USE', 'x', { routes: ['fx'] })
    render(<SecretsSection siteName="1.2.396.tape" />)
    expect(screen.getByRole('alert')).toHaveTextContent('A route still uses this secret')
    expect(screen.getByText('Routes using it: fx.')).toBeInTheDocument()
  })

  it('passes rename and delete to the server', async () => {
    const user = userEvent.setup()
    S.secretActions.rename.mutate = vi.fn((_value, options) => options.onSuccess())
    render(<SecretsSection siteName="1.2.396.tape" />)
    await user.click(screen.getByRole('button', { name: 'Rename' }))
    await user.clear(screen.getByLabelText('New name'))
    await user.type(screen.getByLabelText('New name'), 'NEW_NAME')
    await user.click(screen.getByRole('button', { name: 'Save new name' }))
    expect(S.secretActions.rename.mutate).toHaveBeenCalledWith({ name: 'WEATHER_KEY', to: 'NEW_NAME' }, expect.anything())
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete secret' }))
    expect(S.secretActions.remove.mutate).toHaveBeenCalledWith('WEATHER_KEY')
  })

  it('explains the empty state', () => {
    S.secrets = done([])
    render(<SecretsSection siteName="1.2.396.tape" />)
    expect(screen.getByText('No secrets yet')).toBeInTheDocument()
  })
})

describe('RoutesSection', () => {
  it('lists routes with price, method, host and an on switch, and links to edit', () => {
    render(<RoutesSection siteName="1.2.396.tape" />)
    expect(screen.getByText('fx')).toBeInTheDocument()
    expect(screen.getByText('$0.002')).toBeInTheDocument()
    expect(screen.getByText(/api\.data-provider\.com/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/sites/routes/fx')
  })
  it('turns a route off and asks before deleting it', async () => {
    const user = userEvent.setup()
    render(<RoutesSection siteName="1.2.396.tape" />)
    await user.click(screen.getByRole('switch', { name: 'fx on' }))
    expect(S.routeActions.update.mutate).toHaveBeenCalledWith({ name: 'fx', patch: { enabled: false } })
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(S.routeActions.remove.mutate).not.toHaveBeenCalled()
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete route' }))
    expect(S.routeActions.remove.mutate).toHaveBeenCalledWith('fx')
  })
  it('shows free routes as Free and an empty state with a way to start', () => {
    S.routes = done([route({ priceUsd: '0' })])
    const { unmount } = render(<RoutesSection siteName="1.2.396.tape" />)
    expect(screen.getByText('Free')).toBeInTheDocument()
    unmount()
    S.routes = done([])
    render(<RoutesSection siteName="1.2.396.tape" />)
    expect(screen.getByText('No routes yet')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'New route' }).length).toBeGreaterThan(0)
  })
})

describe('RouteEditorSection', () => {
  it('catches simple mistakes in plain words and does not call the server', async () => {
    const user = userEvent.setup()
    render(<RouteEditorSection siteName="1.2.396.tape" />)
    await user.type(screen.getByLabelText('Route name'), '1 bad')
    await user.clear(screen.getByLabelText('Address of the outside service'))
    await user.type(screen.getByLabelText('Address of the outside service'), 'http://x.com')
    await user.click(screen.getByRole('button', { name: 'Create route' }))
    expect(screen.getByText('The address must start with https://')).toBeInTheDocument()
    expect(screen.getByText(/Use letters, numbers and underscores/)).toBeInTheDocument()
    expect(S.routeActions.create.mutate).not.toHaveBeenCalled()
  })

  it('creates a route from the form, with a price, and goes back to the list on success', async () => {
    const user = userEvent.setup()
    S.routeActions.create.mutate = vi.fn((_v: unknown, o?: { onSuccess?: () => void }) => o?.onSuccess?.())
    render(<RouteEditorSection siteName="1.2.396.tape" />)
    await user.type(screen.getByLabelText('Route name'), 'fxRate')
    await user.clear(screen.getByLabelText('Address of the outside service'))
    await user.type(screen.getByLabelText('Address of the outside service'), 'https://api.data-provider.com/v1/rate')
    await user.clear(screen.getByLabelText('Price per call (USD)'))
    await user.type(screen.getByLabelText('Price per call (USD)'), '0.005')
    await user.click(screen.getByRole('button', { name: 'Create route' }))
    expect(S.routeActions.create.mutate).toHaveBeenCalledWith(
      { name: 'fxRate', config: { url: 'https://api.data-provider.com/v1/rate' }, priceUsd: '0.005', enabled: true, rateLimitPerMin: 60 }, expect.anything(),
    )
    expect(S.router.push).toHaveBeenCalledWith('/sites/routes')
  })

  it('collects locked settings and limits into the payload', async () => {
    const user = userEvent.setup()
    render(<RouteEditorSection siteName="1.2.396.tape" />)
    await user.type(screen.getByLabelText('Route name'), 'ai')
    await user.clear(screen.getByLabelText('Address of the outside service'))
    await user.type(screen.getByLabelText('Address of the outside service'), 'https://api.llm-provider.com/v1/respond')
    const locked = screen.getByTestId('kv-locked')
    await user.click(within(locked).getByRole('button', { name: 'Add locked setting' }))
    await user.type(within(locked).getByLabelText('Parameter 1'), 'max_output_tokens')
    await user.type(within(locked).getByLabelText('Fixed value 1'), '60')
    const limits = screen.getByTestId('kv-limits')
    await user.click(within(limits).getByRole('button', { name: 'Add limit' }))
    await user.type(within(limits).getByLabelText('Parameter 1'), 'input')
    await user.type(within(limits).getByLabelText('Longest 1'), '200')
    await user.click(screen.getByRole('button', { name: 'Create route' }))
    const payload = (S.routeActions.create.mutate as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(payload.config.locked).toEqual({ max_output_tokens: 60 })
    expect(payload.config.limits).toEqual({ input: { maxLength: 200 } })
  })

  it('shows what the server refused in plain words, with the raw text in a details fold', () => {
    S.routeActions.create.error = new ApiError(400, 'ROUTE_REFUSED', 'header cookie is not allowed here (allowed: accept, authorization)')
    render(<RouteEditorSection siteName="1.2.396.tape" />)
    expect(screen.getByRole('alert')).toHaveTextContent('The header "cookie" is not allowed')
    S.routeActions.create.error = new ApiError(400, 'LOCKED_SETTING_INVALID', 'route ai: locked setting "color" is not used by this route, so nothing would send it')
    render(<RouteEditorSection siteName="1.2.396.tape" />)
    expect(screen.getAllByRole('alert')[1]).toHaveTextContent('locked setting "color" is not used by this route')
  })

  it('edits an existing route: its name is fixed, saved values are filled in, and save sends a patch', async () => {
    const user = userEvent.setup()
    S.routes = done([route({ config: { url: 'https://api.llm-provider.com/v1/r', method: 'POST', params: { input: 'string' }, body: { input: 'input', max: 'max' }, locked: { max: 60 }, limits: { input: { maxLength: 200 } } } })])
    render(<RouteEditorSection siteName="1.2.396.tape" routeName="fx" />)
    expect(screen.getByLabelText('Route name')).toBeDisabled()
    expect(screen.getByLabelText('Address of the outside service')).toHaveValue('https://api.llm-provider.com/v1/r')
    expect(within(screen.getByTestId('kv-locked')).getByLabelText('Fixed value 1')).toHaveValue('60')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    const call = (S.routeActions.update.mutate as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.name).toBe('fx')
    expect(call.patch.config.locked).toEqual({ max: 60 })
  })

  it('says so when the route to edit does not exist', () => {
    S.routes = done([])
    render(<RouteEditorSection siteName="1.2.396.tape" routeName="gone" />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
