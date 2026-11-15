import type { ReactNode } from 'react'
import { RequireSession } from '@/components/molecules/require-session'
import { SiteTabs } from '@/components/molecules/site-tabs'

export default async function SiteLayout({ children, params }: { children: ReactNode; params: Promise<{ name: string }> }) {
  const { name } = await params
  const site = decodeURIComponent(name)
  return (
    <RequireSession>
      <div className="space-y-6"><SiteTabs site={site} />{children}</div>
    </RequireSession>
  )
}
