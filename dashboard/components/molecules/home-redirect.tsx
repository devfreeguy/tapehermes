'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useSession } from '@/lib/session/session-context'

/** Renders nothing. An owner who is already signed in goes straight to their sites. */
export function HomeRedirect() {
  const { session, ready } = useSession()
  const router = useRouter()
  useEffect(() => { if (ready && session) router.replace('/sites') }, [ready, session, router])
  return null
}
