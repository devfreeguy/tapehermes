/** An error answer from the TapeHermes API, kept in one shape whatever the server (or Nest) put in the body. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  /** Extra detail the server sent: refusal lists, field problems, routes that still use a secret. */
  readonly details: Record<string, unknown>

  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }

  /** Build from a response body of any of the shapes the API produces. Never throws. */
  static from(status: number, body: unknown): ApiError {
    const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
    const code = typeof b.code === 'string' ? b.code : typeof b.error === 'string' ? b.error.toUpperCase().replace(/\s+/g, '_') : `HTTP_${status}`
    const message = typeof b.message === 'string' ? b.message : Array.isArray(b.message) ? b.message.join(', ') : `The server answered ${status}`
    const { code: _c, message: _m, statusCode: _s, error: _e, ...details } = b
    return new ApiError(status, code, message, details)
  }

  get isUnauthorized() { return this.status === 401 }
  /** The server could not be reached at all (network failure, CORS block). */
  static network(cause: unknown): ApiError {
    return new ApiError(0, 'NETWORK', cause instanceof Error ? cause.message : 'network error')
  }
}
