'use client'

import { useState } from 'react'
import { AddressText } from '@/components/atoms/address-text'
import { HintText } from '@/components/atoms/hint-text'
import { Spinner } from '@/components/atoms/spinner'
import { StatusBadge } from '@/components/atoms/status-badge'
import { TimeText } from '@/components/atoms/time-text'
import { ConnectWallet } from '@/components/molecules/connect-wallet'
import { ErrorNotice } from '@/components/molecules/error-notice'
import { FormField } from '@/components/molecules/form-field'
import { WalletStepNotice } from '@/components/molecules/wallet-step-notice'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { WALLET_STEPS } from '@/copy/wallet-steps'
import { useActivation, useRecheckActivation, useSwitchOn } from '@/hooks/use-activation'
import { useWallet } from '@/hooks/use-wallet'

/** Is the site switched on? If not, the holder switches it on here with one wallet transaction. */
export function ActivationSection({ siteName }: { siteName: string }) {
  const activation = useActivation(siteName)
  const recheck = useRecheckActivation(siteName)
  const switchOn = useSwitchOn(siteName)
  const wallet = useWallet()
  const [months, setMonths] = useState('1')
  const a = activation.data
  const count = Number(months)
  const validMonths = Number.isInteger(count) && count >= 1 && count <= (a?.maxMonths ?? 12)
  const holderConnected = !!wallet.address && !!a && wallet.address === a.holder.toLowerCase()
  return (
    <div data-testid="activation-card" className="space-y-4 text-sm">
      {a && <StatusBadge tone={a.activated ? 'good' : 'warn'}>{a.activated ? 'Switched on' : 'Not switched on'}</StatusBadge>}
      {activation.isPending ? <Spinner /> : null}
      <ErrorNotice error={activation.error} />
      {a?.activated ? (
        <p>Your site is switched on{a.paidUntil ? <> until <TimeText value={a.paidUntil} /></> : null}. After that date apps can no longer find it, so check back before then.</p>
      ) : null}
      {a && !a.activated ? (
        <>
          <p>A new site is off until its holder switches it on. While it is off, apps cannot find it. Your settings here still work.</p>
          <p className="text-muted-foreground">Price: {a.fee.perMonth} {a.fee.symbol} per month, read from the chain just now. The chain owner can change it, so your wallet shows the final amount.</p>
          <FormField id="months" label="Months to switch on for" hint={`From 1 to ${a.maxMonths}. Each month is 30 days.`}>
            <Input id="months" type="number" min={1} max={a.maxMonths} step={1} value={months} onChange={(e) => setMonths(e.target.value)} className="h-13 w-28 rounded-xl" />
          </FormField>
          <ConnectWallet wallet={wallet} />
          {wallet.isConnected && !holderConnected ? <Alert variant="destructive"><AlertDescription>Connect the holder wallet <AddressText value={a.holder} /> to switch the site on.</AlertDescription></Alert> : null}
          {!wallet.onXLayer && wallet.isConnected ? <WalletStepNotice step={WALLET_STEPS.switchChain} /> : null}
          <WalletStepNotice step={WALLET_STEPS.switchOn} />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" className="pill-control" disabled={!holderConnected || !validMonths || switchOn.isPending} onClick={() => switchOn.mutate(count)}>
              {switchOn.isPending ? <Spinner /> : null}Switch on my site
            </Button>
            <Button type="button" variant="ghost" className="pill-control" onClick={() => recheck()}>Check again</Button>
          </div>
          {switchOn.isPending ? <HintText>Waiting for the transaction. Keep your wallet open.</HintText> : null}
          {switchOn.isSuccess ? <HintText>Sent. If it still says not switched on, wait a few seconds and press Check again.</HintText> : null}
          <ErrorNotice error={switchOn.error} />
        </>
      ) : null}
    </div>
  )
}
