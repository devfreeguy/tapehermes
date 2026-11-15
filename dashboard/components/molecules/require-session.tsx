'use client'

import { useRouter } from 'next/navigation'
import { useEffect, type ReactNode } from 'react'
import { Spinner } from '@/components/atoms/spinner'
import { useSession } from '@/lib/session/session-context'

/** Shows its children only to a signed-in owner; anyone else is sent to the sign-in page. */
export function RequireSession({ children }: { children: ReactNode }) {
  const { session, ready } = useSession()
  const router = useRouter()
  useEffect(() => { if (ready && !session) router.replace('/') }, [ready, session, router])
  if (!ready || !session) return <Spinner label="Checking your session" />
  return <>{children}</>
}
