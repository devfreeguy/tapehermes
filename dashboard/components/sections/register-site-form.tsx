'use client'

import { useState } from 'react'
import { Spinner } from '@/components/atoms/spinner'
import { ErrorNotice } from '@/components/molecules/error-notice'
import { FormField } from '@/components/molecules/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SITE_NAME_RE } from '@/config/app'
import { useRegisterSite } from '@/hooks/use-sites'

/** Add a site by its on-chain name. The server checks that the signed-in wallet is its current holder. */
export function RegisterSiteForm({ onDone }: { onDone?: (name: string, takeover: boolean) => void }) {
  const [name, setName] = useState('')
  const register = useRegisterSite()
  const bad = name !== '' && !SITE_NAME_RE.test(name.trim())
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        register.mutate(name.trim(), { onSuccess: (r) => { setName(''); onDone?.(r.site.name, r.takeover) } })
      }}
    >
      <FormField id="site-name" label="Site name" hint="For example 1.2.396.tape. Your signed-in wallet must be the wallet that holds this site on X Layer." error={bad ? 'A site name looks like 1.2.396.tape: three numbers and .tape.' : null}>
        <Input id="site-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="1.2.396.tape" className="max-w-sm font-mono" autoComplete="off" />
      </FormField>
      <Button type="submit" disabled={!name || bad || register.isPending}>{register.isPending ? <Spinner /> : null}Add site</Button>
      <ErrorNotice error={register.error} />
    </form>
  )
}
