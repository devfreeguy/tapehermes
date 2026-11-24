'use client'
import { useTranslator } from '@/lib/locale-context'

import { SITE_TERMS } from '@/copy/site-terms'
import { FileCheck2, FileUp, Upload } from 'lucide-react'
import { useState } from 'react'
import { Dialog } from 'radix-ui'
import { HintText } from '@/components/atoms/hint-text'
import { PageTitle } from '@/components/atoms/page-title'
import { Spinner } from '@/components/atoms/spinner'
import { StatusBadge, type Tone } from '@/components/atoms/status-badge'
import { ActionDialog } from '@/components/molecules/action-dialog'
import { AddressText } from '@/components/atoms/address-text'
import { ConnectWallet } from '@/components/molecules/connect-wallet'
import { ErrorNotice } from '@/components/molecules/error-notice'
import { OverviewTile } from '@/components/molecules/overview-tile'
import { useSelectedSiteName } from '@/components/molecules/site-selection-provider'
import { WalletStepNotice } from '@/components/molecules/wallet-step-notice'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { WALLET_STEPS } from '@/copy/wallet-steps'
import { usePlanSiteFiles, usePublishSiteFiles } from '@/hooks/use-site-files'
import { useSite } from '@/hooks/use-sites'
import { useWallet } from '@/hooks/use-wallet'
import type { SiteBundle, SiteFileState } from '@/lib/api/schemas'
import { gatewayUrl, readSiteBundle } from '@/lib/site-bundle'

const STATE_LOOK: Record<SiteFileState, { label: string; tone: Tone }> = {
  new: { label: 'New', tone: 'warn' },
  changed: { label: 'Changed', tone: 'warn' },
  current: { label: 'On X Layer', tone: 'good' },
}

