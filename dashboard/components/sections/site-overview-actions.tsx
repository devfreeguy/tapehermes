'use client'
import { useTranslator } from '@/lib/locale-context'

import { useState } from 'react'
import { Dialog } from 'radix-ui'
import { Spinner } from '@/components/atoms/spinner'
import { ActionDialog } from '@/components/molecules/action-dialog'
import { ErrorNotice } from '@/components/molecules/error-notice'
import { FormField } from '@/components/molecules/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSetPayout, useSetSiteStatus } from '@/hooks/use-sites'
import { ActivationSection } from './activation-section'

export function PayoutAction({ siteName }: { siteName: string }) {
  const t = useTranslator()
  const [open, setOpen] = useState(false)
  const [payout, setPayout] = useState('')
  const save = useSetPayout(siteName)
  return (
    <ActionDialog
      title={t('Edit payout address')}
      description={t('This is the wallet that gets paid when someone uses a paid action. It starts as the wallet that owns your site.')}
      trigger={<Button type="button" variant="outline" className="pill-control">{t('Edit payout address')}</Button>}
      open={open}
      onOpenChange={(next) => {
        if (save.isPending) return
        setOpen(next)
        setPayout('')
        save.reset()
      }}
    >
      <form className="space-y-4" onSubmit={(event) => {
        event.preventDefault()
        if (!payout.trim() || save.isPending) return
        save.mutate(payout.trim(), { onSuccess: () => { setPayout(''); setOpen(false) } })
      }}>
        <FormField id="payout" label={t('Where payments go')}>
          <Input id="payout" value={payout} onChange={(event) => setPayout(event.target.value)} placeholder="0x..." className="h-13 rounded-xl px-4 font-mono" autoComplete="off" />
        </FormField>
        <ErrorNotice error={save.error} />
        <div className="auth-actions">
          <Dialog.Close asChild><Button type="button" variant="outline" className="pill-control" disabled={save.isPending}>{t('Cancel')}</Button></Dialog.Close>
          <Button type="submit" className="pill-control" disabled={!payout.trim() || save.isPending}>
            {save.isPending && <Spinner />}{t('Save payout address')}
          </Button>
        </div>
      </form>
    </ActionDialog>
  )
}

export function CallAvailabilityAction({ siteName, active }: { siteName: string; active: boolean }) {
  const t = useTranslator()
  const [open, setOpen] = useState(false)
  const update = useSetSiteStatus(siteName)
  const action = active ? t('Pause calls') : t('Resume calls')
  return (
    <ActionDialog
      title={action}
      description={active
        ? t('Pausing answers every call with "not found" at once and clears its keys from memory. Your settings are kept. This is TapeHermes only, and does not change the switch-on state on X Layer.')
        : t('Calls are paused. Resume to answer calls again.')}
      trigger={<Button type="button" variant="ghost" className="pill-control">{action}</Button>}
      open={open}
      onOpenChange={(next) => {
        if (update.isPending) return
        setOpen(next)
        update.reset()
      }}
    >
      <ErrorNotice error={update.error} />
      <div className="auth-actions">
        <Dialog.Close asChild><Button type="button" variant="outline" className="pill-control" disabled={update.isPending}>{t('Cancel')}</Button></Dialog.Close>
        <Button type="button" variant={active ? 'destructive' : 'default'} className="pill-control" disabled={update.isPending} onClick={() => update.mutate(active ? 'DISABLED' : 'ACTIVE', { onSuccess: () => setOpen(false) })}>
          {update.isPending && <Spinner />}{action}
        </Button>
      </div>
    </ActionDialog>
  )
}

export function ActivationAction({ siteName }: { siteName: string }) {
  const t = useTranslator()
  return (
    <ActionDialog
      title={t('X Layer activation')}
      description={t('See whether apps can find your site. To turn it on, connect the wallet that owns it.')}
      trigger={<Button type="button" variant="outline" className="pill-control">{t('Manage activation')}</Button>}
    >
      <ActivationSection siteName={siteName} />
      <Dialog.Close asChild><Button type="button" variant="outline" className="pill-control w-full">{t('Close')}</Button></Dialog.Close>
    </ActionDialog>
  )
}
