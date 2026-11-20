'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowLeft, ListFilter, Network, Send, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { Spinner } from '@/components/atoms/spinner'
import { ErrorNotice } from '@/components/molecules/error-notice'
import { OverviewTile } from '@/components/molecules/overview-tile'
import { RouteAnswerFields } from '@/components/molecules/route-answer-fields'
import { RouteBasicFields } from '@/components/molecules/route-basic-fields'
import { RouteLockedFields } from '@/components/molecules/route-locked-fields'
import { RouteRequestFields } from '@/components/molecules/route-request-fields'
import { Button } from '@/components/ui/button'
import { useRouteActions, useRoutes } from '@/hooks/use-routes'
import { emptyRouteForm, formToPayload, routeToForm, type RouteForm } from '@/lib/routes/route-form'

/** Create a route, or edit one by name. Settings only: addresses, parameters, headers, locked values, price. No code. */
import { useSelectedSiteName } from '@/components/molecules/site-selection-provider'

export function RouteEditorSection({ siteName: explicitSite, routeName }: { siteName?: string; routeName?: string }) {
  const siteName = useSelectedSiteName(explicitSite)
  const router = useRouter()
  const routes = useRoutes(siteName)
  const act = useRouteActions(siteName)
  const existing = routeName ? routes.data?.find((r) => r.name === routeName) : undefined
  const [draft, setDraft] = useState<RouteForm | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  if (routeName && routes.isPending) return <Spinner />
  if (routeName && !existing && !draft) return <ErrorNotice error={routes.error ?? new Error('That route does not exist.')} />
  const form = draft ?? (existing ? routeToForm(existing) : emptyRouteForm())
  const set = (patch: Partial<RouteForm>) => setDraft({ ...form, ...patch })
  const busy = act.create.isPending || act.update.isPending
  const listPath = '/sites/actions'

  function save() {
    const r = formToPayload(form, existing?.config)
    if (!r.ok) { setErrors(r.errors); return }
    setErrors({})
    const done = { onSuccess: () => router.push(listPath) }
    if (existing) act.update.mutate({ name: existing.name, patch: { config: r.value.config, priceUsd: r.value.priceUsd, enabled: r.value.enabled, rateLimitPerMin: r.value.rateLimitPerMin } }, done)
    else act.create.mutate(r.value, done)
  }
  const props = { form, set, errors }
  return (
    <section aria-labelledby="route-editor-title" className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-3">
        <Button asChild variant="ghost" className="h-11 rounded-full bg-primary-action/12 text-primary-action hover:bg-primary-action/20 hover:text-primary-action">
          <Link href={listPath}><ArrowLeft aria-hidden="true" />Back to Actions</Link>
        </Button>
        <h1 id="route-editor-title" className="font-(family-name:--font-auth) text-3xl font-extrabold tracking-tight break-all sm:text-4xl">
          {existing ? `Edit ${existing.name}` : 'New action'}
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          Choose the service to call, what to send to it, and what to give back to visitors. TapeHermes checks your settings when you save.
        </p>
      </header>
      <div className="grid gap-4 [&_[data-slot=input]]:h-13 [&_[data-slot=input]]:max-w-full [&_[data-slot=input]]:rounded-xl [&_[data-slot=input]]:px-4 [&_[data-slot=select-trigger]]:h-13! [&_[data-slot=select-trigger]]:max-w-full [&_[data-slot=select-trigger]]:rounded-xl">
        <OverviewTile title="Name, address and price" icon={Network} accentClassName="text-info">
          <RouteBasicFields {...props} locked={!!existing} />
        </OverviewTile>
        <OverviewTile title="What to send to the service" icon={Send} accentClassName="text-info">
          <RouteRequestFields {...props} />
        </OverviewTile>
        <OverviewTile title="What visitors get back" icon={ListFilter} accentClassName="text-info">
          <RouteAnswerFields {...props} />
        </OverviewTile>
        <OverviewTile title="Fixed values and limits" icon={ShieldCheck} accentClassName="text-info">
          <RouteLockedFields {...props} />
        </OverviewTile>
      </div>
      <ErrorNotice error={act.create.error ?? act.update.error} />
      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" className="pill-control" onClick={() => router.push(listPath)}>Cancel</Button>
        <Button type="button" className="pill-control" onClick={save} disabled={busy}>{busy ? <Spinner /> : null}{existing ? 'Save changes' : 'Create action'}</Button>
      </div>
    </section>
  )
}
