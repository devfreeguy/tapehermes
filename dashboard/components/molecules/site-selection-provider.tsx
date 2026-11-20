'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useSites } from '@/hooks/use-sites'
import { useSession } from '@/lib/session/session-context'
import { preferredSite, readSelectedSite, rememberSite } from '@/lib/site-selection'

function useSelection() {
  const { session } = useSession()
  const wallet = session?.wallet
  const sites = useSites()
  const [saved, setSaved] = useState<{ wallet: string; site: string | null } | null>(null)

  useEffect(() => {
    if (wallet) setSaved({ wallet, site: readSelectedSite(wallet) })
  }, [wallet])

  const restored = !!wallet && saved?.wallet === wallet
  const selected = restored ? preferredSite(sites.data ?? [], saved.site) : null

  const selectSite = useCallback((site: string) => {
    if (!wallet) return
    rememberSite(wallet, site)
    setSaved({ wallet, site })
  }, [wallet])

  return { sites: sites.data ?? [], selected, pending: sites.isPending || !restored, error: sites.error, selectSite }
}

const SelectionContext = createContext<ReturnType<typeof useSelection> | null>(null)

export function SiteSelectionProvider({ children }: { children: ReactNode }) {
  const selection = useSelection()
  return <SelectionContext.Provider value={selection}>{children}</SelectionContext.Provider>
}

export function useSiteSelection() {
  const selection = useContext(SelectionContext)
  if (!selection) throw new Error('Site selection requires a dashboard layout.')
  return selection
}

export function useSelectedSiteName(explicit?: string) {
  const selection = useContext(SelectionContext)
  const name = explicit ?? selection?.selected
  if (!name) throw new Error('This page requires a selected site.')
  return name
}
