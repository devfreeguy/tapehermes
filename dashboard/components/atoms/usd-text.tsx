import { usdLabel } from '@/lib/format/text'
import { cn } from '@/lib/utils'
import { useTranslator } from '@/lib/locale-context'

/** A price: "$0.002", or "Free" for zero. */
export function UsdText({ value, className }: { value: string; className?: string }) {
  const t = useTranslator()
  return <span className={cn('font-mono', className)}>{t(usdLabel(value))}</span>
}
