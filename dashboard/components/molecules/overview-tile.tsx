import { ArrowUpRight, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import type { Tone } from '@/components/atoms/status-badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function OverviewTile({
  title, icon: Icon, href, children, className, accentClassName, attention,
}: {
  title: string
  icon: LucideIcon
  href?: string
  children: ReactNode
  className?: string
  accentClassName?: string
  attention?: Tone
}) {
  const danger = attention === 'bad'
  const warning = attention === 'warn'
  return (
    <Card data-attention={attention} className={cn(
      'group/tile min-w-0 gap-5 rounded-2xl bg-background p-5 shadow-none sm:p-6 lg:p-7',
      danger && 'overview-alert border-destructive/45',
      warning && 'border-warning/35',
      className,
    )}>
      <div className="flex min-h-11 items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5 pt-1">
          <Icon aria-hidden="true" className={cn('mt-0.5 size-4 shrink-0 text-muted-foreground', accentClassName, danger && 'text-destructive', warning && 'text-warning')} />
          <h2 className="font-(family-name:--font-auth) text-sm leading-5 font-semibold text-muted-foreground">{title}</h2>
        </div>
        {href && (
          <Link href={href} aria-label={`Open ${title.toLowerCase()}`} className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-action/12 text-primary-action transition-colors hover:bg-primary-action/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            <ArrowUpRight aria-hidden="true" className="size-4" />
          </Link>
        )}
      </div>
      {children}
    </Card>
  )
}
