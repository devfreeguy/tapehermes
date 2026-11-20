'use client'

import { ChevronDown } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { explainError, explainProblem } from '@/copy/errors'
import { ApiError } from '@/lib/api/errors'

/** A failure in plain words, with the technical text kept inside a "Details" fold. Renders nothing when there is no error. */
export function ErrorNotice({ error }: { error: unknown }) {
  if (!error) return null
  const e = explainError(error)
  const problems = error instanceof ApiError && Array.isArray(error.details.problems) ? (error.details.problems as string[]) : []
  const users = error instanceof ApiError && Array.isArray(error.details.routes) ? (error.details.routes as string[]) : []
  return (
    <Alert variant="destructive" role="alert">
      <AlertTitle>{e.title}</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>{e.message}</p>
        {error instanceof ApiError && error.code === 'NOT_PUBLISHABLE'
          ? <ul className="list-disc pl-5">{problems.map((p) => <li key={p}>{explainProblem(p)}</li>)}</ul>
          : null}
        {users.length ? <p>Actions using it: {users.join(', ')}.</p> : null}
        <Collapsible>
          <CollapsibleTrigger className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline">
            Details <ChevronDown className="size-3" />
          </CollapsibleTrigger>
          <CollapsibleContent><code className="mt-1 block break-all font-mono text-xs text-muted-foreground">{e.technical}</code></CollapsibleContent>
        </Collapsible>
      </AlertDescription>
    </Alert>
  )
}
