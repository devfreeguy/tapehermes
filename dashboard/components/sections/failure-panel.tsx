import type { ReactNode } from 'react'
import { BrandWordmark } from '@/components/atoms/brand-wordmark'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function FailurePanel({
  title, description, icon, actions, reference, standalone = false, tone = 'neutral',
}: {
  title: string
  description: string
  icon: ReactNode
  actions: ReactNode
  reference?: ReactNode
  standalone?: boolean
  tone?: 'neutral' | 'warning'
}) {
  return (
    <section aria-labelledby="failure-title" className="mx-auto w-full max-w-xl">
      <Card className="gap-7 rounded-2xl bg-background p-6 shadow-none sm:p-9">
        {standalone && <BrandWordmark />}
        <div className="space-y-4">
          <span className={cn(
            'flex size-12 items-center justify-center rounded-xl',
            tone === 'warning' ? 'bg-warning/12 text-warning' : 'bg-info/10 text-info',
          )}>{icon}</span>
          <div className="space-y-2">
            <h1 id="failure-title" className="font-(family-name:--font-auth) text-2xl leading-tight font-extrabold tracking-tight sm:text-3xl">{title}</h1>
            <p className="max-w-prose text-sm leading-relaxed text-muted-foreground sm:text-base">{description}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 max-[420px]:[&>*]:w-full">{actions}</div>
        {reference && <div className="border-t border-border pt-4 text-xs break-all text-muted-foreground">{reference}</div>}
      </Card>
    </section>
  )
}
