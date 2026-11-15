'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SITE_TABS } from '@/config/nav'
import { cn } from '@/lib/utils'

/** The tabs of one site. The current page is marked for screen readers too. */
export function SiteTabs({ site }: { site: string }) {
  const pathname = usePathname()
  const base = `/sites/${encodeURIComponent(site)}`
  return (
    <nav aria-label="Site" className="flex flex-wrap gap-1 border-b border-border">
      {SITE_TABS.map((t) => {
        const href = `${base}${t.path}`
        const active = t.path === '' ? pathname === base : pathname.startsWith(href)
        return <Link key={t.path} href={href} aria-current={active ? 'page' : undefined} className={cn('-mb-px border-b-2 px-3 py-2 text-sm', active ? 'border-signal text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>{t.label}</Link>
      })}
    </nav>
  )
}
