'use client'

import { ChevronDown, Languages } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useLanguagePreference, useTranslator } from '@/lib/locale-context'
import { localeNames, locales, type Locale } from '@/lib/locale'

export function LanguageOptions({ locale, onChange }: { locale: Locale; onChange: (value: string) => void }) {
  return (
    <DropdownMenuRadioGroup value={locale} onValueChange={onChange}>
      {locales.map((value) => (
        <DropdownMenuRadioItem key={value} value={value} textValue={localeNames[value]}>
          <span lang={value}>{localeNames[value]}</span>
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  )
}

export function LanguageMenu() {
  const t = useTranslator()
  const { locale, changeLocale } = useLanguagePreference()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" aria-label={t('Language')} className="pill-control px-3! sm:px-4!">
          <Languages aria-hidden="true" className="size-4 shrink-0 text-primary-action" />
          <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t('Language')}</DropdownMenuLabel>
        <LanguageOptions locale={locale} onChange={changeLocale} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
