'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { ScrollArea as ScrollAreaPrimitive } from 'radix-ui'

const ScrollNonce = createContext<string | undefined>(undefined)

export function ScrollAreaNonceProvider({ nonce, children }: { nonce?: string; children: ReactNode }) {
  return <ScrollNonce.Provider value={nonce}>{children}</ScrollNonce.Provider>
}

/** shadcn Scroll Area using the dashboard's Radix primitives and border token. */
export function ScrollArea({
  children, className, viewportClassName, orientation = 'vertical', label,
}: {
  children: ReactNode
  className?: string
  viewportClassName?: string
  orientation?: 'vertical' | 'horizontal' | 'both'
  label: string
}) {
  const nonce = useContext(ScrollNonce)
  const scrollX = orientation !== 'vertical'
  const scrollY = orientation !== 'horizontal'
  return (
    <ScrollAreaPrimitive.Root type="auto" className={`relative min-w-0 overflow-hidden ${className ?? ''}`}>
      <ScrollAreaPrimitive.Viewport
        nonce={nonce}
        disableImplicitContentElement
        role="region"
        aria-label={label}
        tabIndex={0}
        className={`size-full min-h-0 min-w-0 rounded-[inherit] focus-visible:outline-2 focus-visible:outline-offset-[-2px] ${scrollX ? 'overflow-x-auto!' : 'overflow-x-hidden!'} ${scrollY ? 'overflow-y-auto!' : 'overflow-y-hidden!'} ${viewportClassName ?? ''}`}
      >
        <ScrollAreaPrimitive.Content className={scrollX ? 'table min-w-full' : 'block! min-w-full'}>
          {children}
        </ScrollAreaPrimitive.Content>
      </ScrollAreaPrimitive.Viewport>
      {scrollY && <ScrollBar orientation="vertical" />}
      {scrollX && <ScrollBar orientation="horizontal" />}
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({ orientation }: { orientation: 'vertical' | 'horizontal' }) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      orientation={orientation}
      className="z-10 flex touch-none rounded-full bg-muted/80 p-0.5 select-none data-[orientation=horizontal]:h-2.5 data-[orientation=horizontal]:flex-col data-[orientation=vertical]:w-2.5"
    >
      <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-muted-foreground/70" />
    </ScrollAreaPrimitive.Scrollbar>
  )
}
