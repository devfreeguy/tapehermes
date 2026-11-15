'use client'

import { FormField } from '@/components/molecules/form-field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { HTTP_METHODS } from '@/config/app'
import type { RouteForm } from '@/lib/routes/route-form'

export interface FieldGroupProps { form: RouteForm; set: (patch: Partial<RouteForm>) => void; errors: Record<string, string>; locked?: boolean }

/** Name, address, method, price, rate limit and on/off: the part of a route every route has. */
export function RouteBasicFields({ form, set, errors, locked }: FieldGroupProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField id="route-name" label="Route name" hint="What visitors call, for example fxRate." error={errors.name}>
        <Input id="route-name" value={form.name} disabled={locked} onChange={(e) => set({ name: e.target.value })} className="font-mono" autoComplete="off" />
      </FormField>
      <FormField id="route-method" label="Method">
        <Select value={form.method} onValueChange={(v) => set({ method: v as RouteForm['method'] })}>
          <SelectTrigger id="route-method" className="w-32 font-mono"><SelectValue /></SelectTrigger>
          <SelectContent>{HTTP_METHODS.map((m) => <SelectItem key={m} value={m} className="font-mono">{m}</SelectItem>)}</SelectContent>
        </Select>
      </FormField>
      <div className="sm:col-span-2">
        <FormField id="route-url" label="Address of the outside service" hint="Must start with https://. Put placeholders in curly braces, for example https://api.example.com/v1/items/{id}." error={errors.url}>
          <Input id="route-url" value={form.url} onChange={(e) => set({ url: e.target.value })} className="font-mono" autoComplete="off" />
        </FormField>
      </div>
      <FormField id="route-price" label="Price per call (USD)" hint="0 makes the route free." error={errors.priceUsd}>
        <Input id="route-price" inputMode="decimal" value={form.priceUsd} onChange={(e) => set({ priceUsd: e.target.value })} className="w-40 font-mono" />
      </FormField>
      <FormField id="route-rate" label="Calls per minute, per visitor" hint="More than this gets a 'too many requests' answer." error={errors.rateLimitPerMin}>
        <Input id="route-rate" inputMode="numeric" value={form.rateLimitPerMin} onChange={(e) => set({ rateLimitPerMin: e.target.value })} className="w-40 font-mono" />
      </FormField>
      <FormField id="route-timeout" label="Wait for the service (milliseconds)" hint="Optional. Between 100 and 15000." error={errors.timeoutMs}>
        <Input id="route-timeout" inputMode="numeric" value={form.timeoutMs} onChange={(e) => set({ timeoutMs: e.target.value })} className="w-40 font-mono" />
      </FormField>
      <label className="flex items-center gap-2 text-sm"><Switch checked={form.enabled} onCheckedChange={(v) => set({ enabled: v })} aria-label="Route on" />Route is on</label>
    </div>
  )
}
