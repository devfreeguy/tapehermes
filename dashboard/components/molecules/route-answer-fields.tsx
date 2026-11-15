'use client'

import { KeyValueEditor } from '@/components/molecules/key-value-editor'
import type { FieldGroupProps } from './route-basic-fields'

/** Which parts of the service's JSON answer visitors get back. Left empty, the whole answer is returned. */
export function RouteAnswerFields({ form, set }: FieldGroupProps) {
  return (
    <KeyValueEditor
      id="pick" label="Answer fields" hint="Left box: the name in your answer. Right box: where to find it in the service's answer, with dots, for example data.price or output.0.text."
      rows={form.pick} onChange={(pick) => set({ pick })} keyLabel="Answer name" valueLabel="Path" keyPlaceholder="price" valuePlaceholder="data.price" addLabel="Add answer field"
    />
  )
}
