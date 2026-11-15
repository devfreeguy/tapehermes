import { CodeText } from '@/components/atoms/code-text'
import { AddressText } from '@/components/atoms/address-text'
import { StatusBadge, type Tone } from '@/components/atoms/status-badge'
import { TimeText } from '@/components/atoms/time-text'
import { UsdText } from '@/components/atoms/usd-text'
import { TableCell, TableRow } from '@/components/ui/table'
import type { LogRow as Row } from '@/lib/api/schemas'

const TONE: Record<Row['result'], Tone> = { OK: 'good', ERROR: 'bad', RATE_LIMITED: 'warn', REFUSED: 'warn' }
const LABEL: Record<Row['result'], string> = { OK: 'OK', ERROR: 'Error', RATE_LIMITED: 'Rate limited', REFUSED: 'Refused' }

/** One call in the log. A call row holds the route, time, result, price, payment transaction and duration: nothing about the visitor. */
export function LogRow({ row }: { row: Row }) {
  return (
    <TableRow>
      <TableCell><TimeText value={row.at} /></TableCell>
      <TableCell><CodeText>{row.routeName}</CodeText></TableCell>
      <TableCell><StatusBadge tone={TONE[row.result]}>{LABEL[row.result]}</StatusBadge>{row.errorCode ? <span className="ml-2 font-mono text-xs text-muted-foreground">{row.errorCode}</span> : null}</TableCell>
      <TableCell><UsdText value={row.priceUsd} /></TableCell>
      <TableCell>{row.paid ? <StatusBadge tone="good">Paid</StatusBadge> : <span className="text-muted-foreground">No</span>}</TableCell>
      <TableCell>{row.paymentTx ? <AddressText value={row.paymentTx} /> : <span className="text-muted-foreground">None</span>}</TableCell>
      <TableCell className="text-right font-mono">{row.durationMs} ms</TableCell>
    </TableRow>
  )
}
