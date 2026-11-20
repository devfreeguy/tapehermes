import { translator, type Locale, type Translate } from '@/lib/locale'

/** 0x1234567890abcdef... to 0x1234...cdef. Short values come back as they are. */
export function shortHex(value: string, head = 6, tail = 4): string {
  return value.length <= head + tail + 3 ? value : `${value.slice(0, head)}...${value.slice(-tail)}`
}

/** "0.002" to "$0.002", "0" to "Free". */
export function usdLabel(value: string): string {
  const n = Number(value)
  return !Number.isFinite(n) || n === 0 ? 'Free' : `$${value.replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1')}`
}

/** A date as "14 Nov 2026, 19:05" in the viewer's own time zone. Bad input returns an empty string. */
export function dateLabel(iso: string | null | undefined, locale: Locale = 'en'): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(locale === 'en' ? 'en-GB' : locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** "in 12 days", "tomorrow", "expired". */
export function daysLeftLabel(daysLeft: number | null, t: Translate = translator('en')): string {
  if (daysLeft === null) return ''
  if (daysLeft <= 0) return t('ends today')
  return daysLeft === 1 ? t('1 day left') : t('{0} days left', daysLeft)
}
