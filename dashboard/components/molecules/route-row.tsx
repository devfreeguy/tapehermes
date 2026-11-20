'use client'
import { useTranslator } from '@/lib/locale-context'

import { ArrowUpRight, Network, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { UsdText } from '@/components/atoms/usd-text'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import type { Route } from '@/lib/api/schemas'
import { ConfirmButton } from './confirm-button'

function hostOf(url: string) {
  try { return new URL(url.replace(/\{[^}]*\}/g, 'x')).host } catch { return url }
}

interface Props {
  route: Route
  busy?: boolean
  onToggle: (name: string, enabled: boolean) => void
  onDelete: (name: string) => void
}

export function RouteRow({ route, busy, onToggle, onDelete }: Props) {
  const t = useTranslator()
  return (
    <li className="min-w-0">
      <Card className="h-full gap-5 rounded-2xl bg-background p-5 shadow-none sm:p-6">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-info/10 text-info">
            <Network aria-hidden="true" className="size-4" />
          </div>
          <div className="min-w-0 space-y-1">
            <h2 className="font-mono text-sm font-semibold break-all sm:text-base">{route.name}</h2>
            <p className="text-xs leading-relaxed break-all text-muted-foreground">{hostOf(route.config.url)}</p>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-3 rounded-xl bg-info/7 px-4 py-3">
          <div className="min-w-0 space-y-1">
            <dt className="text-xs text-muted-foreground">{t('Method')}</dt>
            <dd className="font-mono text-sm font-semibold text-info">{route.config.method ?? 'GET'}</dd>
          </div>
          <div className="min-w-0 space-y-1 border-s border-border ps-3">
            <dt className="text-xs text-muted-foreground">{t('Price per call')}</dt>
            <dd className="text-sm font-semibold break-all"><UsdText value={route.priceUsd} /></dd>
          </div>
        </dl>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <label className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={route.enabled} disabled={busy} aria-label={t('{0} on', route.name)} onCheckedChange={(value) => onToggle(route.name, value)} />
            {route.enabled ? t('On') : t('Off')}
          </label>
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" className="h-11 rounded-full bg-primary-action/12 px-3 text-primary-action hover:bg-primary-action/20 hover:text-primary-action has-[>svg]:px-3">
              <Link href={`/sites/actions/${encodeURIComponent(route.name)}`}>{t('Edit') + ' '}<ArrowUpRight aria-hidden="true" /></Link>
            </Button>
            <ConfirmButton
              destructive
              trigger={<Button type="button" variant="ghost" size="icon" disabled={busy} aria-label={t('Delete')} className="size-11 rounded-full text-muted-foreground hover:text-destructive"><Trash2 aria-hidden="true" /></Button>}
              title={t('Delete {0}?', route.name)} description={t('Visitors will no longer be able to use this action. Publish your API list again so apps see the change.')} confirmLabel={t('Delete action')}
              onConfirm={() => onDelete(route.name)}
            />
          </div>
        </div>
      </Card>
    </li>
  )
}
