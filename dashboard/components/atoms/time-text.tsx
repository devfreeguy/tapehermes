import { dateLabel } from '@/lib/format/text'

/** A moment in the viewer's own time zone, with the exact ISO time in the tooltip. */
export function TimeText({ value }: { value: string | null | undefined }) {
  if (!value) return null
  return <time dateTime={value} title={value}>{dateLabel(value)}</time>
}
