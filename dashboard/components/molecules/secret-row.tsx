'use client'

import { useTranslator } from '@/lib/locale-context'
import { KeyRound, LockKeyhole, Pencil, RotateCw, Trash2 } from 'lucide-react'
import { TimeText } from '@/components/atoms/time-text'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { Secret } from '@/lib/api/schemas'
import { ConfirmButton } from './confirm-button'
import { SecretFormDialog } from './secret-form-dialog'

type EditAction<T> = {
  mutate: (input: T, options: { onSuccess: () => void }) => void
  reset: () => void
  isPending: boolean
  error: unknown
}

export function SecretRow({ secret, busy, actions }: {
  secret: Secret
  busy: boolean
  actions: {
    save: EditAction<{ name: string; value: string }>
    rename: EditAction<{ name: string; to: string }>
    remove: { mutate: (name: string) => void }
  }
}) {
  const t = useTranslator()
  const { save, rename, remove } = actions
  return (
    <li className="min-w-0">
      <Card className="h-full gap-5 rounded-2xl bg-background p-5 shadow-none sm:p-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <KeyRound aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0 space-y-1">
            <h2 className="font-mono text-sm font-semibold break-all text-foreground sm:text-base">{secret.name}</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">{t('Updated') + ' '}<TimeText value={secret.updatedAt} /></p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-accent/7 px-3 py-3 text-sm text-muted-foreground">
          <LockKeyhole aria-hidden="true" className="size-4 shrink-0 text-accent" />
          <span>{t('Value hidden')}</span>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-1 border-t border-border pt-3">
          <SecretFormDialog
            mode="replace" secretName={secret.name}
            busy={busy} pending={save.isPending} error={save.error} reset={save.reset}
            trigger={<Button type="button" variant="ghost" disabled={busy} className="h-11 rounded-full px-3 has-[>svg]:px-3"><RotateCw aria-hidden="true" />{t('Replace value')}</Button>}
            onSave={(draft, onSuccess) => save.mutate(draft, { onSuccess })}
          />
          <SecretFormDialog
            mode="rename" secretName={secret.name}
            busy={busy} pending={rename.isPending} error={rename.error} reset={rename.reset}
            trigger={<Button type="button" variant="ghost" disabled={busy} className="h-11 rounded-full px-3 has-[>svg]:px-3"><Pencil aria-hidden="true" />{t('Rename')}</Button>}
            onSave={(draft, onSuccess) => rename.mutate({ name: secret.name, to: draft.name }, { onSuccess })}
          />
          <ConfirmButton
            destructive
            trigger={<Button type="button" variant="ghost" size="icon" disabled={busy} aria-label={t('Delete')} className="ml-auto size-11 rounded-full text-muted-foreground hover:text-destructive"><Trash2 aria-hidden="true" /></Button>}
            title={t('Delete {0}?', secret.name)} description={t('The key is removed for good. Routes that use it must be changed first.')} confirmLabel={t('Delete secret')}
            onConfirm={() => remove.mutate(secret.name)}
          />
        </div>
      </Card>
    </li>
  )
}
