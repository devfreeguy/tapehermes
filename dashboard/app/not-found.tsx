import { Compass } from 'lucide-react'
import Link from 'next/link'
import { FailurePanel } from '@/components/sections/failure-panel'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { NOT_FOUND } from '@/copy/pages'

export const metadata = { title: NOT_FOUND.title }

export default function NotFound() {
  return (
    <ScrollArea label="Page not found" className="h-dvh">
      <main className="grid min-h-dvh place-items-center px-4 py-8">
        <FailurePanel title={NOT_FOUND.title} description={NOT_FOUND.description} standalone
          icon={<Compass aria-hidden="true" className="size-5" />}
          actions={
            <>
              <Button asChild className="pill-control"><Link href="/sites">{NOT_FOUND.home}</Link></Button>
              <Button asChild variant="outline" className="pill-control"><Link href="/guide">{NOT_FOUND.guide}</Link></Button>
            </>
          }
        />
      </main>
    </ScrollArea>
  )
}
