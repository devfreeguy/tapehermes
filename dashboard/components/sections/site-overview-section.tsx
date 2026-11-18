'use client'

import { useState } from 'react'
import { AddressText } from '@/components/atoms/address-text'
import { CopyButton } from '@/components/atoms/copy-button'
import { PageTitle } from '@/components/atoms/page-title'
import { Spinner } from '@/components/atoms/spinner'
import { StatusBadge } from '@/components/atoms/status-badge'
import { TimeText } from '@/components/atoms/time-text'
import { DelegationBadge } from '@/components/molecules/delegation-badge'
import { ErrorNotice } from '@/components/molecules/error-notice'
import { FormField } from '@/components/molecules/form-field'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ActivationSection } from './activation-section'
import { useSetPayout, useSetSiteStatus, useSite } from '@/hooks/use-sites'
import { daysLeftLabel } from '@/lib/format/text'

/** The facts about one site: status, holder, payout address and delegation, with the two settings an owner may change here. */
export function SiteOverviewSection({ siteName }: { siteName: string }) {
  const site = useSite(siteName)
  const setStatus = useSetSiteStatus(siteName)
  const setPayout = useSetPayout(siteName)
  const [payout, setPayoutText] = useState('')
  if (site.isPending) return <Spinner />
  if (!site.data) return <ErrorNotice error={site.error} />
  const s = site.data
  const on = s.status === 'ACTIVE'
  return (
    <section className="space-y-6">
      <PageTitle title={s.name} description="Site details" action={<StatusBadge tone={on ? 'good' : 'neutral'}>{on ? 'Answering calls' : 'Paused'}</StatusBadge>} />
      <ActivationSection siteName={siteName} />
      <Card>
        <CardHeader><CardTitle>Details</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm sm:grid-cols-[10rem_1fr]">
            <dt className="text-muted-foreground">Holder</dt><dd className="flex items-center gap-1"><AddressText value={s.holder} full /><CopyButton value={s.holder} /></dd>
            <dt className="text-muted-foreground">Payout address</dt><dd className="flex items-center gap-1"><AddressText value={s.payoutAddress} full /><CopyButton value={s.payoutAddress} /></dd>
            <dt className="text-muted-foreground">Signing key</dt><dd className="flex items-center gap-1"><AddressText value={s.signer} full /><CopyButton value={s.signer} /></dd>
            <dt className="text-muted-foreground">Delegation</dt>
            <dd className="flex flex-wrap items-center gap-2"><DelegationBadge state={s.delegation.status} />
              {s.delegation.expiresAt ? <><TimeText value={s.delegation.expiresAt} /><span className="text-muted-foreground">{daysLeftLabel(s.delegation.daysLeft)}</span></> : null}</dd>
            <dt className="text-muted-foreground">Added</dt><dd><TimeText value={s.createdAt} /></dd>
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Payout address</CardTitle></CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); setPayout.mutate(payout.trim(), { onSuccess: () => setPayoutText('') }) }}>
            <FormField id="payout" label="Where payments go" hint="Visitors pay this address. It starts as the holder wallet. Change it to receive payments somewhere else.">
              <Input id="payout" value={payout} onChange={(e) => setPayoutText(e.target.value)} placeholder="0x..." className="max-w-xl font-mono" autoComplete="off" />
            </FormField>
            <Button type="submit" disabled={!payout || setPayout.isPending}>{setPayout.isPending ? <Spinner /> : null}Save payout address</Button>
            <ErrorNotice error={setPayout.error} />
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{on ? 'Pause calls' : 'Resume calls'}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{on ? 'Pausing answers every call with "not found" at once and clears its keys from memory. Your settings are kept. This is TapeHermes only, and does not change the switch-on state on X Layer.' : 'Calls are paused. Resume to answer calls again.'}</p>
          <Button type="button" variant="outline" disabled={setStatus.isPending} onClick={() => setStatus.mutate(on ? 'DISABLED' : 'ACTIVE')}>{on ? 'Pause calls' : 'Resume calls'}</Button>
          <ErrorNotice error={setStatus.error} />
        </CardContent>
      </Card>
    </section>
  )
}
