'use client'

import { Lock } from 'lucide-react'
import { useState } from 'react'
import { CodeText } from '@/components/atoms/code-text'
import { TimeText } from '@/components/atoms/time-text'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Secret } from '@/lib/api/schemas'
import { ConfirmButton } from './confirm-button'

interface Props {
  secret: Secret
  busy?: boolean
  onReplace: (name: string, value: string) => void
  onRename: (name: string, to: string) => void
  onDelete: (name: string) => void
}

type Mode = 'idle' | 'replace' | 'rename'

/**
 * One saved secret. Its value is never shown, there is no way to reveal it, and replacing it takes a new value typed in
 * a password box that is emptied as soon as it is sent.
 */
export function SecretRow({ secret, busy, onReplace, onRename, onDelete }: Props) {
  const [mode, setMode] = useState<Mode>('idle')
  const [text, setText] = useState('')
  const close = () => { setMode('idle'); setText('') }
  return (
    <li className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2"><Lock className="size-4 text-muted-foreground" /><CodeText>{secret.name}</CodeText><span className="text-sm text-muted-foreground">Value hidden</span></div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">Updated <TimeText value={secret.updatedAt} /></div>
      </div>
      {mode === 'idle' ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setMode('replace')}>Replace value</Button>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => { setMode('rename'); setText(secret.name) }}>Rename</Button>
          <ConfirmButton
            trigger={<Button type="button" variant="outline" size="sm" disabled={busy}>Delete</Button>}
            title={`Delete ${secret.name}?`} description="The key is removed for good. Routes that use it must be changed first." confirmLabel="Delete secret"
            onConfirm={() => onDelete(secret.name)}
          />
        </div>
      ) : (
        <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (mode === 'replace') onReplace(secret.name, text); else onRename(secret.name, text.trim()); close() }}>
          <Input
            aria-label={mode === 'replace' ? 'New value' : 'New name'} type={mode === 'replace' ? 'password' : 'text'} autoComplete="off" value={text}
            onChange={(e) => setText(mode === 'rename' ? e.target.value.toUpperCase() : e.target.value)} className="max-w-sm font-mono" required
          />
          <Button type="submit" size="sm" disabled={busy || !text}>{mode === 'replace' ? 'Save new value' : 'Save new name'}</Button>
          <Button type="button" variant="ghost" size="sm" onClick={close}>Cancel</Button>
        </form>
      )}
    </li>
  )
}
