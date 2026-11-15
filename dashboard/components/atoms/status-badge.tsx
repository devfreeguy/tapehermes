import { cva, type VariantProps } from 'class-variance-authority'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const tones = cva('border font-mono text-xs', {
  variants: {
    tone: {
      good: 'border-signal/40 bg-signal/15 text-signal',
      warn: 'border-warning/40 bg-warning/15 text-warning',
      bad: 'border-destructive/40 bg-destructive/15 text-destructive',
      neutral: 'border-border bg-muted text-muted-foreground',
    },
  },
  defaultVariants: { tone: 'neutral' },
})

export type Tone = NonNullable<VariantProps<typeof tones>['tone']>

/** One word of status in a color that means something: good (green), warn (amber), bad (red) or neutral. */
export function StatusBadge({ tone, children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <Badge variant="outline" data-tone={tone ?? 'neutral'} className={cn(tones({ tone }), className)}>{children}</Badge>
}
