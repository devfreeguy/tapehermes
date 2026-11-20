'use client'
import { useTranslator } from '@/lib/locale-context'

import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

/** Copies a value to the clipboard and says so for two seconds. A blocked clipboard is ignored. */
export function CopyButton({ value, label }: { value: string; label?: string }) {
  const t = useTranslator()
  const [done, setDone] = useState(false)
  async function copy() {
    try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 2000) } catch { /* clipboard blocked */ }
  }
  const action = done ? t('Copied') : label ?? t('Copy')
  return (
    <Button type="button" variant="ghost" size="icon" aria-label={action} title={action} onClick={copy}>
      {done ? <Check className="size-4 text-primary-action dark:text-success" /> : <Copy className="size-4" />}
    </Button>
  )
}
