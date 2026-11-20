'use client'

import type { ReactElement, ReactNode } from 'react'
import { Dialog } from 'radix-ui'
import { ScrollArea } from '@/components/ui/scroll-area'

export function ActionDialog({
  title, description, trigger, open, onOpenChange, children,
}: {
  title: string
  description: string
  trigger: ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay/60" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-popover font-(family-name:--font-auth) text-popover-foreground shadow-xl">
          <ScrollArea label={title} viewportClassName="max-h-[calc(100dvh-2rem)]">
            <div className="space-y-5 p-5 sm:p-7">
              <header className="space-y-2">
                <Dialog.Title className="font-(family-name:--font-auth) text-xl font-bold">{title}</Dialog.Title>
                <Dialog.Description className="text-sm leading-relaxed text-muted-foreground">{description}</Dialog.Description>
              </header>
              {children}
            </div>
          </ScrollArea>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
