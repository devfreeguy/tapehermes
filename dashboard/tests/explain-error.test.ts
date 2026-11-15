import { describe, expect, it } from 'vitest'
import { explainError, explainProblem } from '@/copy/errors'
import { ApiError } from '@/lib/api/errors'

const refused = (message: string) => explainError(new ApiError(400, 'ROUTE_REFUSED', message)).message

describe('save-time refusals in plain words', () => {
  it.each([
    ['upstream https://a.com not allowed: https only', 'must start with https://'],
    ['upstream https://a.com:8443 not allowed: port 443 only', 'Remove the port number'],
    ['upstream https://a.com not allowed: no user:password@ in the URL', 'user name or password'],
    ['upstream https://10.0.0.1 not allowed: an IP address; use a host name', 'not an IP address'],
    ['upstream https://localhost not allowed: a single-label host', 'full host name with a dot'],
    ['upstream https://db.internal not allowed: internal is not reachable from here', 'cannot be called from our servers'],
    ['header cookie is not allowed here (allowed: accept, authorization)', 'The header "cookie" is not allowed. You can use: accept, accept-language, authorization'],
    ['adapter config names 4 upstream hosts; at most 3 here', 'would call 4 different outside hosts. The limit is 3'],
    ['adapter url must not contain query/fragment; use "query": https://a.com/x?y=1', 'Add them in the Query section'],
    ['adapter url template must not place {param} in the origin: https://{h}.a.com/x', 'never in the host name'],
    ['bad header name in adapter config: x y', 'letters, numbers and dashes'],
  ])('%s', (technical, plain) => {
    const e = explainError(new ApiError(400, 'ROUTE_REFUSED', technical))
    expect(e.message).toContain(plain)
    expect(e.technical).toContain(technical) // the raw text is kept for the Details fold
  })

  it('keeps a calm sentence for a refusal it has no pattern for', () => {
    expect(refused('something new')).toBe('The settings break one of the hosted rules.')
  })

  it('lists field problems of a bad request by name', () => {
    const e = explainError(new ApiError(400, 'BAD_REQUEST', 'invalid request', { fields: [{ field: 'name', problem: 'Invalid' }] }))
    expect(e.message).toContain('name: Invalid')
  })

  it('shows the locked-setting reason without the route prefix', () => {
    const e = explainError(new ApiError(400, 'LOCKED_SETTING_INVALID', 'route ai: locked setting "color" is not used by this route'))
    expect(e.message).toBe('locked setting "color" is not used by this route')
  })

  it('has words for the codes an owner meets', () => {
    for (const code of ['UNAUTHENTICATED', 'SIGN_IN_FAILED', 'NOT_HOLDER', 'CHAIN_UNAVAILABLE', 'SECRET_NOT_IN_HEADER', 'UNKNOWN_SECRET', 'SECRET_IN_USE', 'DELEGATION_SIGNATURE_MISMATCH', 'NOT_PUBLISHABLE', 'ROUTE_EXISTS']) {
      const e = explainError(new ApiError(400, code, 'x'))
      expect(e.title, code).not.toBe('That did not work')
      expect(e.message.length, code).toBeGreaterThan(10)
    }
  })

  it('never shows the server text for a 500, and handles network and unknown errors', () => {
    expect(explainError(new ApiError(500, 'INTERNAL', 'stack trace here')).message).not.toContain('stack trace')
    expect(explainError(new ApiError(0, 'NETWORK', 'Failed to fetch')).title).toBe('Cannot reach the server')
    expect(explainError(new Error('boom')).title).toBe('Something went wrong')
    expect(explainError('weird').technical).toBe('weird')
  })

  it('explains each reason a manifest cannot be published', () => {
    expect(explainProblem('NO_ROUTES: the site has no enabled route')).toContain('Add at least one route')
    expect(explainProblem('DELEGATION_REQUIRED: x')).toContain('has not signed a delegation')
    expect(explainProblem('DELEGATION_EXPIRED: x')).toContain('expired')
    expect(explainProblem('MANIFEST_TOO_LARGE: 70000 bytes')).toContain('too large')
    expect(explainProblem('OTHER: text')).toBe('OTHER: text')
  })

  it('uses no em dashes in any sentence it can produce', () => {
    for (const code of ['UNAUTHENTICATED', 'NOT_HOLDER', 'ROUTE_REFUSED', 'NETWORK', 'NOT_PUBLISHABLE']) {
      const e = explainError(new ApiError(400, code, 'x'))
      expect(e.title + e.message).not.toContain('—')
    }
  })
})
