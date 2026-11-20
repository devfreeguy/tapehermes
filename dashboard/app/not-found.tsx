import { getTranslator } from '@/lib/server-locale'
import { Compass } from 'lucide-react'
import Link from 'next/link'
import { FailurePanel } from '@/components/sections/failure-panel'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { NOT_FOUND } from '@/copy/pages'

export async function generateMetadata() {
  const t = await getTranslator()
  return { title: t(NOT_FOUND.title) }
}

export default async function NotFound() {
  const t = await getTranslator()
  return (
    <ScrollArea label={t('Page not found')} className="h-dvh">
      <main className="grid min-h-dvh place-items-center px-4 py-8">
        <FailurePanel title={t(NOT_FOUND.title)} description={t(NOT_FOUND.description)} standalone
          icon={<Compass aria-hidden="true" className="size-5" />}
          actions={
            <>
              <Button asChild className="pill-control"><Link href="/sites">{t(NOT_FOUND.home)}</Link></Button>
              <Button asChild variant="outline" className="pill-control"><Link href="/guide">{t(NOT_FOUND.guide)}</Link></Button>
            </>
          }
        />
      </main>
    </ScrollArea>
  )
}
