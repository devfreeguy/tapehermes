'use client'

import { useQueryClient } from '@tanstack/react-query'
import { KeyRound, LayoutGrid, ListChecks, Network, Plus, ScrollText, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { SITE_TABS } from '@/config/nav'
import { useApi } from '@/hooks/use-api'
import {
  activationQuery, callSummaryQuery, manifestPreviewQuery, manifestStatusQuery, recentCallsQuery,
  siteDetailsQuery, siteRoutesQuery, siteSecretsQuery,
} from '@/lib/site-queries'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useSiteSelection } from './site-selection-provider'
import { TabScrollArea } from './tab-scroll-area'

const tabIcons = [LayoutGrid, KeyRound, Network, ShieldCheck, ScrollText, ListChecks]

export function NewSiteNavLink({ iconOnly = false }: { iconOnly?: boolean }) {
  const active = usePathname() === '/sites/new'
  return (
    <Button asChild variant={active ? 'outline' : 'default'} size={iconOnly ? 'icon' : 'default'}
      className={iconOnly ? 'size-11 rounded-full md:hidden' : 'pill-control mt-auto hidden w-full md:inline-flex'}
    >
      <Link href="/sites/new" prefetch aria-label={iconOnly ? 'New site' : undefined} aria-current={active ? 'page' : undefined}>
        <Plus aria-hidden="true" className="size-4" />{!iconOnly && 'New site'}
      </Link>
    </Button>
  )
}

export function SiteTabs() {
  const pathname = usePathname()
  const { selected } = useSiteSelection()
  const api = useApi()
  const cache = useQueryClient()
  const activeLink = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    if (window.matchMedia('(width < 48rem)').matches) {
      activeLink.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
  }, [pathname, selected])

  useEffect(() => {
    if (!selected) return
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
    if (connection?.saveData || connection?.effectiveType?.endsWith('2g')) return
    const timer = window.setTimeout(() => {
      void cache.prefetchQuery(manifestPreviewQuery(api, selected))
      void cache.prefetchQuery(recentCallsQuery(api, selected))
    }, 500)
    return () => window.clearTimeout(timer)
  }, [api, cache, selected])

  function warmTab(path: string, site: string) {
    switch (path) {
      case '/keys': void cache.prefetchQuery(siteSecretsQuery(api, site)); break
      case '/actions': void cache.prefetchQuery(siteRoutesQuery(api, site)); break
      case '/permission': void cache.prefetchQuery(siteDetailsQuery(api, site)); break
      case '/api-list':
        void cache.prefetchQuery(siteDetailsQuery(api, site))
        void cache.prefetchQuery(manifestStatusQuery(api, site))
        void cache.prefetchQuery(manifestPreviewQuery(api, site))
        break
      case '/call-log':
        void cache.prefetchQuery(callSummaryQuery(api, site, 7))
        void cache.prefetchQuery(recentCallsQuery(api, site))
        break
      default:
        void cache.prefetchQuery(siteDetailsQuery(api, site))
        void cache.prefetchQuery(activationQuery(api, site))
    }
  }

  if (!selected) return null

  return (
    <TabScrollArea>
      <nav aria-label="Site" className="flex min-w-0 gap-1 md:grid md:grid-cols-1 md:[@media(max-height:28rem)]:grid-cols-2">
        {SITE_TABS.map(({ path, label }, index) => {
          const href = '/sites' + path
          const active = pathname === href || (path !== '' && pathname.startsWith(href + '/'))
          const Icon = tabIcons[index]
          return (
            <Link key={path} href={href} prefetch ref={active ? activeLink : undefined} aria-current={active ? 'page' : undefined}
              onPointerEnter={() => warmTab(path, selected)} onFocus={() => warmTab(path, selected)}
              onPointerDown={() => warmTab(path, selected)}
              className={cn(
                'flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring md:justify-start md:gap-3 md:px-4 md:text-sm md:[@media(max-height:28rem)]:gap-1.5 md:[@media(max-height:28rem)]:px-2 md:[@media(max-height:28rem)]:text-xs',
                active ? 'bg-primary-action/12 text-primary-action' : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
              )}
            >
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>
    </TabScrollArea>
  )
}
