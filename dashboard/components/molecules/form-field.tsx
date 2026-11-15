import type { ReactNode } from 'react'
import { HintText } from '@/components/atoms/hint-text'
import { Label } from '@/components/ui/label'

/** A label, the control, a hint and an error message, wired together. `children` is the control and should use the same `id`. */
export function FormField({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <HintText>{hint}</HintText> : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
