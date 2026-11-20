'use client'

import { CircleAlert, RotateCw } from 'lucide-react'
import { FailurePanel } from '@/components/sections/failure-panel'
import { Button } from '@/components/ui/button'
import { FATAL } from '@/copy/pages'
import './globals.css'

/** The root layout failed. This recovery page supplies its own document and works without dashboard providers. */
export default function GlobalError() {
  return (
    <html lang="en" className="dark">
      <body>
        <main className="grid min-h-dvh place-items-center px-4 py-8">
          <FailurePanel title={FATAL.title} description={FATAL.description} standalone tone="warning"
            icon={<CircleAlert aria-hidden="true" className="size-5" />}
            actions={
              <>
                <Button type="button" className="pill-control" onClick={() => window.location.reload()}><RotateCw aria-hidden="true" />{FATAL.retry}</Button>
                <Button asChild variant="outline" className="pill-control"><a href="/">{FATAL.home}</a></Button>
              </>
            }
          />
        </main>
      </body>
    </html>
  )
}
