'use client'

import { useState } from 'react'
import { PageTitle } from '@/components/atoms/page-title'
import { Spinner } from '@/components/atoms/spinner'
import { UsdText } from '@/components/atoms/usd-text'
import { EmptyState } from '@/components/molecules/empty-state'
import { ErrorNotice } from '@/components/molecules/error-notice'
import { LogRow } from '@/components/molecules/log-row'
import { SummaryStat } from '@/components/molecules/summary-stat'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useLogs, useLogSummary } from '@/hooks/use-logs'

const ALL = '__all__'
const DAYS = [1, 7, 30, 90]

/** Calls per site and route: a summary for the last days, and the newest calls underneath. Nothing about visitors is stored. */
export function CallLogSection({ siteName }: { siteName: string }) {
  const [route, setRoute] = useState(ALL)
  const [days, setDays] = useState(7)
  const summary = useLogSummary(siteName, days)
  const logs = useLogs(siteName, route === ALL ? undefined : route)
  const names = Object.keys(summary.data?.routes ?? {})
  return (
    <section className="space-y-6">
      <PageTitle title="Call log" description="Each row is one call: the route, the result, what it cost and how long it took. No visitor details are kept." />
      <div className="flex flex-wrap gap-3">
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger aria-label="Period" className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>{DAYS.map((d) => <SelectItem key={d} value={String(d)}>{d === 1 ? 'Last day' : `Last ${d} days`}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={route} onValueChange={setRoute}>
          <SelectTrigger aria-label="Route" className="w-48 font-mono"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value={ALL}>All routes</SelectItem>{names.map((n) => <SelectItem key={n} value={n} className="font-mono">{n}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <ErrorNotice error={summary.error ?? logs.error} />
      {summary.data ? (
        <dl className="grid gap-3 sm:grid-cols-3">
          <SummaryStat label="Calls">{summary.data.totals.calls}</SummaryStat>
          <SummaryStat label="Paid calls">{summary.data.totals.paidCalls}</SummaryStat>
          <SummaryStat label="Earned"><UsdText value={summary.data.totals.paidUsd} /></SummaryStat>
        </dl>
      ) : summary.isPending ? <Spinner /> : null}
      {logs.data?.length === 0 ? <EmptyState title="No calls yet" description="Calls appear here as soon as a visitor uses one of your routes." /> : null}
      {logs.data?.length ? (
        <Table>
          <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Route</TableHead><TableHead>Result</TableHead><TableHead>Price</TableHead><TableHead>Paid</TableHead><TableHead>Payment</TableHead><TableHead className="text-right">Time taken</TableHead></TableRow></TableHeader>
          <TableBody>{logs.data.map((r, i) => <LogRow key={`${r.at}-${i}`} row={r} />)}</TableBody>
        </Table>
      ) : null}
    </section>
  )
}
