'use client'

import type { ComponentProps } from 'react'
import { Check } from 'lucide-react'
import { DropdownMenu as Menu } from 'radix-ui'
import { cn } from '@/lib/utils'

const DropdownMenu = Menu.Root
const DropdownMenuTrigger = Menu.Trigger
const DropdownMenuRadioGroup = Menu.RadioGroup
const itemClass = 'relative flex min-h-11 cursor-default items-center gap-2 rounded-md px-3 py-2 text-sm font-medium outline-none select-none focus:bg-surface-hover data-disabled:pointer-events-none data-disabled:opacity-50'

function DropdownMenuContent({ className, sideOffset = 8, ...props }: ComponentProps<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content sideOffset={sideOffset} className={cn('z-50 min-w-52 rounded-xl border border-border bg-popover p-1.5 font-(family-name:--font-auth) text-popover-foreground shadow-lg', className)} {...props} />
    </Menu.Portal>
  )
}

function DropdownMenuItem({ className, ...props }: ComponentProps<typeof Menu.Item>) {
  return <Menu.Item className={cn(itemClass, className)} {...props} />
}

function DropdownMenuRadioItem({ children, ...props }: ComponentProps<typeof Menu.RadioItem>) {
  return (
    <Menu.RadioItem className={cn(itemClass, 'pr-9')} {...props}>
      <span className="absolute right-3">
        <Menu.ItemIndicator><Check aria-hidden="true" className="size-4 text-primary-action" /></Menu.ItemIndicator>
      </span>
      {children}
    </Menu.RadioItem>
  )
}

function DropdownMenuLabel(props: ComponentProps<typeof Menu.Label>) {
  return <Menu.Label className="px-3 py-2 text-xs font-semibold text-muted-foreground" {...props} />
}

function DropdownMenuSeparator() {
  return <Menu.Separator className="my-1 border-t border-border" />
}

export {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
}
