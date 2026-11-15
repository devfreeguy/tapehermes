export interface StoredSession { token: string; wallet: string; expiresAt: number }

const KEY = 'tapehermes.session'

/**
 * The bearer token lives in sessionStorage: it survives a reload but not a closed tab. Every access is guarded,
 * because storage can be blocked (private windows, strict settings) and the page must still work without it.
 */
export const tokenStore = {
  read(now = Date.now()): StoredSession | null {
    try {
      const raw = globalThis.sessionStorage?.getItem(KEY)
      if (!raw) return null
      const s = JSON.parse(raw) as StoredSession
      if (typeof s.token !== 'string' || typeof s.wallet !== 'string' || typeof s.expiresAt !== 'number') return null
      return s.expiresAt > now ? s : null
    } catch { return null }
  },
  write(s: StoredSession): void {
    try { globalThis.sessionStorage?.setItem(KEY, JSON.stringify(s)) } catch { /* storage blocked: the session lives in memory only */ }
  },
  clear(): void {
    try { globalThis.sessionStorage?.removeItem(KEY) } catch { /* nothing to clear */ }
  },
}
