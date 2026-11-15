'use client'

import Link from 'next/link'
import { CodeText } from '@/components/atoms/code-text'
import { UsdText } from '@/components/atoms/usd-text'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import type { Route } from '@/lib/api/schemas'
import { ConfirmButton } from './confirm-button'

const hostOf = (url: string) => { try { return new URL(url.replace(/\{[^}]*\}/g, 'x')).host } catch { return url } }

interface Props {
  site: string
  route: Route
  busy?: boolean
  onToggle: (name: string, enabled: boolean) => void
  onDelete: (name: string) => void
}

/** One route in the list: name, method and host it calls, price, an on/off switch, and edit or delete. */
export function RouteRow({ site, route, busy, onToggle, onDelete }: Props) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2"><CodeText>{route.name}</CodeText><UsdText value={route.priceUsd} /></div>
        <p className="text-sm text-muted-foreground"><span className="font-mono">{route.config.method ?? 'GET'}</span> {hostOf(route.config.url)}</p>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={route.enabled} disabled={busy} aria-label={`${route.name} on`} onCheckedChange={(v) => onToggle(route.name, v)} />
          {route.enabled ? 'On' : 'Off'}
        </label>
        <Button asChild variant="outline" size="sm"><Link href={`/sites/${encodeURIComponent(site)}/routes/${encodeURIComponent(route.name)}`}>Edit</Link></Button>
        <ConfirmButton
          trigger={<Button type="button" variant="outline" size="sm" disabled={busy}>Delete</Button>}
          title={`Delete ${route.name}?`} description="Visitors can no longer call it. Publish the manifest again afterwards." confirmLabel="Delete route"
          onConfirm={() => onDelete(route.name)}
        />
      </div>
    </li>
  )
}
