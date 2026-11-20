'use client'

import { useLanguagePreference, useTranslator } from '@/lib/locale-context'
import { BookOpen, ChevronDown, LogOut, Wallet } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AddressText } from '@/components/atoms/address-text'
import { LanguageOptions } from '@/components/molecules/language-menu'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useWallet } from '@/hooks/use-wallet'
import { useSession } from '@/lib/session/session-context'
import { themes } from '@/lib/theme'
import { themeLabels, useThemePreference } from './theme-select'

export function DashboardAccountMenu() {
  const t = useTranslator()
  const { session, signOut } = useSession()
  const { isConnected, disconnect } = useWallet()
  const router = useRouter()
  const { theme, changeTheme } = useThemePreference()
  const { locale, changeLocale } = useLanguagePreference()
  if (!session) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" aria-label={t('Account')} className="pill-control px-3! sm:px-5!">
          <Wallet aria-hidden="true" className="size-4 text-primary-action" />
          <span className="hidden sm:inline">{t('Account')}</span>
          <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <ScrollArea label={t('Account options')} viewportClassName="max-h-[calc(var(--radix-dropdown-menu-content-available-height)-1rem)]">
          <DropdownMenuLabel>{t('Signed-in wallet')}</DropdownMenuLabel>
          <div className="px-3 pb-2"><AddressText value={session.wallet} /></div>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t('Appearance')}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme} onValueChange={changeTheme}>
            {themes.map((value) => <DropdownMenuRadioItem value={value} key={value}>{t(themeLabels[value])}</DropdownMenuRadioItem>)}
          </DropdownMenuRadioGroup>
          <div className="lg:hidden">
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t('Language')}</DropdownMenuLabel>
            <LanguageOptions locale={locale} onChange={changeLocale} />
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild><Link href="/guide"><BookOpen aria-hidden="true" className="size-4" /> {t('Guided setup')}</Link></DropdownMenuItem>
          <DropdownMenuItem onSelect={() => {
            if (isConnected) disconnect()
            signOut()
            router.replace('/')
          }} className="text-destructive">
            <LogOut aria-hidden="true" className="size-4" /> {t('Disconnect')}
          </DropdownMenuItem>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
