'use client'

import { useMemo } from 'react'
import { API_URL } from '@/config/app'
import { createApiClient, type ApiClient } from '@/lib/api/client'
import { useSession } from '@/lib/session/session-context'

/** The API client of the signed-in owner. A 401 from the server signs the owner out. */
export function useApi(): ApiClient {
  const { getToken, signOut } = useSession()
  return useMemo(() => createApiClient({ baseUrl: API_URL, getToken, onUnauthorized: signOut }), [getToken, signOut])
}
