'use client'

import { useRouter } from 'next/navigation'
import { useSiteSelection } from '@/components/molecules/site-selection-provider'
import { RegisterSiteForm } from './register-site-form'

export function NewSiteForm() {
  const router = useRouter()
  const { selectSite } = useSiteSelection()
  return <RegisterSiteForm presentation="viewer" onDone={(name) => {
    selectSite(name)
    router.push('/sites')
  }} />
}
