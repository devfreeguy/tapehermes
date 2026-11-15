import Link from 'next/link'
import { AddressText } from '@/components/atoms/address-text'
import { StatusBadge } from '@/components/atoms/status-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { daysLeftLabel } from '@/lib/format/text'
import type { Site } from '@/lib/api/schemas'
import { DelegationBadge } from './delegation-badge'

/** One site in the list: its name (a link), whether it is on, its payout address and its delegation state. */
export function SiteCard({ site }: { site: Site }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="font-mono text-lg"><Link href={`/sites/${encodeURIComponent(site.name)}`} className="hover:underline">{site.name}</Link></CardTitle>
        <StatusBadge tone={site.status === 'ACTIVE' ? 'good' : 'neutral'}>{site.status === 'ACTIVE' ? 'On' : 'Off'}</StatusBadge>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="flex flex-wrap items-center gap-2"><span className="text-muted-foreground">Payout</span><AddressText value={site.payoutAddress} /></p>
        <p className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">Delegation</span><DelegationBadge state={site.delegation.status} />
          <span className="text-muted-foreground">{daysLeftLabel(site.delegation.status === 'none' ? null : site.delegation.daysLeft)}</span>
        </p>
      </CardContent>
    </Card>
  )
}
