import { dateLabel } from '@/lib/format/text'
import { useLocale } from '@/lib/locale-context'

/** A moment in the viewer's own time zone, with the exact ISO time in the tooltip. */
export function TimeText({ value }: { value: string | null | undefined }) {
  const locale = useLocale()
  if (!value) return null
  return <time dateTime={value} title={value}>{dateLabel(value, locale)}</time>
}
