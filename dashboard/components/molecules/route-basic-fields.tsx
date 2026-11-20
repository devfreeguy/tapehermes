'use client'
import { useTranslator } from '@/lib/locale-context'

import { FormField } from '@/components/molecules/form-field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { HTTP_METHODS } from '@/config/app'
import type { RouteForm } from '@/lib/routes/route-form'

export interface FieldGroupProps { form: RouteForm; set: (patch: Partial<RouteForm>) => void; errors: Record<string, string>; locked?: boolean }

/** Name, address, method, price, rate limit and on/off: the part of a route every route has. */
export function RouteBasicFields({ form, set, errors, locked }: FieldGroupProps) {
  const t = useTranslator()
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField id="route-name" label={t('Action name')} hint={t('The name apps use to ask for this action, for example summarizeDocument.')} error={errors.name}>
        <Input id="route-name" value={form.name} disabled={locked} onChange={(e) => set({ name: e.target.value })} className="font-mono" autoComplete="off" />
      </FormField>
      <FormField id="route-method" label={t('HTTP method')} hint={t('For example, GET asks for data and POST sends data.')}>
        <Select value={form.method} onValueChange={(v) => set({ method: v as RouteForm['method'] })}>
          <SelectTrigger id="route-method" className="w-32 font-mono"><SelectValue /></SelectTrigger>
          <SelectContent>{HTTP_METHODS.map((m) => <SelectItem key={m} value={m} className="font-mono">{m}</SelectItem>)}</SelectContent>
        </Select>
      </FormField>
      <div className="sm:col-span-2">
        <FormField id="route-url" label={t('Address of the outside service')} hint={t('Use an HTTPS address, like https://api.example.com/v1/summaries. Put values that change in curly braces, like {documentId}.')} error={errors.url}>
          <Input id="route-url" value={form.url} onChange={(e) => set({ url: e.target.value })} className="font-mono" autoComplete="off" />
        </FormField>
      </div>
      <FormField id="route-price" label={t('Price per call (USD)')} hint={t('0 makes the action free.')} error={errors.priceUsd}>
        <Input id="route-price" inputMode="decimal" value={form.priceUsd} onChange={(e) => set({ priceUsd: e.target.value })} className="w-40 font-mono" />
      </FormField>
      <FormField id="route-rate" label={t('Requests per minute, per visitor')} hint={t('Requests above this limit are turned away.')} error={errors.rateLimitPerMin}>
        <Input id="route-rate" inputMode="numeric" value={form.rateLimitPerMin} onChange={(e) => set({ rateLimitPerMin: e.target.value })} className="w-40 font-mono" />
      </FormField>
      <FormField id="route-timeout" label={t('Wait for the service (milliseconds)')} hint={t('Optional. Between 100 and 15000.')} error={errors.timeoutMs}>
        <Input id="route-timeout" inputMode="numeric" value={form.timeoutMs} onChange={(e) => set({ timeoutMs: e.target.value })} className="w-40 font-mono" />
      </FormField>
      <label className="flex items-center gap-2 text-sm"><Switch checked={form.enabled} onCheckedChange={(v) => set({ enabled: v })} aria-label={t('Action on')} />{t('Action is on')}</label>
    </div>
  )
}
