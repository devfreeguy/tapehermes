import type { ReactNode } from 'react'
import { AppHeader } from '@/components/sections/app-header'
import { ScrollArea } from '@/components/ui/scroll-area'

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <ScrollArea label="Dashboard page" className="h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-4 sm:py-8 lg:has-[.auth-screen]:max-w-none lg:has-[.auth-screen]:p-0">{children}</main>
    </ScrollArea>
  )
}
