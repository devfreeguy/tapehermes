'use client'

import { SITE_TERMS } from '@/copy/site-terms'
import { useState } from 'react'
import { Activity, ListChecks } from 'lucide-react'
import { PageTitle } from '@/components/atoms/page-title'
import { Spinner } from '@/components/atoms/spinner'
import { UsdText } from '@/components/atoms/usd-text'
import { EmptyState } from '@/components/molecules/empty-state'
import { ErrorNotice } from '@/components/molecules/error-notice'
import { LogRow } from '@/components/molecules/log-row'
import { OverviewTile } from '@/components/molecules/overview-tile'
import { SummaryStat } from '@/components/molecules/summary-stat'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useLogs, useLogSummary } from '@/hooks/use-logs'

const ALL = '__all__'
const DAYS = [1, 7, 30, 90]

/** Calls per site and route: a summary for the last days, and the newest calls underneath. Nothing about visitors is stored. */
import { useSelectedSiteName } from '@/components/molecules/site-selection-provider'

export function CallLogSection({ siteName: explicitSite }: { siteName?: string }) {
  const siteName = useSelectedSiteName(explicitSite)
  const [route, setRoute] = useState(ALL)
  const [days, setDays] = useState(7)
  const summary = useLogSummary(siteName, days)
  const logs = useLogs(siteName, route === ALL ? undefined : route)
  const names = Object.keys(summary.data?.routes ?? {})
  return (
    <section className="space-y-7 lg:space-y-9">
      <PageTitle variant="dashboard" title={SITE_TERMS.logs.label} description={SITE_TERMS.logs.description} />
      <ErrorNotice error={summary.error ?? logs.error} />
      <OverviewTile title="Request totals" icon={Activity} accentClassName="text-primary-action">
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger aria-label="Period" className="h-11! w-40 rounded-full px-4"><SelectValue /></SelectTrigger>
          <SelectContent position="popper">{DAYS.map((d) => <SelectItem key={d} value={String(d)}>{d === 1 ? 'Last day' : `Last ${d} days`}</SelectItem>)}</SelectContent>
        </Select>
        {summary.data ? (
          <dl className="grid grid-cols-3 gap-2 sm:gap-3">
            <SummaryStat label="Requests" className="bg-primary-action/8">{summary.data.totals.calls}</SummaryStat>
            <SummaryStat label="Paid requests" className="bg-info/8">{summary.data.totals.paidCalls}</SummaryStat>
            <SummaryStat label="Earned" className="bg-accent/8"><UsdText value={summary.data.totals.paidUsd} /></SummaryStat>
          </dl>
        ) : summary.isPending ? <Spinner label="Loading request totals" /> : null}
      </OverviewTile>
      <OverviewTile title="Recent requests" icon={ListChecks} accentClassName="text-info">
        <Select value={route} onValueChange={setRoute}>
          <SelectTrigger aria-label="Action" className="h-11! w-48 max-w-full rounded-full px-4 font-mono"><SelectValue /></SelectTrigger>
          <SelectContent position="popper"><SelectItem value={ALL}>All actions</SelectItem>{names.map((n) => <SelectItem key={n} value={n} className="font-mono">{n}</SelectItem>)}</SelectContent>
        </Select>
        {logs.isPending && <Spinner label="Loading recent requests" />}
        {logs.data?.length === 0 && <EmptyState title="No requests yet" description="Requests show up here when someone uses an action." />}
        {!!logs.data?.length && (
        <ScrollArea label="Call Log table" orientation="horizontal" className="rounded-xl border border-border pb-3 [&_[data-slot=table-container]]:overflow-visible [&_td]:px-4 [&_th]:px-4">
          <Table>
            <TableHeader className="bg-surface/65"><TableRow><TableHead>Time</TableHead><TableHead>Action</TableHead><TableHead>Result</TableHead><TableHead>Price</TableHead><TableHead>Paid</TableHead><TableHead>Payment</TableHead><TableHead className="text-right">Time taken</TableHead></TableRow></TableHeader>
            <TableBody>{logs.data.map((r, i) => <LogRow key={`${r.at}-${i}`} row={r} />)}</TableBody>
          </Table>
        </ScrollArea>
        )}
      </OverviewTile>
    </section>
  )
}
