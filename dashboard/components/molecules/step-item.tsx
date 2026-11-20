import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { HintText } from '@/components/atoms/hint-text'
import { cn } from '@/lib/utils'

export type StepState = 'done' | 'current' | 'upcoming'

/** One step of the guided path. Only the current step shows its action; done steps show a check; upcoming steps wait. */
export function StepItem({ number, title, why, state, optional, children }: { number: number; title: string; why: string; state: StepState; optional?: boolean; children?: ReactNode }) {
  return (
    <li aria-current={state === 'current' ? 'step' : undefined} data-state={state} className={cn('flex gap-3 rounded-2xl border bg-background p-4 sm:gap-4 sm:p-5', state === 'current' ? 'border-primary-action/45 bg-primary-action/6' : 'border-border')}>
      <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full bg-surface text-sm font-semibold text-muted-foreground', state !== 'upcoming' && 'bg-primary-action/12 text-primary-action')}>
        {state === 'done' ? <Check className="size-4" aria-label="Done" /> : number}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2"><h3 className="font-(family-name:--font-auth) text-base font-semibold">{title}</h3>{optional && <span className="text-xs text-muted-foreground">Optional</span>}</div>
        <HintText className="leading-relaxed">{why}</HintText>
        {state === 'current' && <div className="mt-4 border-t border-border pt-4">{children}</div>}
      </div>
    </li>
  )
}
