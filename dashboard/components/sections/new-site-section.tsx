'use client'

import { useTranslator } from '@/lib/locale-context'
import { Globe2, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { NewSiteForm } from './new-site-form'

export function NewSiteSection({ firstSite = false }: { firstSite?: boolean }) {
  const t = useTranslator()
  return (
    <section aria-labelledby="new-site-title" className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-start lg:gap-10">
      <header className="space-y-4 lg:pt-5">
        <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary-action/12 text-primary-action">
          <Globe2 aria-hidden="true" className="size-6" />
        </div>
        <h1 id="new-site-title" className="font-(family-name:--font-auth) text-3xl font-extrabold sm:text-4xl">
          {firstSite ? t('Add your first site') : t('Add a site')}
        </h1>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground sm:text-base">
          {t('Add a TapeOut site you own. Then you can choose what it does, save the keys it needs, and set prices.')}
        </p>
        <Button asChild variant="outline" className="pill-control">
          <Link href="/guide">{t('Open the setup guide')}</Link>
        </Button>
      </header>
      <Card className="gap-5 rounded-2xl bg-background p-5 sm:p-7">
        <NewSiteForm />
        <div className="flex items-start gap-3 border-t border-border pt-4 text-sm leading-relaxed text-muted-foreground">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary-action" />
          <p>{t('Your signed-in wallet must hold this site on X Layer.')}</p>
        </div>
      </Card>
    </section>
  )
}
