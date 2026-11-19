import Link from 'next/link'
import { EmptyState } from '@/components/molecules/empty-state'
import { Button } from '@/components/ui/button'
import { NOT_FOUND } from '@/copy/pages'

export const metadata = { title: NOT_FOUND.title }

/** Any address the app does not have. Next answers it with a real 404 status. */
export default function NotFound() {
  return (
    <EmptyState
      title={NOT_FOUND.title}
      description={NOT_FOUND.description}
      action={(
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild><Link href="/sites">{NOT_FOUND.home}</Link></Button>
          <Button asChild variant="outline"><Link href="/guide">{NOT_FOUND.guide}</Link></Button>
        </div>
      )}
    />
  )
}
