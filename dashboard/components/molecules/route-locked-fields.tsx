'use client'

import { KeyValueEditor } from '@/components/molecules/key-value-editor'
import type { FieldGroupProps } from './route-basic-fields'

/** Values the owner fixes, and limits on what visitors type. A locked value is always sent and a visitor cannot change it. */
export function RouteLockedFields({ form, set, errors }: FieldGroupProps) {
  return (
    <div className="space-y-5">
      <KeyValueEditor
        id="locked" label="Locked settings"
        hint="Fixed by you and always sent: a model name, instructions, a limit. A visitor who tries to set one is refused before anything is called, and is not charged. Numbers and true/false are sent as such; put quotes around a value to send it as text."
        rows={form.locked} onChange={(locked) => set({ locked })} keyLabel="Parameter" valueLabel="Fixed value" keyPlaceholder="max_output_tokens" valuePlaceholder="60" addLabel="Add locked setting"
      />
      <KeyValueEditor
        id="limits" label="Limits on visitor input" hint="The longest text a visitor may send for a parameter, in characters (1 to 4096)."
        rows={form.limits} onChange={(limits) => set({ limits })} keyLabel="Parameter" valueLabel="Longest" keyPlaceholder="input" valuePlaceholder="200" addLabel="Add limit"
      />
      {errors.limits ? <p role="alert" className="text-sm text-destructive">{errors.limits}</p> : null}
    </div>
  )
}
