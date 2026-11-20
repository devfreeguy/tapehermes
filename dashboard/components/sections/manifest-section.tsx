'use client'

import { SITE_TERMS } from '@/copy/site-terms'
import { Braces, FileCheck2, Upload } from 'lucide-react'
import { useState } from 'react'
import { Dialog } from 'radix-ui'
import { AddressText } from '@/components/atoms/address-text'
import { HintText } from '@/components/atoms/hint-text'
import { PageTitle } from '@/components/atoms/page-title'
import { Spinner } from '@/components/atoms/spinner'
import { TimeText } from '@/components/atoms/time-text'
import { ActionDialog } from '@/components/molecules/action-dialog'
import { ConnectWallet } from '@/components/molecules/connect-wallet'
import { ErrorNotice } from '@/components/molecules/error-notice'
import { MANIFEST_LOOK } from '@/components/molecules/manifest-state-badge'
import { OverviewTile } from '@/components/molecules/overview-tile'
import { WalletStepNotice } from '@/components/molecules/wallet-step-notice'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { explainProblem } from '@/copy/errors'
import { WALLET_STEPS } from '@/copy/wallet-steps'
import { useManifestPreview, useManifestStatus } from '@/hooks/use-manifest'
import { usePublishManifest } from '@/hooks/use-publish-manifest'
import { useSite } from '@/hooks/use-sites'
import { useWallet } from '@/hooks/use-wallet'

import { useSelectedSiteName } from '@/components/molecules/site-selection-provider'

export function ManifestSection({ siteName: explicitSite }: { siteName?: string }) {
  const siteName = useSelectedSiteName(explicitSite)
  const site = useSite(siteName)
  const preview = useManifestPreview(siteName)
  const status = useManifestStatus(siteName)
  const wallet = useWallet()
  const publish = usePublishManifest(siteName)
  const [open, setOpen] = useState(false)
  const [progress, setProgress] = useState<[number, number] | null>(null)
  const state = status.data?.state
  const appearance = state && MANIFEST_LOOK[state]
  const holderConnected = !!wallet.address && wallet.address === site.data?.holder.toLowerCase()
  const canPublish = !!preview.data?.publishable && state !== 'current'

  return (
    <section className="space-y-7 lg:space-y-9">
      <PageTitle variant="dashboard" title={SITE_TERMS.manifest.label} description={SITE_TERMS.manifest.description}
        action={
          <ActionDialog title="Review before publishing" description="Review what the wallet will do before sending any transactions."
            open={open} onOpenChange={(next) => { if (!publish.isPending) setOpen(next) }}
            trigger={<Button type="button" className="pill-control" disabled={!canPublish}><Upload aria-hidden="true" />Review before publishing</Button>}
          >
            <ConnectWallet wallet={wallet} className="pill-control" />
            {wallet.isConnected && !holderConnected && site.data && <Alert variant="destructive"><AlertDescription>Connect the holder wallet <AddressText value={site.data.holder} /> to publish.</AlertDescription></Alert>}
            {!wallet.onXLayer && wallet.isConnected && <WalletStepNotice step={WALLET_STEPS.switchChain} presentation="dialog" />}
            <WalletStepNotice step={WALLET_STEPS.publish} presentation="dialog" />
            {publish.isPending && progress && <HintText>Transaction {progress[0]} of {progress[1]} confirmed. Keep your wallet open.</HintText>}
            {publish.isSuccess && <p role="status" className="text-sm text-muted-foreground">Published in {publish.data.length} transaction{publish.data.length === 1 ? '' : 's'}.</p>}
            <ErrorNotice error={publish.error} />
            <div className="auth-actions">
              <Dialog.Close asChild><Button type="button" variant="outline" className="pill-control" disabled={publish.isPending}>Close</Button></Dialog.Close>
              <Button type="button" className="pill-control" disabled={!canPublish || !holderConnected || publish.isPending} onClick={() => {
                setProgress(null)
                publish.mutate((done, total) => setProgress([done, total]))
              }}>
                {publish.isPending && <Spinner />}{state === 'out-of-date' ? 'Publish update' : 'Publish API list'}
              </Button>
            </div>
          </ActionDialog>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <OverviewTile title="Live on X Layer" icon={FileCheck2} accentClassName="text-info" attention={appearance?.tone}>
          {status.isPending && <Spinner label="Checking the published API list" />}
          {appearance && (
            <div className="space-y-2 rounded-xl bg-info/7 p-4">
              <p data-tone={appearance.tone} className="text-xl font-semibold tracking-tight group-data-[attention=bad]/tile:text-destructive group-data-[attention=warn]/tile:text-warning">{appearance.label}</p>
              <p data-testid="manifest-sentence" className="text-sm leading-relaxed text-muted-foreground">{appearance.sentence}</p>
            </div>
          )}
          <ErrorNotice error={status.error} />
          {status.data?.onChain && (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-muted-foreground">Published on</dt><dd className="mt-1"><TimeText value={status.data.onChain.updatedAt} /></dd></div>
              <div><dt className="text-muted-foreground">Published file ID</dt><dd className="mt-1"><AddressText value={status.data.onChain.sha256} /></dd></div>
            </dl>
          )}
          {!!preview.data?.problems.length && (
            <div className="space-y-2 rounded-xl bg-warning/7 p-4 text-sm">
              <p className="font-semibold">Before you can publish</p>
              <ul className="list-disc space-y-1 ps-5 text-muted-foreground">{preview.data.problems.map((problem) => <li key={problem}>{explainProblem(problem)}</li>)}</ul>
            </div>
          )}
        </OverviewTile>
        <OverviewTile title="Draft API list" icon={Braces} accentClassName="text-accent">
          {preview.isPending && <Spinner label="Preparing the draft API list" />}
          <ErrorNotice error={preview.error} />
          {preview.data && (
            <>
              <dl className="space-y-4 rounded-xl bg-accent/7 p-4 text-sm">
                <div><dt className="text-muted-foreground">Size</dt><dd className="mt-1">{preview.data.size} bytes</dd></div>
                <div><dt className="text-muted-foreground">Draft file ID</dt><dd className="mt-1"><AddressText value={status.data?.expected?.sha256 ?? preview.data.sha256} /></dd></div>
              </dl>
              <ActionDialog title="API List JSON" description="This is the draft file apps will read after you publish."
                trigger={<Button type="button" variant="outline" className="pill-control self-start"><Braces aria-hidden="true" />View JSON</Button>}
              >
                <ScrollArea label="API List JSON source" orientation="both" className="rounded-xl border border-border bg-background" viewportClassName="max-h-[55dvh]">
                  <pre className="p-4 font-mono text-xs leading-relaxed">{JSON.stringify(preview.data.manifest, null, 2)}</pre>
                </ScrollArea>
                <Dialog.Close asChild><Button type="button" variant="outline" className="pill-control w-full">Close</Button></Dialog.Close>
              </ActionDialog>
            </>
          )}
        </OverviewTile>
      </div>
    </section>
  )
}
