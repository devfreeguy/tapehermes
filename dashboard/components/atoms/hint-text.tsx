import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Small muted help text under a field or a title. */
export function HintText({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-sm text-muted-foreground', className)}>{children}</p>
}
