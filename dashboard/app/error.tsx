'use client'

import Link from 'next/link'
import { EmptyState } from '@/components/molecules/empty-state'
import { Button } from '@/components/ui/button'
import { CRASH } from '@/copy/pages'

/**
 * A page that threw while drawing. The header stays, the page is replaced by a calm message and a way to try again.
 * The error text is never shown (in production Next hides it anyway); only its short reference, for support.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <EmptyState
      title={CRASH.title}
      description={CRASH.description}
      action={(
        <div className="flex flex-col items-center gap-3">
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" onClick={reset}>{CRASH.retry}</Button>
            <Button asChild variant="outline"><Link href="/sites">{CRASH.home}</Link></Button>
          </div>
          {error.digest ? <p className="text-xs text-muted-foreground">{CRASH.reference}: <code className="font-mono">{error.digest}</code></p> : null}
        </div>
      )}
    />
  )
}
