import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { RequireSession } from '@/components/molecules/require-session'
import { LegacySiteEntry } from '@/components/molecules/legacy-site-entry'
import { SiteSelectionProvider } from '@/components/molecules/site-selection-provider'
import { parseSiteParam } from '@/lib/site-param'

export default async function SiteLayout({ params }: { children: ReactNode; params: Promise<{ name: string }> }) {
  const { name } = await params
  const site = parseSiteParam(name)
  if (!site) notFound()
  return <RequireSession><SiteSelectionProvider><LegacySiteEntry site={site} /></SiteSelectionProvider></RequireSession>
}
