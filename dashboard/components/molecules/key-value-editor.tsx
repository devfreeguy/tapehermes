'use client'

import { useTranslator } from '@/lib/locale-context'
import { Plus, X } from 'lucide-react'
import { HintText } from '@/components/atoms/hint-text'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface Pair { key: string; value: string }

interface Props {
  id: string
  label: string
  hint?: string
  rows: Pair[]
  onChange: (rows: Pair[]) => void
  keyLabel: string
  valueLabel: string
  keyPlaceholder?: string
  valuePlaceholder?: string
  addLabel?: string
}

/** Editable list of key and value pairs (query, body, headers, defaults, locked values, and so on). */
export function KeyValueEditor({ id, label, hint, rows, onChange, keyLabel, valueLabel, keyPlaceholder, valuePlaceholder, addLabel }: Props) {
  const t = useTranslator()
  const set = (i: number, patch: Partial<Pair>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  return (
    <fieldset className="min-w-0 space-y-3" data-testid={`kv-${id}`}>
      <Label asChild><legend>{label}</legend></Label>
      {hint ? <HintText>{hint}</HintText> : null}
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2">
          <Input aria-label={`${keyLabel} ${i + 1}`} value={r.key} placeholder={keyPlaceholder} onChange={(e) => set(i, { key: e.target.value })} className="font-mono" />
          <Input aria-label={`${valueLabel} ${i + 1}`} value={r.value} placeholder={valuePlaceholder} onChange={(e) => set(i, { value: e.target.value })} className="font-mono" />
          <Button type="button" variant="ghost" size="icon" className="size-11 rounded-full" aria-label={t('Remove {0} {1}', keyLabel, i + 1)} onClick={() => onChange(rows.filter((_, j) => j !== i))}><X className="size-4" /></Button>
        </div>
      ))}
      <Button type="button" variant="outline" className="pill-control" onClick={() => onChange([...rows, { key: '', value: '' }])}><Plus className="size-4" />{addLabel ?? t('Add')}</Button>
    </fieldset>
  )
}
