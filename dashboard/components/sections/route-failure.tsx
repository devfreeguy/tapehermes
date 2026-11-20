'use client'

import { CircleAlert, RotateCw } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CRASH } from '@/copy/pages'
import { FailurePanel } from './failure-panel'

export type FailureProps = {
  error: Error & { digest?: string }
  retry?: () => void
  reset: () => void
}

export function RouteFailure({ error, retry, reset, standalone }: FailureProps & { standalone?: boolean }) {
  return (
    <FailurePanel title={CRASH.title} description={CRASH.description} standalone={standalone} tone="warning"
      icon={<CircleAlert aria-hidden="true" className="size-5" />}
      actions={
        <>
          <Button type="button" className="pill-control" onClick={retry ?? reset}><RotateCw aria-hidden="true" />{CRASH.retry}</Button>
          <Button asChild variant="outline" className="pill-control"><Link href="/sites">{CRASH.home}</Link></Button>
        </>
      }
      reference={error?.digest ? <p>{CRASH.reference}: <code className="font-mono">{error.digest}</code></p> : undefined}
    />
  )
}
