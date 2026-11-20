import type { ReactNode } from 'react'
import { DashboardShell } from '@/components/sections/dashboard-shell'

export default function SitesLayout({ children }: { children: ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>
}
