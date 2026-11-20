'use client'
import { useTranslator } from '@/lib/locale-context'

import { FormField } from '@/components/molecules/form-field'
import { KeyValueEditor } from '@/components/molecules/key-value-editor'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ALLOWED_HEADERS } from '@/config/app'
import type { BodyMode } from '@/lib/routes/route-form'
import type { FieldGroupProps } from './route-basic-fields'

/** What the route sends to the outside service: what visitors may provide, the query, the body and the headers. */
export function RouteRequestFields({ form, set, errors }: FieldGroupProps) {
  const t = useTranslator()
  return (
    <div className="space-y-5">
      <FormField id="route-inputs" label={t('Inputs visitors can send')} hint={t('List the input names, separated by commas. For a document summary, you might use documentText, language.')}>
        <Input id="route-inputs" value={form.callerInputs} onChange={(e) => set({ callerInputs: e.target.value })} className="font-mono" autoComplete="off" />
      </FormField>
      <FormField id="route-required" label={t('Required')} hint={t('List the inputs every request must include, separated by commas.')}>
        <Input id="route-required" value={form.required} onChange={(e) => set({ required: e.target.value })} className="font-mono" autoComplete="off" />
      </FormField>
      <KeyValueEditor id="query" label={t('URL options (query)')} hint={t('Adds options to the service URL, like ?language=en. Enter the name the service expects and the input to use for it.')} rows={form.query} onChange={(query) => set({ query })} keyLabel={t('Query name')} valueLabel={t('From parameter')} keyPlaceholder="language" valuePlaceholder="language" addLabel={t('Add query value')} />
      <FormField id="route-body" label={t('Data sent with the request (body)')} hint={t('For POST, PUT and PATCH requests, choose which data to send as JSON.')}>
        <Select value={form.bodyMode} onValueChange={(v) => set({ bodyMode: v as BodyMode })}>
          <SelectTrigger id="route-body" className="w-72"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t('No body')}</SelectItem>
            <SelectItem value="all">{t('Send all parameters')}</SelectItem>
            <SelectItem value="map">{t('Choose each field')}</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      {form.bodyMode === 'map' ? <KeyValueEditor id="body" label={t('Body fields')} rows={form.bodyMap} onChange={(bodyMap) => set({ bodyMap })} keyLabel={t('Body field')} valueLabel={t('From parameter')} keyPlaceholder="input" valuePlaceholder="input" addLabel={t('Add body field')} /> : null}
      <KeyValueEditor
        id="headers" label={t('Headers')} hint={t('Allowed names: {0}. To send a saved API key, write ${SECRET_NAME} in the value, for example Bearer ${AI_PROVIDER_KEY}.', ALLOWED_HEADERS.join(', '))}
        rows={form.headers} onChange={(headers) => set({ headers })} keyLabel={t('Header')} valueLabel={t('Value')} keyPlaceholder="authorization" valuePlaceholder="Bearer ${AI_PROVIDER_KEY}" addLabel={t('Add header')}
      />
      <KeyValueEditor id="defaults" label={t('Defaults')} hint={t('Values used when a visitor sends nothing. A visitor can still override a default. To stop that, use a locked setting below.')} rows={form.defaults} onChange={(defaults) => set({ defaults })} keyLabel={t('Parameter')} valueLabel={t('Default')} addLabel={t('Add default')} />
      {errors.defaults ? <p role="alert" className="text-sm text-destructive">{t(errors.defaults)}</p> : null}
    </div>
  )
}
