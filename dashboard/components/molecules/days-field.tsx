'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DELEGATION_DAYS } from '@/config/app'
import { FormField } from './form-field'

const PRESETS = [7, 30, 90, 366]

/** How long a delegation lasts: 1 to 366 days, with four quick choices. The value is kept as text so typing is never blocked. */
export function DaysField({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const n = Number(value)
  const bad = !Number.isInteger(n) || n < DELEGATION_DAYS.min || n > DELEGATION_DAYS.max
  return (
    <FormField id={id} label="How long should it last (days)" hint="Shorter is safer. You can sign again at any time to renew. The longest allowed is 366 days." error={bad ? 'Enter a whole number from 1 to 366.' : null}>
      <div className="flex flex-wrap items-center gap-2">
        <Input id={id} type="number" inputMode="numeric" min={DELEGATION_DAYS.min} max={DELEGATION_DAYS.max} value={value} onChange={(e) => onChange(e.target.value)} className="w-28 font-mono" />
        {PRESETS.map((p) => <Button key={p} type="button" size="sm" variant={Number(value) === p ? 'default' : 'outline'} onClick={() => onChange(String(p))}>{p}</Button>)}
      </div>
    </FormField>
  )
}

/** The days as a number when valid, otherwise null. */
export const daysOrNull = (value: string): number | null => {
  const n = Number(value)
  return Number.isInteger(n) && n >= DELEGATION_DAYS.min && n <= DELEGATION_DAYS.max ? n : null
}
