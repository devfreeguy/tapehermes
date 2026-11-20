'use client'

import { CircleAlert, RotateCw } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CRASH } from '@/copy/pages'
import { useTranslator } from '@/lib/locale-context'
import { FailurePanel } from './failure-panel'

export type FailureProps = {
  error: Error & { digest?: string }
  retry?: () => void
  reset: () => void
}

export function RouteFailure({ error, retry, reset, standalone }: FailureProps & { standalone?: boolean }) {
  const t = useTranslator()
  return (
    <FailurePanel title={t(CRASH.title)} description={t(CRASH.description)} standalone={standalone} tone="warning"
      icon={<CircleAlert aria-hidden="true" className="size-5" />}
      actions={
        <>
          <Button type="button" className="pill-control" onClick={retry ?? reset}><RotateCw aria-hidden="true" />{t(CRASH.retry)}</Button>
          <Button asChild variant="outline" className="pill-control"><Link href="/sites">{t(CRASH.home)}</Link></Button>
        </>
      }
      reference={error?.digest ? <p>{t(CRASH.reference)}: <code className="font-mono">{error.digest}</code></p> : undefined}
    />
  )
}
