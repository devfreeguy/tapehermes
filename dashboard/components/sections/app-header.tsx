'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AddressText } from '@/components/atoms/address-text'
import { Button } from '@/components/ui/button'
import { NAV_ITEMS } from '@/config/nav'
import { useSession } from '@/lib/session/session-context'

/** The top bar: the name, the main links, and who is signed in. */
export function AppHeader() {
  const { session, signOut } = useSession()
  const router = useRouter()
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-mono text-lg font-semibold tracking-tight">tape<span className="text-signal">hermes</span></Link>
          <nav aria-label="Main" className="flex items-center gap-4 text-sm">
            {NAV_ITEMS.map((n) => <Link key={n.href} href={n.href} className="text-muted-foreground hover:text-foreground">{n.label}</Link>)}
          </nav>
        </div>
        {session ? (
          <div className="flex items-center gap-3 text-sm"><AddressText value={session.wallet} /><Button type="button" variant="ghost" size="sm" onClick={() => { signOut(); router.push('/') }}>Sign out</Button></div>
        ) : null}
      </div>
    </header>
  )
}
