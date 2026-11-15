import { Check, Circle } from 'lucide-react'
import type { ReactNode } from 'react'
import { HintText } from '@/components/atoms/hint-text'
import { StatusBadge } from '@/components/atoms/status-badge'
import { cn } from '@/lib/utils'

export type StepState = 'done' | 'current' | 'upcoming'

/** One step of the guided path. Only the current step shows its action; done steps show a check; upcoming steps wait. */
export function StepItem({ number, title, why, state, optional, children }: { number: number; title: string; why: string; state: StepState; optional?: boolean; children?: ReactNode }) {
  return (
    <li aria-current={state === 'current' ? 'step' : undefined} data-state={state} className={cn('flex gap-4 rounded-lg border p-4', state === 'current' ? 'border-signal' : 'border-border', state === 'upcoming' && 'opacity-60')}>
      <span className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border font-mono text-sm', state === 'done' ? 'border-signal bg-signal text-signal-foreground' : 'border-border')}>
        {state === 'done' ? <Check className="size-4" aria-label="Done" /> : state === 'current' ? number : <Circle className="size-3" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-semibold">{title}</h3>{optional ? <StatusBadge>Optional</StatusBadge> : null}</div>
        <HintText>{why}</HintText>
        {state === 'current' ? children : null}
      </div>
    </li>
  )
}
