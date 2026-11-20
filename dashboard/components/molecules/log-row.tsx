import { useTranslator } from '@/lib/locale-context'
import { CodeText } from '@/components/atoms/code-text'
import { AddressText } from '@/components/atoms/address-text'
import { TimeText } from '@/components/atoms/time-text'
import { UsdText } from '@/components/atoms/usd-text'
import { TableCell, TableRow } from '@/components/ui/table'
import type { LogRow as Row } from '@/lib/api/schemas'

const RESULT_COLOR: Record<Row['result'], string> = { OK: 'bg-primary-action', ERROR: 'bg-destructive', RATE_LIMITED: 'bg-warning', REFUSED: 'bg-warning' }
const LABEL: Record<Row['result'], string> = { OK: 'OK', ERROR: 'Error', RATE_LIMITED: 'Rate limited', REFUSED: 'Refused' }

/** One call in the log. A call row holds the route, time, result, price, payment transaction and duration: nothing about the visitor. */
export function LogRow({ row }: { row: Row }) {
  const t = useTranslator()
  return (
    <TableRow>
      <TableCell className="py-3 text-muted-foreground"><TimeText value={row.at} /></TableCell>
      <TableCell><CodeText>{row.routeName}</CodeText></TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className={`size-1.5 rounded-full ${RESULT_COLOR[row.result]}`} />
          {t(LABEL[row.result])}
        </span>
        {row.errorCode && <span className="block font-mono text-xs text-muted-foreground">{row.errorCode}</span>}
      </TableCell>
      <TableCell><UsdText value={row.priceUsd} /></TableCell>
      <TableCell>{row.paid ? <span data-tone="good" className="text-primary-action">{t('Paid')}</span> : <span className="text-muted-foreground">{t('No')}</span>}</TableCell>
      <TableCell>{row.paymentTx ? <AddressText value={row.paymentTx} /> : <span className="text-muted-foreground">{t('None')}</span>}</TableCell>
      <TableCell className="text-right font-mono">{row.durationMs} {t('ms')}</TableCell>
    </TableRow>
  )
}
