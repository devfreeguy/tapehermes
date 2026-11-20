import { getTranslator } from '@/lib/server-locale'
import { GuidedPathSection } from '@/components/sections/guided-path-section'
import { GuideGlossary } from '@/components/sections/guide-glossary'
import { PageTitle } from '@/components/atoms/page-title'
import { Button } from '@/components/ui/button'

export async function generateMetadata() {
  const t = await getTranslator()
  return { title: t('Guided setup') }
}
export default async function GuidePage() {
  const t = await getTranslator()
  return (
    <div className="space-y-7 font-(family-name:--font-auth) sm:space-y-9">
      <PageTitle variant="dashboard" title={t('Guided setup')} description={t('Set up your site, add something it can do, and make it available to apps. Start with the highlighted step.')}
        action={<Button asChild variant="outline" className="pill-control lg:hidden!"><a href="#guide-glossary">{t('What these words mean')}</a></Button>}
      />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <GuidedPathSection />
        <aside id="guide-glossary" aria-label={t('Dashboard glossary')}><GuideGlossary /></aside>
      </div>
    </div>
  )
}
