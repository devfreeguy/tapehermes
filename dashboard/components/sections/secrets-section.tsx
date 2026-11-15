'use client'

import { useState } from 'react'
import { PageTitle } from '@/components/atoms/page-title'
import { Spinner } from '@/components/atoms/spinner'
import { EmptyState } from '@/components/molecules/empty-state'
import { ErrorNotice } from '@/components/molecules/error-notice'
import { FormField } from '@/components/molecules/form-field'
import { SecretRow } from '@/components/molecules/secret-row'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SECRET_NAME_RE } from '@/config/app'
import { useSecretActions, useSecrets } from '@/hooks/use-secrets'

/** Secret keys for outside services. Add, replace, rename and delete. A value is never shown once saved. */
export function SecretsSection({ siteName }: { siteName: string }) {
  const secrets = useSecrets(siteName)
  const act = useSecretActions(siteName)
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const bad = name !== '' && !SECRET_NAME_RE.test(name)
  const busy = act.save.isPending || act.rename.isPending || act.remove.isPending
  const error = act.save.error ?? act.rename.error ?? act.remove.error ?? secrets.error
  return (
    <section className="space-y-6">
      <PageTitle title="Secrets" description="API keys for outside services. They are encrypted here, sent only in the headers you choose, and never shown again." />
      <Card>
        <CardHeader><CardTitle>Add a secret</CardTitle></CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act.save.mutate({ name, value }, { onSuccess: () => { setName(''); setValue('') } }) }}>
            <FormField id="secret-name" label="Name" hint="Capital letters, numbers and underscores, for example WEATHER_KEY. You use it in a header as ${WEATHER_KEY}." error={bad ? 'Use capital letters, numbers and underscores, starting with a letter.' : null}>
              <Input id="secret-name" value={name} onChange={(e) => setName(e.target.value.toUpperCase())} className="max-w-sm font-mono" autoComplete="off" />
            </FormField>
            <FormField id="secret-value" label="Value" hint="Paste the key. It is cleared from this page as soon as it is saved.">
              <Input id="secret-value" type="password" autoComplete="off" value={value} onChange={(e) => setValue(e.target.value)} className="max-w-xl font-mono" />
            </FormField>
            <Button type="submit" disabled={!name || bad || !value || busy}>{act.save.isPending ? <Spinner /> : null}Save secret</Button>
          </form>
        </CardContent>
      </Card>
      <ErrorNotice error={error} />
      {secrets.isPending ? <Spinner /> : null}
      {secrets.data?.length === 0 ? <EmptyState title="No secrets yet" description="You only need one if the outside service wants an API key." /> : null}
      <ul className="space-y-3">
        {secrets.data?.map((s) => (
          <SecretRow key={s.name} secret={s} busy={busy} onReplace={(n, v) => act.save.mutate({ name: n, value: v })} onRename={(n, to) => act.rename.mutate({ name: n, to })} onDelete={(n) => act.remove.mutate(n)} />
        ))}
      </ul>
    </section>
  )
}
