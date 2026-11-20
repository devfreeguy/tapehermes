'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { RequireSession } from '@/components/molecules/require-session'
import { ScrollArea } from '@/components/ui/scroll-area'

export function DashboardViewer({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  return (
    <ScrollArea key={pathname} label="Page viewer" orientation="both" className="min-h-0 rounded-2xl border border-border bg-card" viewportClassName="[&>div]:block! [&>div]:w-full">
      <main className="mx-auto min-w-0 max-w-6xl px-4 py-6 sm:px-7 sm:py-8 lg:px-10 lg:py-10">
        <RequireSession>{children}</RequireSession>
      </main>
    </ScrollArea>
  )
}
