'use client'
import { useTranslator } from '@/lib/locale-context'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { AddressText } from '@/components/atoms/address-text'
import { BrandWordmark } from '@/components/atoms/brand-wordmark'
import { LanguageMenu } from '@/components/molecules/language-menu'
import { Button } from '@/components/ui/button'
import { ThemeSelect } from './theme-select'
import { NAV_ITEMS } from '@/config/nav'
import { useSession } from '@/lib/session/session-context'

/** The top bar: the name, the main links, and who is signed in. */
export function AppHeader() {
  const t = useTranslator()
  const { session, signOut } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  if (pathname === '/') return null

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2 sm:gap-6">
          <Link href="/" className="inline-flex shrink-0 rounded-lg"><BrandWordmark compact /></Link>
          <nav aria-label={t('Main')} className="flex items-center gap-1 text-sm sm:gap-4">
            {NAV_ITEMS.map((n) => (
              <Button key={n.href} asChild variant="ghost" className="pill-control max-sm:px-4!">
                <Link href={n.href} aria-current={pathname === n.href ? 'page' : undefined} className="aria-[current=page]:bg-primary-action/12 aria-[current=page]:text-primary-action">
                  {t(n.label)}
                </Link>
              </Button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <ThemeSelect />
          <LanguageMenu />
          {session ? (
            <><AddressText value={session.wallet} /><Button type="button" variant="ghost" size="sm" onClick={() => { signOut(); router.push('/') }}>{t('Sign out')}</Button></>
          ) : null}
        </div>
      </div>
    </header>
  )
}
