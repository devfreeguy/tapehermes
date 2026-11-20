'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { localeCookie, locales, translator, type Locale } from './locale'

const LocaleContext = createContext<Locale>('en')

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  return useContext(LocaleContext)
}

export function useTranslator() {
  return translator(useLocale())
}

export function useLanguagePreference() {
  const locale = useLocale()
  const router = useRouter()

  function changeLocale(value: string) {
    if (value === locale || !locales.some((option) => option === value)) return
    const secure = window.location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `${localeCookie}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`
    router.refresh()
  }

  return { locale, changeLocale }
}
