import { useTranslator } from '@/lib/locale-context'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Spinner({ className, label }: { className?: string; label?: string }) {
  const t = useTranslator()
  return <Loader2 role="status" aria-label={label ?? t('Loading')} className={cn('size-4 animate-spin', className)} />
}
