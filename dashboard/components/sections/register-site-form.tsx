'use client'

import { useTranslator } from '@/lib/locale-context'
import { useState } from 'react'
import { Spinner } from '@/components/atoms/spinner'
import { ErrorNotice } from '@/components/molecules/error-notice'
import { FormField } from '@/components/molecules/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SITE_NAME_RE } from '@/config/app'
import { useRegisterSite } from '@/hooks/use-sites'

/** Add a site by its on-chain name. The server checks that the signed-in wallet is its current holder. */
export function RegisterSiteForm({ onDone, presentation }: { onDone?: (name: string, takeover: boolean) => void; presentation?: 'viewer' }) {
  const t = useTranslator()
  const [name, setName] = useState('')
  const register = useRegisterSite()
  const bad = name !== '' && !SITE_NAME_RE.test(name.trim())
  const inViewer = presentation === 'viewer'
  return (
    <form
      className={inViewer ? 'space-y-5' : 'space-y-3'}
      onSubmit={(e) => {
        e.preventDefault()
        register.mutate(name.trim(), { onSuccess: (r) => { setName(''); onDone?.(r.site.name, r.takeover) } })
      }}
    >
      <FormField id="site-name" label={t('Site name')} hint={inViewer ? t('Enter the full name, including .tape.') : t('For example 1.2.396.tape. Your signed-in wallet must be the wallet that holds this site on X Layer.')} error={bad ? t('A site name looks like 1.2.396.tape: three numbers and .tape.') : null}>
        <Input id="site-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="1.2.396.tape" className={inViewer ? 'h-13 rounded-xl px-4 font-mono' : 'max-w-sm font-mono'} aria-invalid={bad || undefined} autoCapitalize="none" autoComplete="off" />
      </FormField>
      <Button type="submit" className={inViewer ? 'pill-control w-full' : undefined} disabled={!name || bad || register.isPending}>{register.isPending ? <Spinner /> : null}{t('Add site')}</Button>
      <ErrorNotice error={register.error} />
    </form>
  )
}
