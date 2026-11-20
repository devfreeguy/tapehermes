'use client'

import { usePathname, useRouter } from 'next/navigation'
import { SitePicker } from './site-picker'
import { useSiteSelection } from './site-selection-provider'

export function DashboardSitePicker() {
  const { sites, selected, pending, selectSite } = useSiteSelection()
  const pathname = usePathname()
  const router = useRouter()
  return (
    <SitePicker sites={sites} selected={selected} pending={pending} onChange={(site) => {
      if (site === selected) return
      if (pathname.startsWith('/sites/actions/')) router.replace('/sites/actions')
      else if (pathname === '/sites/new') router.replace('/sites')
      selectSite(site)
    }} />
  )
}
