'use client'

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
  const siteName = useSelectedSiteName(explicitSite)
  const routes = useRoutes(siteName)
  const actions = useRouteActions(siteName)
  const busy = actions.update.isPending || actions.remove.isPending
  const newRoute = (
    <Button asChild className="pill-control">
      <Link href="/sites/routes/new" prefetch><Plus aria-hidden="true" />New route</Link>
    </Button>
  )

  return (
    <section aria-labelledby="routes-title" className="space-y-7 lg:space-y-9">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 id="routes-title" className="font-(family-name:--font-auth) text-3xl font-extrabold tracking-tight sm:text-4xl">Routes</h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            Each route is one call to an outside service that your site offers to visitors.
          </p>
        </div>
        {newRoute}
      </header>

      <ErrorNotice error={actions.update.error ?? actions.remove.error ?? routes.error} />
      {routes.isPending && <Spinner label="Loading routes" />}
      {routes.data?.length === 0 && <EmptyState title="No routes yet" description="Create a route to offer your first outside call. Set the price to 0 to make it free." />}
      {!!routes.data?.length && (
        <ul aria-label="Configured routes" className="grid gap-4 xl:grid-cols-2">
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
