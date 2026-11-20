'use client'

import { KeyValueEditor } from '@/components/molecules/key-value-editor'
import type { FieldGroupProps } from './route-basic-fields'

/** Values the owner fixes, and limits on what visitors type. A locked value is always sent and a visitor cannot change it. */
export function RouteLockedFields({ form, set, errors }: FieldGroupProps) {
  return (
    <div className="space-y-5">
      <KeyValueEditor
        id="locked" label="Values visitors cannot change"
        hint="Set values your action always sends, like an AI model name. If a visitor tries to change one, their request stops before it is sent or charged. Use quotes to send a number as text."
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
