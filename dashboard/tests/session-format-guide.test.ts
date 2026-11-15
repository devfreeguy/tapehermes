import { afterEach, describe, expect, it, vi } from 'vitest'
import { dateLabel, daysLeftLabel, shortHex, usdLabel } from '@/lib/format/text'
import { guideStates, stepsDone, type GuideFacts } from '@/lib/guide/progress'
import { tokenStore } from '@/lib/session/token-store'

afterEach(() => { sessionStorage.clear(); vi.restoreAllMocks() })

describe('session token store', () => {
  it('writes and reads a session in sessionStorage only', () => {
    tokenStore.write({ token: 't', wallet: '0xabc', expiresAt: Date.now() + 60_000 })
    expect(tokenStore.read()).toMatchObject({ token: 't', wallet: '0xabc' })
    expect(localStorage.length).toBe(0)
  })
  it('forgets an expired or damaged session', () => {
    tokenStore.write({ token: 't', wallet: '0xabc', expiresAt: Date.now() - 1 })
    expect(tokenStore.read()).toBeNull()
    sessionStorage.setItem('tapehermes.session', '{not json')
    expect(tokenStore.read()).toBeNull()
    sessionStorage.setItem('tapehermes.session', JSON.stringify({ token: 1 }))
    expect(tokenStore.read()).toBeNull()
  })
  it('clears on sign out', () => {
    tokenStore.write({ token: 't', wallet: '0xabc', expiresAt: Date.now() + 60_000 })
    tokenStore.clear()
    expect(tokenStore.read()).toBeNull()
  })
  it('keeps working when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    expect(() => tokenStore.write({ token: 't', wallet: '0xabc', expiresAt: Date.now() + 60_000 })).not.toThrow()
    expect(tokenStore.read()).toBeNull()
  })
})

describe('text formats', () => {
  it('shortens hex values and leaves short ones', () => {
    expect(shortHex('0x1234567890abcdef1234567890abcdef12345678')).toBe('0x1234...5678')
    expect(shortHex('0x12')).toBe('0x12')
  })
  it('shows prices without trailing zeros, and zero as Free', () => {
    expect(usdLabel('0.002000')).toBe('$0.002')
    expect(usdLabel('0.010000')).toBe('$0.01')
    expect(usdLabel('5.000000')).toBe('$5')
    expect(usdLabel('0')).toBe('Free')
    expect(usdLabel('0.000000')).toBe('Free')
  })
  it('handles dates and day counts', () => {
    expect(dateLabel('2026-11-15T10:30:00.000Z')).toMatch(/2026/)
    expect(dateLabel(null)).toBe('')
    expect(dateLabel('nope')).toBe('')
    expect(daysLeftLabel(1)).toBe('1 day left')
    expect(daysLeftLabel(12)).toBe('12 days left')
    expect(daysLeftLabel(0)).toBe('ends today')
    expect(daysLeftLabel(null)).toBe('')
  })
})

const facts = (o: Partial<GuideFacts> = {}): GuideFacts => ({ signedIn: false, hasSite: false, secretCount: 0, secretSkipped: false, routeCount: 0, delegation: null, manifest: null, ...o })
const current = (f: GuideFacts) => guideStates(f).find((s) => s.state === 'current')?.step.id

describe('guided path progress', () => {
  it('starts at sign-in and moves one step at a time', () => {
    expect(current(facts())).toBe('signin')
    expect(current(facts({ signedIn: true }))).toBe('register')
    expect(current(facts({ signedIn: true, hasSite: true }))).toBe('secret')
    expect(current(facts({ signedIn: true, hasSite: true, secretSkipped: true }))).toBe('route')
    expect(current(facts({ signedIn: true, hasSite: true, secretCount: 1, routeCount: 1 }))).toBe('delegation')
    expect(current(facts({ signedIn: true, hasSite: true, routeCount: 1, delegation: 'valid' }))).toBe('publish')
    expect(current(facts({ signedIn: true, hasSite: true, routeCount: 1, delegation: 'valid', manifest: 'current' }))).toBe('live')
  })
  it('treats an expiring delegation as done, but an expired or missing one as not', () => {
    const f = { signedIn: true, hasSite: true, routeCount: 1 }
    expect(stepsDone(facts({ ...f, delegation: 'expiring' })).delegation).toBe(true)
    expect(stepsDone(facts({ ...f, delegation: 'expired' })).delegation).toBe(false)
    expect(stepsDone(facts({ ...f, delegation: 'none' })).delegation).toBe(false)
  })
  it('does not call a manifest published when the delegation is not done, and calls an out-of-date one not current', () => {
    const f = { signedIn: true, hasSite: true, routeCount: 1 }
    expect(stepsDone(facts({ ...f, delegation: 'expired', manifest: 'current' })).publish).toBe(false)
    expect(stepsDone(facts({ ...f, delegation: 'valid', manifest: 'out-of-date' })).publish).toBe(false)
  })
  it('marks exactly one current step, and everything before it done', () => {
    const states = guideStates(facts({ signedIn: true, hasSite: true, secretSkipped: true }))
    expect(states.filter((s) => s.state === 'current')).toHaveLength(1)
    expect(states.map((s) => s.state)).toEqual(['done', 'done', 'done', 'current', 'upcoming', 'upcoming', 'upcoming'])
  })
  it('every step that opens the wallet is marked as such, and no step copy has an em dash', async () => {
    const { GUIDE_STEPS } = await import('@/copy/guide')
    expect(GUIDE_STEPS.filter((s) => s.wallet).map((s) => s.id)).toEqual(['signin', 'delegation', 'publish'])
    for (const s of GUIDE_STEPS) expect(s.title + s.why).not.toContain('—')
  })
})
