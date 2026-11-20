import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ErrorPage from '@/app/error'
import NotFound from '@/app/not-found'
import robots from '@/app/robots'
import SiteLayout from '@/app/sites/[name]/layout'
import { parseSiteParam } from '@/lib/site-param'

vi.mock('next/link', () => import('./mocks/next-link'))
vi.mock('@/components/molecules/require-session', () => ({ RequireSession: ({ children }: { children: React.ReactNode }) => children }))
vi.mock('@/components/molecules/site-selection-provider', () => ({ SiteSelectionProvider: ({ children }: { children: React.ReactNode }) => children }))
vi.mock('@/components/molecules/legacy-site-entry', () => ({ LegacySiteEntry: ({ site }: { site: string }) => <p>Redirecting {site}</p> }))

describe('the 404 page', () => {
  it('says the page is missing in plain words and offers two ways out', () => {
    render(<NotFound />)
    expect(screen.getByText('Page not found')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to my sites' })).toHaveAttribute('href', '/sites')
    expect(screen.getByRole('link', { name: 'Open the guide' })).toHaveAttribute('href', '/guide')
  })
})

describe('the error page', () => {
  it('offers to try again, links home, and shows only the short reference, never the error text', async () => {
    const user = userEvent.setup()
    const reset = vi.fn()
    const error = Object.assign(new Error('secret internal detail at db.ts:42'), { digest: 'abc123' })
    render(<ErrorPage error={error} reset={reset} />)
    expect(screen.getByText('Something went wrong on this page')).toBeInTheDocument()
    expect(screen.getByText('abc123')).toBeInTheDocument()
    expect(screen.queryByText(/secret internal detail/)).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(reset).toHaveBeenCalledOnce()
    expect(screen.getByRole('link', { name: 'Go to my sites' })).toHaveAttribute('href', '/sites')
  })

  it('shows no reference line when Next gave none', () => {
    render(<ErrorPage error={new Error('x')} reset={() => undefined} />)
    expect(screen.queryByText(/Reference/)).toBeNull()
  })
})

describe('robots', () => {
  it('keeps every crawler out of the dashboard', () => {
    expect(robots()).toEqual({ rules: { userAgent: '*', disallow: '/' } })
  })
})

describe('site address segments', () => {
  it('accepts a well-formed site name, also when the segment is percent-encoded', () => {
    expect(parseSiteParam('26.2.2.tape')).toBe('26.2.2.tape')
    expect(parseSiteParam('26%2E2.2.tape')).toBe('26.2.2.tape')
  })

  it('rejects anything else, including a broken percent sequence, instead of throwing', () => {
    for (const bad of ['foo', '1.2.tape', '1.2.396', '1.2.396.tape/extra', '%E0%A4%A', '', '<script>']) expect(parseSiteParam(bad), bad).toBeNull()
  })

  it('draws the site layout for a good name and ends in a 404 for a bad one', async () => {
    const good = await SiteLayout({ children: <p>inside</p>, params: Promise.resolve({ name: '26.2.2.tape' }) })
    render(good)
    expect(screen.getByText('Redirecting 26.2.2.tape')).toBeInTheDocument()
    await expect(SiteLayout({ children: null, params: Promise.resolve({ name: 'not-a-site' }) })).rejects.toMatchObject({ digest: expect.stringContaining('404') })
  })
})
