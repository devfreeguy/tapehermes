'use client'

import { SITE_TERMS } from '@/copy/site-terms'
import { Activity, CreditCard, Globe2, KeyRound, Network, ScrollText, ShieldCheck } from 'lucide-react'
import { AddressText } from '@/components/atoms/address-text'
import { CopyButton } from '@/components/atoms/copy-button'
import { Spinner } from '@/components/atoms/spinner'
import { TimeText } from '@/components/atoms/time-text'
import { DELEGATION_LOOK } from '@/components/molecules/delegation-badge'
import { ErrorNotice } from '@/components/molecules/error-notice'
import { MANIFEST_LOOK } from '@/components/molecules/manifest-state-badge'
import { OverviewTile } from '@/components/molecules/overview-tile'
import { useActivation } from '@/hooks/use-activation'
import { useLogSummary } from '@/hooks/use-logs'
import { useManifestStatus } from '@/hooks/use-manifest'
import { useRoutes } from '@/hooks/use-routes'
import { useSecrets } from '@/hooks/use-secrets'
import { useSite } from '@/hooks/use-sites'
import type { Site } from '@/lib/api/schemas'
import { daysLeftLabel } from '@/lib/format/text'
import { ActivationAction, CallAvailabilityAction, PayoutAction } from './site-overview-actions'

const periodDays = 7

function readout(pending: boolean) {
  return pending ? 'Loading…' : 'Unavailable'
}

import { useSelectedSiteName } from '@/components/molecules/site-selection-provider'

export function SiteOverviewSection({ siteName: explicitSite }: { siteName?: string }) {
  const siteName = useSelectedSiteName(explicitSite)
  const site = useSite(siteName)
  if (site.isPending) return <Spinner label="Loading site overview" />
  if (!site.data) return <ErrorNotice error={site.error} />
  return <SiteOverview site={site.data} />
}

