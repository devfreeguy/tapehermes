import type { ReactNode } from 'react'
import { HintText } from '@/components/atoms/hint-text'

/** What a list shows when it has nothing yet: one line of what it is for, and the action that fills it. */
export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border p-8 text-center">
      <p className="font-mono text-lg">{title}</p>
      <HintText className="max-w-prose">{description}</HintText>
      {action}
    </div>
  )
}
