'use client'

import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

/** Copies a value to the clipboard and says so for two seconds. A blocked clipboard is ignored. */
export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [done, setDone] = useState(false)
  async function copy() {
    try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 2000) } catch { /* clipboard blocked */ }
  }
  return (
    <Button type="button" variant="ghost" size="icon" aria-label={done ? 'Copied' : label} title={done ? 'Copied' : label} onClick={copy}>
      {done ? <Check className="size-4 text-primary-action dark:text-success" /> : <Copy className="size-4" />}
    </Button>
  )
}