function SiteOverview({ site }: { site: Site }) {
  const { name, delegation } = site
  const base = '/sites'
  const active = site.status === 'ACTIVE'
  const activation = useActivation(name)
  const calls = useLogSummary(name, periodDays)
  const routes = useRoutes(name)
  const secrets = useSecrets(name)
  const manifest = useManifestStatus(name)
  const totals = calls.data?.totals
  const enabledRoutes = routes.data?.filter((route) => route.enabled).length
  const manifestStatus = manifest.data && MANIFEST_LOOK[manifest.data.state]
  const delegationStatus = DELEGATION_LOOK[delegation.status]

  return (
    <section aria-labelledby="overview-title" className="space-y-7 lg:space-y-9">
      <header className="space-y-2">
        <h1 id="overview-title" className="font-(family-name:--font-auth) text-3xl font-extrabold break-all sm:text-4xl">Overview</h1>
        <p className="font-mono text-sm break-all text-muted-foreground">{name}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        <OverviewTile title="Call activity" icon={Activity} href={base + '/call-log'} accentClassName="text-primary-action" className="sm:col-span-2">
          <div className="my-auto space-y-5 rounded-xl bg-primary-action/6 px-3 py-4 sm:px-5 sm:py-5">
            <p className="text-sm text-muted-foreground">Last {periodDays} days</p>
            {totals ? (
              <dl className="grid grid-cols-3 gap-2 sm:gap-4">
                <Metric label="Total calls" value={totals.calls.toLocaleString()} />
                <Metric label="Paid calls" value={totals.paidCalls.toLocaleString()} />
                <Metric label="Earned (USD)" value={'$' + totals.paidUsd} />
              </dl>
            ) : <p role="status" className="text-sm text-muted-foreground">{readout(calls.isPending)}</p>}
          </div>
        </OverviewTile>

        <OverviewTile title="Availability" icon={Globe2}>
          <div className="space-y-2 rounded-xl bg-surface/65 px-4 py-4">
            <p className="text-lg font-semibold tracking-tight">{active ? 'Answering calls' : 'Paused'}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {activation.data
                ? activation.data.activated
                  ? activation.data.paidUntil
                    ? <>Switched on until <TimeText value={activation.data.paidUntil} /></>
                    : 'Switched on'
                  : 'Not switched on'
                : activation.isPending ? 'Checking X Layer activation…' : 'X Layer activation status is unavailable.'}
            </p>
          </div>
          <div className="mt-auto flex flex-wrap gap-2">
            <ActivationAction siteName={name} />
            <CallAvailabilityAction siteName={name} active={active} />
          </div>
        </OverviewTile>

        <OverviewTile title={SITE_TERMS.routes.label} icon={Network} href={base + '/actions'} accentClassName="text-info">
          <div className="space-y-2 rounded-xl bg-info/8 p-4">
            <p className="text-xl font-semibold tracking-tight tabular-nums">{enabledRoutes === undefined ? readout(routes.isPending) : enabledRoutes + ' enabled'}</p>
            <p className="text-sm text-muted-foreground">{routes.data ? routes.data.length + ' configured in total' : 'See which actions are on and what they cost.'}</p>
          </div>
        </OverviewTile>

        <OverviewTile title={SITE_TERMS.secrets.label} icon={KeyRound} href={base + '/keys'} accentClassName="text-accent">
          <div className="space-y-2 rounded-xl bg-accent/8 p-4">
            <p className="text-xl font-semibold tracking-tight tabular-nums">{secrets.data ? secrets.data.length + ' stored' : readout(secrets.isPending)}</p>
            <p className="text-sm text-muted-foreground">Private keys used by your actions.</p>
          </div>
        </OverviewTile>

        <OverviewTile title={SITE_TERMS.delegation.label} icon={ShieldCheck} href={base + '/permission'} accentClassName="text-primary-action" attention={delegationStatus.tone}>
          <div className="space-y-2 border-s-2 border-primary-action/25 py-2 ps-4">
            <OverviewStatus>{delegationStatus.label}</OverviewStatus>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {delegation.expiresAt
                ? <>Expires <TimeText value={delegation.expiresAt} /> · {daysLeftLabel(delegation.daysLeft)}</>
                : 'Give TapeHermes permission to sign your site’s replies.'}
            </p>
          </div>
        </OverviewTile>

        <OverviewTile title={SITE_TERMS.manifest.label} icon={ScrollText} href={base + '/api-list'} attention={manifestStatus?.tone}>
          {manifestStatus ? (
            <>
              <OverviewStatus>{manifestStatus.label}</OverviewStatus>
              <p className="text-sm leading-relaxed text-muted-foreground">{manifestStatus.sentence}</p>
            </>
          ) : <p role="status" className="text-sm text-muted-foreground">{readout(manifest.isPending)}</p>}
        </OverviewTile>

        <OverviewTile title="Site details" icon={CreditCard} className="sm:col-span-2">
          <dl className="grid gap-x-5 gap-y-3 rounded-xl bg-surface/65 p-4 text-sm sm:grid-cols-2">
            <AddressDetail label="Holder" address={site.holder} />
            <AddressDetail label="Payout address" address={site.payoutAddress} />
            <AddressDetail label="Signing key" address={site.signer} />
            <div>
              <dt className="text-muted-foreground">Added</dt>
              <dd className="mt-1"><TimeText value={site.createdAt} /></dd>
            </div>
          </dl>
          <div><PayoutAction siteName={name} /></div>
        </OverviewTile>
      </div>
    </section>
  )
}

function OverviewStatus({ children }: { children: string }) {
  return <p className="text-lg font-semibold tracking-tight group-data-[attention=bad]/tile:text-destructive group-data-[attention=warn]/tile:text-warning">{children}</p>
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="group flex min-w-0 flex-col gap-2 border-s border-border ps-2 first:border-s-0 first:ps-0 sm:ps-4">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="order-first text-base font-semibold tracking-tight break-all tabular-nums group-first:text-primary-action sm:text-2xl">{value}</dd>
    </div>
  )
}

function AddressDetail({ label, address }: { label: string; address: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 flex items-center gap-1"><AddressText value={address} full className="text-xs" /><CopyButton value={address} /></dd>
    </div>
  )
}
