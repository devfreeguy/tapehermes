'use client'

import Link from 'next/link'
import { PageTitle } from '@/components/atoms/page-title'
import { Spinner } from '@/components/atoms/spinner'
import { EmptyState } from '@/components/molecules/empty-state'
import { ErrorNotice } from '@/components/molecules/error-notice'
import { RouteRow } from '@/components/molecules/route-row'
import { Button } from '@/components/ui/button'
import { useRouteActions, useRoutes } from '@/hooks/use-routes'

/** The routes of a site: what each calls, what it costs, and whether it is on. */
export function RoutesSection({ siteName }: { siteName: string }) {
  const routes = useRoutes(siteName)
  const act = useRouteActions(siteName)
  const busy = act.update.isPending || act.remove.isPending
  const newRoute = <Button asChild><Link href={`/sites/${encodeURIComponent(siteName)}/routes/new`}>New route</Link></Button>
  return (
    <section className="space-y-6">
      <PageTitle title="Routes" description="Each route is one call to an outside service that your site offers to visitors." action={newRoute} />
      <ErrorNotice error={act.update.error ?? act.remove.error ?? routes.error} />
      {routes.isPending ? <Spinner /> : null}
      {routes.data?.length === 0 ? <EmptyState title="No routes yet" description="Create a route to offer your first outside call. Set the price to 0 to make it free." action={newRoute} /> : null}
      <ul className="space-y-3">
        {routes.data?.map((r) => <RouteRow key={r.name} site={siteName} route={r} busy={busy} onToggle={(name, enabled) => act.update.mutate({ name, patch: { enabled } })} onDelete={(name) => act.remove.mutate(name)} />)}
      </ul>
    </section>
  )
}
