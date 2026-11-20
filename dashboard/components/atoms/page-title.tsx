import type { ReactNode } from 'react'
import { HintText } from './hint-text'

/** The heading of a page or a section, with an optional sentence under it and an optional action on the right. */
export function PageTitle({ title, description, action, variant }: { title: string; description?: string; action?: ReactNode; variant?: 'dashboard' }) {
  const dashboard = variant === 'dashboard'
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className={dashboard ? 'space-y-2' : 'space-y-1'}>
        <h1 className={dashboard ? 'font-(family-name:--font-auth) text-3xl font-extrabold tracking-tight sm:text-4xl' : 'text-2xl font-semibold'}>{title}</h1>
        {description ? <HintText className={dashboard ? 'max-w-xl leading-relaxed' : undefined}>{description}</HintText> : null}
      </div>
      {action}
    </div>
  )
}
