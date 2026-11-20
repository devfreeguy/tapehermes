'use client'

import { CircleAlert, RotateCw } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { FailurePanel } from '@/components/sections/failure-panel'
import { Button } from '@/components/ui/button'
import { FATAL } from '@/copy/pages'
import { defaultLocale, localeCookie, parseLocale, translator } from '@/lib/locale'
import './globals.css'

/** The root layout failed. This recovery page supplies its own document and works without dashboard providers. */
const subscribe = () => () => undefined
const readLocale = () => parseLocale(document.cookie.split('; ').find((entry) => entry.startsWith(localeCookie + '='))?.slice(localeCookie.length + 1))

export default function GlobalError() {
  const locale = useSyncExternalStore(subscribe, readLocale, () => defaultLocale)
  const t = translator(locale)
  return (
    <html lang={locale} className="dark">
      <body>
        <main className="grid min-h-dvh place-items-center px-4 py-8">
          <FailurePanel title={t(FATAL.title)} description={t(FATAL.description)} standalone tone="warning"
            icon={<CircleAlert aria-hidden="true" className="size-5" />}
            actions={
              <>
                <Button type="button" className="pill-control" onClick={() => window.location.reload()}><RotateCw aria-hidden="true" />{t(FATAL.retry)}</Button>
                <Button asChild variant="outline" className="pill-control"><a href="/">{t(FATAL.home)}</a></Button>
              </>
            }
          />
        </main>
      </body>
    </html>
  )
}
