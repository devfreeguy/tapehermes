'use client'
import { useTranslator } from '@/lib/locale-context'

import { RouteFailure, type FailureProps } from '@/components/sections/route-failure'
import { ScrollArea } from '@/components/ui/scroll-area'

export default function ErrorPage(props: FailureProps) {
  const t = useTranslator()
  return (
    <ScrollArea label={t('Page recovery')} className="h-dvh">
      <main className="grid min-h-dvh place-items-center px-4 py-8">
        <RouteFailure {...props} standalone />
      </main>
    </ScrollArea>
  )
}
