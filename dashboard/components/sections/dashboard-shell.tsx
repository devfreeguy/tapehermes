import Link from 'next/link'
import type { ReactNode } from 'react'
import { BrandWordmark } from '@/components/atoms/brand-wordmark'
import { DashboardSitePicker } from '@/components/molecules/dashboard-site-picker'
import { DashboardViewer } from '@/components/molecules/dashboard-viewer'
import { LanguageMenu } from '@/components/molecules/language-menu'
import { SiteSelectionProvider } from '@/components/molecules/site-selection-provider'
import { NewSiteNavLink, SiteTabs } from '@/components/molecules/site-tabs'
import { DashboardAccountMenu } from './dashboard-account-menu'

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <SiteSelectionProvider>
      <div className="mx-auto grid h-dvh max-w-[110rem] grid-rows-[auto_minmax(0,1fr)] gap-2 bg-background p-2 font-(family-name:--font-auth) sm:gap-3 sm:p-3 lg:gap-4 lg:p-4">
        <header className="flex min-w-0 items-center gap-2 rounded-2xl border border-border bg-card p-2 sm:gap-4 sm:px-4 lg:gap-7">
          <Link href="/sites" prefetch className="inline-flex shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-ring">
            <BrandWordmark compact />
          </Link>
          <div className="min-w-0 border-l border-border pl-2 sm:pl-4"><DashboardSitePicker /></div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <NewSiteNavLink iconOnly />
            <div className="hidden lg:block"><LanguageMenu /></div>
            <DashboardAccountMenu />
          </div>
        </header>
        <div className="grid min-h-0 min-w-0 grid-rows-1 gap-2 max-md:has-[nav]:grid-rows-[auto_minmax(0,1fr)] sm:gap-3 md:grid-cols-[11rem_minmax(0,1fr)] lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-4">
          <aside className="flex min-w-0 flex-col gap-2 rounded-2xl border border-border bg-card p-2 max-md:not-has-[nav]:hidden md:justify-between lg:p-3">
            <SiteTabs />
            <NewSiteNavLink />
          </aside>
          <DashboardViewer>{children}</DashboardViewer>
        </div>
      </div>
    </SiteSelectionProvider>
  )
}
