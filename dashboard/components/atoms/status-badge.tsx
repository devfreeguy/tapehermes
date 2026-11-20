import { cva, type VariantProps } from 'class-variance-authority'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const tones = cva('border font-mono text-xs', {
  variants: {
    tone: {
      good: 'border-success/40 bg-card text-primary-action dark:bg-success/15 dark:text-success',
      warn: 'border-warning/40 bg-card dark:bg-warning/15 text-warning',
      bad: 'border-destructive/40 bg-card dark:bg-destructive/15 text-destructive',
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