/** Put the website's files on the chain: choose the bundle, see what will change, then approve the transactions in the wallet. */
export function WebsiteSection({ siteName: explicitSite }: { siteName?: string }) {
  const t = useTranslator()
  const siteName = useSelectedSiteName(explicitSite)
  const site = useSite(siteName)
  const wallet = useWallet()
  const planFiles = usePlanSiteFiles(siteName)
  const publish = usePublishSiteFiles(siteName)
  const [bundle, setBundle] = useState<SiteBundle | null>(null)
  const [fileProblem, setFileProblem] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [progress, setProgress] = useState<[number, number] | null>(null)
  const verified = publish.data?.check
  const plan = verified ?? planFiles.data // after publishing, the check read from the chain is the newest picture
  const holderConnected = !!wallet.address && wallet.address === site.data?.holder.toLowerCase()
  const canPublish = !!plan && plan.totalTxs > 0
  const allCurrent = !!plan && plan.totalTxs === 0
  const live = gatewayUrl(siteName)

  async function choose(file: File | undefined) {
    setFileProblem(null); setBundle(null); publish.reset(); planFiles.reset()
    if (!file) return
    const read = readSiteBundle(await file.text())
    if (!read.ok) { setFileProblem(read.reason === 'TOO_LARGE' ? 'That file is too large to be a site bundle.' : 'That file is not a site bundle. Run pnpm site:build and choose public-site/dist/site-bundle.json.'); return }
    setBundle(read.bundle)
    planFiles.mutate(read.bundle)
  }

  return (
    <section className="space-y-7 lg:space-y-9">
      <PageTitle variant="dashboard" title={t(SITE_TERMS.website.label)} description={t(SITE_TERMS.website.description)}
        action={
          <ActionDialog title={t('Review before publishing')} description={t('Review what the wallet will do before sending any transactions.')}
            open={open} onOpenChange={(next) => { if (!publish.isPending) setOpen(next) }}
            trigger={<Button type="button" className="pill-control" disabled={!canPublish}><Upload aria-hidden="true" />{t('Review before publishing')}</Button>}
          >
            <ConnectWallet wallet={wallet} className="pill-control" />
            {wallet.isConnected && !holderConnected && site.data && <Alert variant="destructive"><AlertDescription>{t('Connect the holder wallet') + ' '}<AddressText value={site.data.holder} /> {t('to publish.')}</AlertDescription></Alert>}
            {!wallet.onXLayer && wallet.isConnected && <WalletStepNotice step={WALLET_STEPS.switchChain} presentation="dialog" />}
            <WalletStepNotice step={WALLET_STEPS.publishSite} presentation="dialog" />
            {plan && <HintText>{t('{0} files, {1} transactions to approve.', plan.files.filter((f) => f.state !== 'current').length, plan.totalTxs)}</HintText>}
            {publish.isPending && progress && <HintText>{t('Transaction {0} of {1} confirmed. Keep your wallet open.', ...progress)}</HintText>}
            {publish.isSuccess && verified && (
              <p role="status" className="text-sm text-muted-foreground">
                {verified.totalTxs === 0 ? t('Published. Every file was checked on X Layer and matches.') : t('Sent, but {0} transactions still need to be approved. Review again to continue.', verified.totalTxs)}
              </p>
            )}
            <ErrorNotice error={publish.error} />
            <div className="auth-actions">
              <Dialog.Close asChild><Button type="button" variant="outline" className="pill-control" disabled={publish.isPending}>{t('Close')}</Button></Dialog.Close>
              <Button type="button" className="pill-control" disabled={!canPublish || !bundle || !holderConnected || publish.isPending} onClick={() => {
                if (!bundle || !plan) return
                setProgress(null)
                publish.mutate({ bundle, plan, onProgress: (done, total) => setProgress([done, total]) })
              }}>
                {publish.isPending && <Spinner />}{t('Publish website')}
              </Button>
            </div>
          </ActionDialog>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <OverviewTile title={t('Your website files')} icon={FileUp} accentClassName="text-info">
          <label htmlFor="site-bundle" className="text-sm font-medium">{t('Site bundle file')}</label>
          <Input id="site-bundle" type="file" accept=".json,application/json" onChange={(e) => void choose(e.target.files?.[0])} />
          <HintText>{t('Run pnpm site:build in the project, then choose public-site/dist/site-bundle.json.')}</HintText>
          {fileProblem && <Alert variant="destructive"><AlertDescription>{t(fileProblem)}</AlertDescription></Alert>}
          {planFiles.isPending && <Spinner label={t('Checking your website against X Layer')} />}
          <ErrorNotice error={planFiles.error} />
        </OverviewTile>

        <OverviewTile title={t('What will be published')} icon={FileCheck2} accentClassName="text-accent" attention={allCurrent ? undefined : plan ? 'warn' : undefined}>
          {!plan && !planFiles.isPending && <HintText>{t('Choose a site bundle file to see which files are on X Layer and which will be written.')}</HintText>}
          {plan && (
            <>
              <p data-testid="website-summary" className="text-sm leading-relaxed text-muted-foreground">
                {allCurrent ? t('Every file is already on X Layer.') : t('{0} files will be written in {1} transactions.', plan.files.filter((f) => f.state !== 'current').length, plan.totalTxs)}
              </p>
              <ul className="space-y-2 text-sm">
                {plan.files.map((f) => (
                  <li key={f.path} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-accent/7 px-3 py-2">
                    <span className="font-mono">{f.path}</span>
                    <span className="flex items-center gap-2 text-muted-foreground">{f.size} {t('bytes')}<StatusBadge tone={STATE_LOOK[f.state].tone}>{t(STATE_LOOK[f.state].label)}</StatusBadge></span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {verified?.totalTxs === 0 && live && (
            <p className="text-sm">{t('Your website is on X Layer.')} <a className="underline" href={live} target="_blank" rel="noopener noreferrer">{live}</a></p>
          )}
        </OverviewTile>
      </div>
    </section>
  )
}
