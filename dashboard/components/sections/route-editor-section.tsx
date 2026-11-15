'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { PageTitle } from '@/components/atoms/page-title'
import { Spinner } from '@/components/atoms/spinner'
import { ErrorNotice } from '@/components/molecules/error-notice'
import { RouteAnswerFields } from '@/components/molecules/route-answer-fields'
import { RouteBasicFields } from '@/components/molecules/route-basic-fields'
import { RouteLockedFields } from '@/components/molecules/route-locked-fields'
import { RouteRequestFields } from '@/components/molecules/route-request-fields'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useRouteActions, useRoutes } from '@/hooks/use-routes'
import { emptyRouteForm, formToPayload, routeToForm, type RouteForm } from '@/lib/routes/route-form'

/** Create a route, or edit one by name. Settings only: addresses, parameters, headers, locked values, price. No code. */
export function RouteEditorSection({ siteName, routeName }: { siteName: string; routeName?: string }) {
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

  function save() {
    const r = formToPayload(form, existing?.config)
    if (!r.ok) { setErrors(r.errors); return }
    setErrors({})
    const done = { onSuccess: () => router.push(`/sites/${encodeURIComponent(siteName)}/routes`) }
    if (existing) act.update.mutate({ name: existing.name, patch: { config: r.value.config, priceUsd: r.value.priceUsd, enabled: r.value.enabled, rateLimitPerMin: r.value.rateLimitPerMin } }, done)
    else act.create.mutate(r.value, done)
  }
  const props = { form, set, errors }
  return (
    <section className="space-y-6">
      <PageTitle title={existing ? `Edit ${existing.name}` : 'New route'} description="Everything here is a setting. The hosted rules are checked when you save, and any refusal is explained below." />
      <Card><CardHeader><CardTitle>Basics</CardTitle></CardHeader><CardContent><RouteBasicFields {...props} locked={!!existing} /></CardContent></Card>
      <Card><CardHeader><CardTitle>Request</CardTitle></CardHeader><CardContent><RouteRequestFields {...props} /></CardContent></Card>
      <Card><CardHeader><CardTitle>Answer</CardTitle></CardHeader><CardContent><RouteAnswerFields {...props} /></CardContent></Card>
      <Card><CardHeader><CardTitle>Locked settings</CardTitle></CardHeader><CardContent><RouteLockedFields {...props} /></CardContent></Card>
      <ErrorNotice error={act.create.error ?? act.update.error} />
      <div className="flex gap-2">
        <Button type="button" onClick={save} disabled={busy}>{busy ? <Spinner /> : null}{existing ? 'Save changes' : 'Create route'}</Button>
        <Button type="button" variant="ghost" onClick={() => router.push(`/sites/${encodeURIComponent(siteName)}/routes`)}>Cancel</Button>
      </div>
    </section>
  )
}
