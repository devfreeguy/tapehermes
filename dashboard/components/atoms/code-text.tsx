import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** A short technical value inline (a route name, a header, a placeholder). */
export function CodeText({ children, className }: { children: ReactNode; className?: string }) {
  return <code className={cn('rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs', className)}>{children}</code>
}
