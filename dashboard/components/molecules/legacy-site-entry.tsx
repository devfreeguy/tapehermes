'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ErrorNotice } from '@/components/molecules/error-notice'
import { Spinner } from '@/components/atoms/spinner'
import { useSiteSelection } from './site-selection-provider'

export function LegacySiteEntry({ site }: { site: string }) {
  const { sites, pending, error, selectSite } = useSiteSelection()
  const pathname = usePathname()
  const router = useRouter()
  useEffect(() => {
    if (pending || error) return
    if (!sites.some(({ name }) => name === site)) {
      router.replace('/sites')
      return
    }
    selectSite(site)
    const suffix = pathname.split('/').slice(3).join('/')
    router.replace(suffix ? `/sites/${suffix}` : '/sites')
  }, [sites, pending, error, pathname, router, selectSite, site])

  return error ? <ErrorNotice error={error} /> : <Spinner label="Opening your site" />
}
