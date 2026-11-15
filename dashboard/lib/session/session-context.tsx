'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { tokenStore, type StoredSession } from './token-store'

interface SessionValue {
  /** null while signed out (and during the first render, before storage is read). */
  session: StoredSession | null
  /** False until sessionStorage has been read, so pages do not flash the signed-out view. */
  ready: boolean
  signIn: (s: { token: string; wallet: string; expiresInSeconds: number }) => void
  signOut: () => void
  /** For the API client: always returns the latest token without re-creating the client. */
  getToken: () => string | null
}

const Ctx = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(null)
  const [ready, setReady] = useState(false)
  const tokenRef = useRef<string | null>(null)

  useEffect(() => {
    const s = tokenStore.read()
    tokenRef.current = s?.token ?? null
    setSession(s)
    setReady(true)
  }, [])

  const signIn = useCallback((s: { token: string; wallet: string; expiresInSeconds: number }) => {
    const stored = { token: s.token, wallet: s.wallet, expiresAt: Date.now() + s.expiresInSeconds * 1000 }
    tokenRef.current = stored.token
    tokenStore.write(stored)
    setSession(stored)
  }, [])

  const signOut = useCallback(() => {
    tokenRef.current = null
    tokenStore.clear()
    setSession(null)
  }, [])

  const getToken = useCallback(() => tokenRef.current, [])
  const value = useMemo(() => ({ session, ready, signIn, signOut, getToken }), [session, ready, signIn, signOut, getToken])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSession(): SessionValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSession must be used inside SessionProvider')
  return v
}
