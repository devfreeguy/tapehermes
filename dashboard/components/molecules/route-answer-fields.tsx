'use client'
import { useTranslator } from '@/lib/locale-context'

import { KeyValueEditor } from '@/components/molecules/key-value-editor'
import type { FieldGroupProps } from './route-basic-fields'

/** Which parts of the service's JSON answer visitors get back. Left empty, the whole answer is returned. */
export function RouteAnswerFields({ form, set }: FieldGroupProps) {
  const t = useTranslator()
  return (
    <KeyValueEditor
      id="pick" label={t('Parts of the reply to keep')} hint={t('Leave this empty to return the whole reply. To return only one part, give it a name and enter where to find it, like data.price.')}
      rows={form.pick} onChange={(pick) => set({ pick })} keyLabel={t('Answer name')} valueLabel={t('Path')} keyPlaceholder="price" valuePlaceholder="data.price" addLabel={t('Add answer field')}
    />
  )
}
