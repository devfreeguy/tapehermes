'use client'

import { KeyRound, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { Dialog } from 'radix-ui'
import { AddressText } from '@/components/atoms/address-text'
import { HintText } from '@/components/atoms/hint-text'
import { PageTitle } from '@/components/atoms/page-title'
import { Spinner } from '@/components/atoms/spinner'
import { TimeText } from '@/components/atoms/time-text'
import { ActionDialog } from '@/components/molecules/action-dialog'
import { ConnectWallet } from '@/components/molecules/connect-wallet'
import { DaysField, daysOrNull } from '@/components/molecules/days-field'
import { DELEGATION_LOOK } from '@/components/molecules/delegation-badge'
import { ErrorNotice } from '@/components/molecules/error-notice'
import { OverviewTile } from '@/components/molecules/overview-tile'
import { WalletStepNotice } from '@/components/molecules/wallet-step-notice'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { DELEGATION_DAYS } from '@/config/app'
import { WALLET_STEPS } from '@/copy/wallet-steps'
import { useDelegationSigning } from '@/hooks/use-delegation-signing'
import { useSite } from '@/hooks/use-sites'
import { useWallet } from '@/hooks/use-wallet'
import { daysLeftLabel } from '@/lib/format/text'

import { useSelectedSiteName } from '@/components/molecules/site-selection-provider'

export function DelegationSection({ siteName: explicitSite }: { siteName?: string }) {
  const siteName = useSelectedSiteName(explicitSite)
  const site = useSite(siteName)
  const wallet = useWallet()
  const signing = useDelegationSigning(siteName)
  const [open, setOpen] = useState(false)
  const [days, setDays] = useState(String(DELEGATION_DAYS.default))
  if (site.isPending) return <Spinner label="Loading delegation" />
  if (!site.data) return <ErrorNotice error={site.error} />
  const { delegation, holder, signer } = site.data
  const status = DELEGATION_LOOK[delegation.status]
  const holderConnected = wallet.address !== null && wallet.address === holder.toLowerCase()
  const duration = daysOrNull(days)
  const title = delegation.stored ? 'Renew delegation' : 'Sign a delegation'

  return (
    <section className="space-y-7 lg:space-y-9">
      <PageTitle variant="dashboard" title="Delegation" description="Give TapeHermes permission to sign responses for this site for a limited time."
        action={
          <ActionDialog title={title} description="Choose how long the permission lasts, then approve the signature in the holder wallet."
            open={open} onOpenChange={(next) => {
              if (signing.isPending) return
              if (next) setDays(String(DELEGATION_DAYS.default))
              setOpen(next)
            }}
            trigger={<Button type="button" className="pill-control"><ShieldCheck aria-hidden="true" />{title}</Button>}
          >
            <DaysField id="days" value={days} onChange={setDays} presentation="dialog" />
            <ConnectWallet wallet={wallet} className="pill-control" />
            {wallet.isConnected && !holderConnected && (
              <Alert variant="destructive"><AlertDescription>This wallet is not the holder of {siteName}. Switch your wallet to <AddressText value={holder} />. Only the holder can sign.</AlertDescription></Alert>
            )}
            <WalletStepNotice step={WALLET_STEPS.delegation} presentation="dialog" />
            <ErrorNotice error={signing.error} />
            {signing.isSuccess && <p role="status" className="text-sm text-muted-foreground">Saved. Publish the manifest again so visitors see the new delegation.</p>}
            <div className="auth-actions">
              <Dialog.Close asChild><Button type="button" variant="outline" className="pill-control" disabled={signing.isPending}>Close</Button></Dialog.Close>
              <Button type="button" className="pill-control" disabled={!holderConnected || duration === null || signing.isPending} onClick={() => duration !== null && signing.mutate(duration)}>
                {signing.isPending && <Spinner />}{delegation.stored ? 'Sign and renew' : 'Sign and save'}
              </Button>
            </div>
          </ActionDialog>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <OverviewTile title="Current delegation" icon={ShieldCheck} accentClassName="text-primary-action" attention={status.tone}>
          <div className="space-y-2 rounded-xl bg-primary-action/6 p-4">
            <p className="text-xl font-semibold tracking-tight group-data-[attention=bad]/tile:text-destructive group-data-[attention=warn]/tile:text-warning">{status.label}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {delegation.expiresAt ? <>Expires <TimeText value={delegation.expiresAt} /> · <span>{daysLeftLabel(delegation.daysLeft)}</span></> : 'Not signed yet.'}
            </p>
          </div>
          {delegation.status === 'expired' && <HintText>It has ended, so your site cannot answer. Renew the delegation, then publish the manifest again.</HintText>}
          {delegation.status === 'expiring' && <HintText>It ends soon. Renew before it expires, then publish the manifest again.</HintText>}
          {signing.isSuccess && !open && (
            <Button asChild variant="outline" className="pill-control self-start">
              <Link href="/sites/manifest">Open manifest</Link>
            </Button>
          )}
        </OverviewTile>
        <OverviewTile title="Wallets and keys" icon={KeyRound} accentClassName="text-accent">
          <dl className="space-y-4 rounded-xl bg-accent/7 p-4 text-sm">
            <div><dt className="text-muted-foreground">Site holder</dt><dd className="mt-1"><AddressText value={holder} full /></dd></div>
            <div><dt className="text-muted-foreground">Signing key</dt><dd className="mt-1"><AddressText value={signer} full /></dd></div>
          </dl>
        </OverviewTile>
      </div>
    </section>
  )
}
