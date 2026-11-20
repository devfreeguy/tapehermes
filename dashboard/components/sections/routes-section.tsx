'use client'
import { useTranslator } from '@/lib/locale-context'

import { SITE_TERMS } from '@/copy/site-terms'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { Spinner } from '@/components/atoms/spinner'
import { EmptyState } from '@/components/molecules/empty-state'
import { ErrorNotice } from '@/components/molecules/error-notice'
import { RouteRow } from '@/components/molecules/route-row'
import { Button } from '@/components/ui/button'
import { useRouteActions, useRoutes } from '@/hooks/use-routes'

import { useSelectedSiteName } from '@/components/molecules/site-selection-provider'

export function RoutesSection({ siteName: explicitSite }: { siteName?: string }) {
  const t = useTranslator()
  const siteName = useSelectedSiteName(explicitSite)
  const routes = useRoutes(siteName)
  const actions = useRouteActions(siteName)
  const busy = actions.update.isPending || actions.remove.isPending
  const newRoute = (
    <Button asChild className="pill-control">
      <Link href="/sites/actions/new" prefetch><Plus aria-hidden="true" />{t('New action')}</Link>
    </Button>
  )

  return (
    <section aria-labelledby="routes-title" className="space-y-7 lg:space-y-9">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 id="routes-title" className="font-(family-name:--font-auth) text-3xl font-extrabold tracking-tight sm:text-4xl">{t(SITE_TERMS.routes.label)}</h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            {t(SITE_TERMS.routes.description)}
          </p>
        </div>
        {newRoute}
      </header>

      <ErrorNotice error={actions.update.error ?? actions.remove.error ?? routes.error} />
      {routes.isPending && <Spinner label={t('Loading routes')} />}
      {routes.data?.length === 0 && <EmptyState title={t('No actions yet')} description={t('Add something your site can do for visitors. Set the price to 0 if you want it to be free.')} />}
      {!!routes.data?.length && (
        <ul aria-label={t('Saved actions')} className="grid gap-4 xl:grid-cols-2">
          {routes.data.map((route) => (
            <RouteRow key={route.name} route={route} busy={busy}
              onToggle={(name, enabled) => actions.update.mutate({ name, patch: { enabled } })}
              onDelete={(name) => actions.remove.mutate(name)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
