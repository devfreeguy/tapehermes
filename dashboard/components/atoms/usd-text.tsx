import { usdLabel } from '@/lib/format/text'
import { cn } from '@/lib/utils'

/** A price: "$0.002", or "Free" for zero. */
export function UsdText({ value, className }: { value: string; className?: string }) {
  return <span className={cn('font-mono', className)}>{usdLabel(value)}</span>
}
