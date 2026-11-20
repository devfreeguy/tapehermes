import { BookOpen } from 'lucide-react'
import { SITE_TERMS } from '@/copy/site-terms'
import { OverviewTile } from '@/components/molecules/overview-tile'

export function GuideGlossary() {
  return (
    <OverviewTile title="What these words mean" icon={BookOpen} accentClassName="text-accent" className="h-fit">
      <dl className="divide-y divide-border">
        {Object.values(SITE_TERMS).map(({ label, description }) => (
          <div key={label} className="space-y-1 py-3 first:pt-0 last:pb-0">
            <dt className="text-sm font-semibold">{label}</dt>
            <dd className="text-sm leading-relaxed text-muted-foreground">{description}</dd>
          </div>
        ))}
      </dl>
    </OverviewTile>
  )
}
