import { shortHex } from '@/lib/format/text'
import { cn } from '@/lib/utils'

/** A wallet address or hash in monospace, shortened by default. The full value stays in the tooltip and is copyable. */
export function AddressText({ value, full = false, className }: { value: string; full?: boolean; className?: string }) {
  return <span title={value} className={cn('font-mono text-sm break-all', className)}>{full ? value : shortHex(value)}</span>
}
