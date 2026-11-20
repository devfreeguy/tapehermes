import { NewSiteSection } from '@/components/sections/new-site-section'
import { getTranslator } from '@/lib/server-locale'

export async function generateMetadata() {
  const t = await getTranslator()
  return { title: t('Add a site') }
}

export default function NewSitePage() {
  return <NewSiteSection />
}
