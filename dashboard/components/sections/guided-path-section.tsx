'use client'

import { useState } from 'react'
import { useActivation } from '@/hooks/use-activation'
import { useManifestStatus } from '@/hooks/use-manifest'
import { useRoutes } from '@/hooks/use-routes'
import { useSecrets } from '@/hooks/use-secrets'
import { useSites } from '@/hooks/use-sites'
import { useSession } from '@/lib/session/session-context'
import { GuideSteps } from './guide-steps'

/** Facts for one site, read live, so the guide moves on by itself as the owner finishes each step on its own page. */
function SiteGuide({ site, signedIn, delegation }: { site: string; signedIn: boolean; delegation: Parameters<typeof GuideSteps>[0]['facts']['delegation'] }) {
  const [skipped, setSkipped] = useState(false)
  const secrets = useSecrets(site)
  const routes = useRoutes(site)
  const status = useManifestStatus(site)
  const activation = useActivation(site)
  return (
    <GuideSteps
      site={site} onSkipSecret={() => setSkipped(true)}
      facts={{ signedIn, hasSite: true, activated: activation.data?.activated ?? null, secretCount: secrets.data?.length ?? 0, secretSkipped: skipped, routeCount: routes.data?.length ?? 0, delegation, manifest: status.data?.state ?? null }}
    />
  )
}

/** A short path from sign-in to a live route. */
export function GuidedPathSection() {
  const { session } = useSession()
  const sites = useSites()
  const first = sites.data?.[0]
  return (
    <section className="space-y-6">
      {first
        ? <SiteGuide site={first.name} signedIn={!!session} delegation={first.delegation.status} />
        : <GuideSteps site={null} onSkipSecret={() => undefined} facts={{ signedIn: !!session, hasSite: false, activated: null, secretCount: 0, secretSkipped: false, routeCount: 0, delegation: null, manifest: null }} />}
    </section>
  )
}
