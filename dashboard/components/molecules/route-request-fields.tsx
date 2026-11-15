'use client'

import { FormField } from '@/components/molecules/form-field'
import { KeyValueEditor } from '@/components/molecules/key-value-editor'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ALLOWED_HEADERS } from '@/config/app'
import type { BodyMode } from '@/lib/routes/route-form'
import type { FieldGroupProps } from './route-basic-fields'

/** What the route sends to the outside service: what visitors may provide, the query, the body and the headers. */
export function RouteRequestFields({ form, set, errors }: FieldGroupProps) {
  return (
    <div className="space-y-5">
      <FormField id="route-inputs" label="What visitors may send" hint="Names separated by commas, for example from, to. Visitors send these as parameters.">
        <Input id="route-inputs" value={form.callerInputs} onChange={(e) => set({ callerInputs: e.target.value })} className="font-mono" autoComplete="off" />
      </FormField>
      <FormField id="route-required" label="Required" hint="Names that must be given, separated by commas.">
        <Input id="route-required" value={form.required} onChange={(e) => set({ required: e.target.value })} className="font-mono" autoComplete="off" />
      </FormField>
      <KeyValueEditor id="query" label="Query" hint="Adds ?name=value to the address. Left box: the name the service expects. Right box: the parameter it comes from." rows={form.query} onChange={(query) => set({ query })} keyLabel="Query name" valueLabel="From parameter" keyPlaceholder="symbol" valuePlaceholder="symbol" addLabel="Add query value" />
      <FormField id="route-body" label="Body" hint="Only used by POST, PUT and PATCH. It is always sent as JSON.">
        <Select value={form.bodyMode} onValueChange={(v) => set({ bodyMode: v as BodyMode })}>
          <SelectTrigger id="route-body" className="w-72"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No body</SelectItem>
            <SelectItem value="all">Send all parameters</SelectItem>
            <SelectItem value="map">Choose each field</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      {form.bodyMode === 'map' ? <KeyValueEditor id="body" label="Body fields" rows={form.bodyMap} onChange={(bodyMap) => set({ bodyMap })} keyLabel="Body field" valueLabel="From parameter" keyPlaceholder="input" valuePlaceholder="input" addLabel="Add body field" /> : null}
      <KeyValueEditor
        id="headers" label="Headers" hint={`Allowed names: ${ALLOWED_HEADERS.join(', ')}. To send a secret, write \${SECRET_NAME} in the value, for example Bearer \${WEATHER_KEY}.`}
        rows={form.headers} onChange={(headers) => set({ headers })} keyLabel="Header" valueLabel="Value" keyPlaceholder="authorization" valuePlaceholder="Bearer ${WEATHER_KEY}" addLabel="Add header"
      />
      <KeyValueEditor id="defaults" label="Defaults" hint="Values used when a visitor sends nothing. A visitor can still override a default. To stop that, use a locked setting below." rows={form.defaults} onChange={(defaults) => set({ defaults })} keyLabel="Parameter" valueLabel="Default" addLabel="Add default" />
      {errors.defaults ? <p role="alert" className="text-sm text-destructive">{errors.defaults}</p> : null}
    </div>
  )
}
