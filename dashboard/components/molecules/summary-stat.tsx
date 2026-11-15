import type { ReactNode } from 'react'

/** One number with its name, for the call summary. */
export function SummaryStat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-2xl">{children}</dd>
    </div>
  )
}
