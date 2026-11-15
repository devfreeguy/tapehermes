'use client'

import { useState } from 'react'
import { AddressText } from '@/components/atoms/address-text'
import { HintText } from '@/components/atoms/hint-text'
import { PageTitle } from '@/components/atoms/page-title'
import { Spinner } from '@/components/atoms/spinner'
import { TimeText } from '@/components/atoms/time-text'
import { ConnectWallet } from '@/components/molecules/connect-wallet'
import { DaysField, daysOrNull } from '@/components/molecules/days-field'
import { DelegationBadge } from '@/components/molecules/delegation-badge'
import { ErrorNotice } from '@/components/molecules/error-notice'
import { WalletStepNotice } from '@/components/molecules/wallet-step-notice'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DELEGATION_DAYS } from '@/config/app'
import { WALLET_STEPS } from '@/copy/wallet-steps'
import { useDelegationSigning } from '@/hooks/use-delegation-signing'
import { useSite } from '@/hooks/use-sites'
import { useWallet } from '@/hooks/use-wallet'
import { daysLeftLabel } from '@/lib/format/text'

/** Choose a length, sign the delegation with the holder wallet, save it. The same screen renews it later. */
export function DelegationSection({ siteName }: { siteName: string }) {
  const site = useSite(siteName)
  const wallet = useWallet()
  const signing = useDelegationSigning(siteName)
  const [days, setDays] = useState(String(DELEGATION_DAYS.default))
  if (site.isPending) return <Spinner />
  if (!site.data) return <ErrorNotice error={site.error} />
  const d = site.data.delegation
  const holderConnected = wallet.address !== null && wallet.address === site.data.holder.toLowerCase()
  const n = daysOrNull(days)
  return (
    <section className="space-y-6">
      <PageTitle title="Delegation" description="Proof that answers from your site really come from you." />
      <Card>
        <CardHeader><CardTitle>Current delegation</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="flex flex-wrap items-center gap-2"><DelegationBadge state={d.status} />{d.expiresAt ? <><span>until</span><TimeText value={d.expiresAt} /><span className="text-muted-foreground">{daysLeftLabel(d.daysLeft)}</span></> : <span className="text-muted-foreground">Not signed yet.</span>}</p>
          {d.status === 'expiring' || d.status === 'expired' ? <Alert><AlertDescription>{d.status === 'expired' ? 'It has ended, so your site cannot answer. Sign a new one below, then publish the manifest again.' : 'It ends soon. Sign a new one below before it does, then publish the manifest again.'}</AlertDescription></Alert> : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{d.stored ? 'Renew the delegation' : 'Sign a delegation'}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <DaysField id="days" value={days} onChange={setDays} />
          <ConnectWallet wallet={wallet} />
          {wallet.isConnected && !holderConnected ? (
            <Alert variant="destructive"><AlertDescription>This wallet is not the holder of {siteName}. Switch your wallet to <AddressText value={site.data.holder} />. Only the holder can sign.</AlertDescription></Alert>
          ) : null}
          <WalletStepNotice step={WALLET_STEPS.delegation} />
          <Button type="button" disabled={!holderConnected || n === null || signing.isPending} onClick={() => n !== null && signing.mutate(n)}>
            {signing.isPending ? <Spinner /> : null}{d.stored ? 'Sign and renew' : 'Sign and save'}
          </Button>
          {signing.isSuccess ? <HintText>Saved. Publish the manifest again so visitors see the new delegation.</HintText> : null}
          <ErrorNotice error={signing.error} />
        </CardContent>
      </Card>
    </section>
  )
}
