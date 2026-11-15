import type { ReactNode } from 'react'
import { HintText } from './hint-text'

/** The heading of a page or a section, with an optional sentence under it and an optional action on the right. */
export function PageTitle({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description ? <HintText>{description}</HintText> : null}
      </div>
      {action}
    </div>
  )
}
