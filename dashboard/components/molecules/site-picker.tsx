'use client'

import { useTranslator } from '@/lib/locale-context'
import { ChevronDown, Globe2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'

export function SitePicker({
  sites, selected, pending, onChange,
}: {
  sites: readonly { name: string }[]
  selected: string | null
  pending: boolean
  onChange: (site: string) => void
}) {
  const t = useTranslator()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" aria-label={selected ? t('Switch site, current site {0}', selected) : t('Owned sites')} disabled={!sites.length} className="pill-control max-w-full justify-between px-3! sm:px-5!">
          <Globe2 aria-hidden="true" className="size-4 text-primary-action" />
          <span className="truncate">{selected ?? (pending ? t('Loading sites') : t('No sites yet'))}</span>
          <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>{t('Owned sites')}</DropdownMenuLabel>
        <ScrollArea label={t('Owned sites')} viewportClassName="max-h-[min(16rem,calc(var(--radix-dropdown-menu-content-available-height)-3rem))]">
          <DropdownMenuRadioGroup value={selected ?? ''} onValueChange={onChange}>
            {sites.map(({ name }) => <DropdownMenuRadioItem key={name} value={name}>{name}</DropdownMenuRadioItem>)}
          </DropdownMenuRadioGroup>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
