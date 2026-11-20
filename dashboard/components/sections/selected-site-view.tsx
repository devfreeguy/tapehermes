'use client'

import { useTranslator } from '@/lib/locale-context'
import { Fragment, type ReactNode } from 'react'
import { Spinner } from '@/components/atoms/spinner'
import { ErrorNotice } from '@/components/molecules/error-notice'
import { useSiteSelection } from '@/components/molecules/site-selection-provider'
import { NewSiteSection } from './new-site-section'

export function SelectedSiteView({ children }: { children: ReactNode }) {
  const t = useTranslator()
  const { selected, pending, error } = useSiteSelection()
  if (selected) return <Fragment key={selected}>{children}</Fragment>
  if (pending) return <Spinner label={t('Opening your sites')} />
  if (error) return <ErrorNotice error={error} />
  return <NewSiteSection firstSite />
}
