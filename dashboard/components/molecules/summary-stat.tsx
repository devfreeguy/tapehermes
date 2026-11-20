import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** One number with its name, for the call summary. */
export function SummaryStat({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0 space-y-2 rounded-xl bg-surface/65 p-3 sm:p-5', className)}>
      <dt className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</dt>
      <dd className="text-lg font-semibold tracking-tight break-all tabular-nums sm:text-2xl">{children}</dd>
    </div>
  )
}
