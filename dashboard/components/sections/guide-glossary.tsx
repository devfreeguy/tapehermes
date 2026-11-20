import { getTranslator } from '@/lib/server-locale'
import { BookOpen } from 'lucide-react'
import { SITE_TERMS } from '@/copy/site-terms'
import { OverviewTile } from '@/components/molecules/overview-tile'

export async function GuideGlossary() {
  const t = await getTranslator()
  return (
    <OverviewTile title={t('What these words mean')} icon={BookOpen} accentClassName="text-accent" className="h-fit">
      <dl className="divide-y divide-border">
        {Object.values(SITE_TERMS).map(({ label, description }) => (
          <div key={label} className="space-y-1 py-3 first:pt-0 last:pb-0">
            <dt className="text-sm font-semibold">{t(label)}</dt>
            <dd className="text-sm leading-relaxed text-muted-foreground">{t(description)}</dd>
          </div>
        ))}
      </dl>
    </OverviewTile>
  )
}
