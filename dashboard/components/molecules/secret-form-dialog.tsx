'use client'

import { useId, useState, type ReactElement } from 'react'
import { Dialog } from 'radix-ui'
import { Spinner } from '@/components/atoms/spinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SECRET_NAME_RE } from '@/config/app'
import { ActionDialog } from './action-dialog'
import { ErrorNotice } from './error-notice'
import { FormField } from './form-field'

type Draft = { name: string; value: string }
type Operation = { mode: 'add' } | { mode: 'rename' | 'replace'; secretName: string }

type Props = Operation & {
  trigger: ReactElement
  busy: boolean
  pending: boolean
  error: unknown
  reset: () => void
  onSave: (draft: Draft, onSuccess: () => void) => void
}

export function SecretFormDialog(props: Props) {
  const { mode, trigger, busy, pending, error, reset, onSave } = props
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const nameId = useId()
  const valueId = useId()
  const originalName = mode === 'add' ? '' : props.secretName
  const showName = mode !== 'replace'
  const showValue = mode !== 'rename'
  const submittedName = mode === 'rename' ? name.trim() : name
  const badName = showName && name !== '' && !SECRET_NAME_RE.test(submittedName)
  const canSave = !busy && (!showName || (submittedName !== '' && !badName)) && (!showValue || value !== '')
  const title = mode === 'add' ? 'Add a secret' : mode === 'rename' ? 'Rename secret' : 'Replace secret value'
  const description = mode === 'add'
    ? 'Store an API key for an outside service. You can reference it from a route header.'
    : mode === 'rename' ? `Choose a new name for ${originalName}.` : `Enter the replacement key for ${originalName}.`
  const saveLabel = mode === 'add' ? 'Save secret' : mode === 'rename' ? 'Save new name' : 'Save new value'

  function changeOpen(next: boolean) {
    if (pending) return
    setOpen(next)
    setName(next ? originalName : '')
    setValue('')
    if (next) reset()
  }

  return (
    <ActionDialog title={title} description={description} trigger={trigger} open={open} onOpenChange={changeOpen}>
      <form className="space-y-5" onSubmit={(event) => {
        event.preventDefault()
        if (!canSave) return
        onSave({ name: showName ? submittedName : originalName, value }, () => {
          setName('')
          setValue('')
          setOpen(false)
        })
      }}>
        {showName && (
          <FormField id={nameId} label={mode === 'rename' ? 'New name' : 'Name'} hint={'Use capitals, numbers and underscores. Reference WEATHER_KEY in a header as ${WEATHER_KEY}.'} error={badName ? 'Use capital letters, numbers and underscores, starting with a letter.' : null}>
            <Input id={nameId} value={name} aria-invalid={badName || undefined} onChange={(event) => setName(event.target.value.toUpperCase())} className="h-13 rounded-xl px-4 font-mono" autoComplete="off" spellCheck={false} />
          </FormField>
        )}
        {showValue && (
          <FormField id={valueId} label={mode === 'replace' ? 'New value' : 'Value'} hint="The key is hidden and cleared from this form after saving.">
            <Input id={valueId} type="password" autoComplete="off" value={value} onChange={(event) => setValue(event.target.value)} className="h-13 rounded-xl px-4 font-mono" />
          </FormField>
        )}
        <ErrorNotice error={error} />
        <div className="auth-actions">
          <Dialog.Close asChild><Button type="button" variant="outline" className="pill-control" disabled={pending}>Cancel</Button></Dialog.Close>
          <Button type="submit" className="pill-control" disabled={!canSave}>{pending && <Spinner />}{saveLabel}</Button>
        </div>
      </form>
    </ActionDialog>
  )
}
