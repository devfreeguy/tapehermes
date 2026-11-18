'use client'

import Link from 'next/link'
import { PageTitle } from '@/components/atoms/page-title'
import { Spinner } from '@/components/atoms/spinner'
import { EmptyState } from '@/components/molecules/empty-state'
import { ErrorNotice } from '@/components/molecules/error-notice'
import { SiteCard } from '@/components/molecules/site-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useActivation } from '@/hooks/use-activation'
import { useSites } from '@/hooks/use-sites'
import type { Site } from '@/lib/api/schemas'
import { RegisterSiteForm } from './register-site-form'

/** One card, with the chain state read for that site. */
function SiteListItem({ site }: { site: Site }) {
  const activation = useActivation(site.name)
  return <SiteCard site={site} activated={activation.data?.activated ?? null} />
}

/** My sites, and a form to add one. A first-time owner is pointed to the guided path. */
export function SitesSection() {
  const sites = useSites()
  return (
    <section className="space-y-6">
      <PageTitle title="My sites" description="Sites you hold on X Layer and have added here." action={<Button asChild variant="outline"><Link href="/guide">Guided setup</Link></Button>} />
      <ErrorNotice error={sites.error} />
      {sites.isPending ? <Spinner /> : null}
      {sites.data && sites.data.length === 0 ? (
        <EmptyState title="No sites yet" description="Add the name of a TapeOut site you hold on X Layer. New here? The guided setup walks you from sign-in to a live route." action={<Button asChild><Link href="/guide">Start the guided setup</Link></Button>} />
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">{sites.data?.map((s) => <SiteListItem key={s.name} site={s} />)}</div>
      <Card>
        <CardHeader><CardTitle>Add a site</CardTitle></CardHeader>
        <CardContent><RegisterSiteForm /></CardContent>
      </Card>
    </section>
  )
}
