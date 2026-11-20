'use client'
import { useTranslator } from '@/lib/locale-context'

import { SITE_TERMS } from '@/copy/site-terms'
import { Plus } from 'lucide-react'
import { Spinner } from '@/components/atoms/spinner'
import { EmptyState } from '@/components/molecules/empty-state'
import { ErrorNotice } from '@/components/molecules/error-notice'
import { SecretFormDialog } from '@/components/molecules/secret-form-dialog'
import { SecretRow } from '@/components/molecules/secret-row'
import { Button } from '@/components/ui/button'
import { useSecretActions, useSecrets } from '@/hooks/use-secrets'

import { useSelectedSiteName } from '@/components/molecules/site-selection-provider'

export function SecretsSection({ siteName: explicitSite }: { siteName?: string }) {
  const t = useTranslator()
  const siteName = useSelectedSiteName(explicitSite)
  const secrets = useSecrets(siteName)
  const actions = useSecretActions(siteName)
  const { save, rename, remove } = actions
  const busy = save.isPending || rename.isPending || remove.isPending

  return (
    <section aria-labelledby="secrets-title" className="space-y-7 lg:space-y-9">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 id="secrets-title" className="font-(family-name:--font-auth) text-3xl font-extrabold tracking-tight sm:text-4xl">{t(SITE_TERMS.secrets.label)}</h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            {t(SITE_TERMS.secrets.description)}
          </p>
        </div>
        <SecretFormDialog
          mode="add" busy={busy} pending={save.isPending} error={save.error} reset={save.reset}
          trigger={<Button type="button" className="pill-control" disabled={busy}><Plus aria-hidden="true" />{t('Add API key')}</Button>}
          onSave={(draft, onSuccess) => save.mutate(draft, { onSuccess })}
        />
      </header>

      <ErrorNotice error={remove.error ?? secrets.error} />
      {secrets.isPending && <Spinner label={t('Loading secrets')} />}
      {secrets.data?.length === 0 && <EmptyState title={t('No keys yet')} description={t('Add a key when an action needs one to use an outside service.')} />}
      {!!secrets.data?.length && (
        <ul aria-label={t('Saved secrets')} className="grid gap-4 xl:grid-cols-2">
          {secrets.data.map((secret) => <SecretRow key={secret.name} secret={secret} busy={busy} actions={actions} />)}
        </ul>
      )}
    </section>
  )
}
