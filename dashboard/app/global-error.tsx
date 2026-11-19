'use client'

import { EmptyState } from '@/components/molecules/empty-state'
import { Button } from '@/components/ui/button'
import { FATAL } from '@/copy/pages'
import './globals.css'

/** Last resort: the root layout itself failed, so this page brings its own html and body. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en" className="dark">
      <body>
        <main className="mx-auto max-w-xl px-4 py-16">
          <EmptyState title={FATAL.title} description={FATAL.description} action={<Button type="button" onClick={reset}>{FATAL.retry}</Button>} />
        </main>
      </body>
    </html>
  )
}
