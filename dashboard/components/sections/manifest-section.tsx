'use client'

import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { AddressText } from '@/components/atoms/address-text'
import { HintText } from '@/components/atoms/hint-text'
import { PageTitle } from '@/components/atoms/page-title'
import { Spinner } from '@/components/atoms/spinner'
import { TimeText } from '@/components/atoms/time-text'
import { ConnectWallet } from '@/components/molecules/connect-wallet'
import { ErrorNotice } from '@/components/molecules/error-notice'
import { MANIFEST_LOOK, ManifestStateBadge } from '@/components/molecules/manifest-state-badge'
import { WalletStepNotice } from '@/components/molecules/wallet-step-notice'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { explainProblem } from '@/copy/errors'
import { WALLET_STEPS } from '@/copy/wallet-steps'
import { useManifestPreview, useManifestStatus } from '@/hooks/use-manifest'
import { usePublishManifest } from '@/hooks/use-publish-manifest'
import { useSite } from '@/hooks/use-sites'
import { useWallet } from '@/hooks/use-wallet'

/** Preview the manifest, see whether the chain holds the same one, and publish it through the owner's wallet. */
export function ManifestSection({ siteName }: { siteName: string }) {
  const site = useSite(siteName)
  const preview = useManifestPreview(siteName)
  const status = useManifestStatus(siteName)
  const wallet = useWallet()
  const publish = usePublishManifest(siteName)
  const [progress, setProgress] = useState<[number, number] | null>(null)
  const state = status.data?.state
  const holderConnected = !!wallet.address && wallet.address === site.data?.holder.toLowerCase()
  const canPublish = !!preview.data?.publishable && state !== 'current'
  return (
    <section className="space-y-6">
      <PageTitle title="Manifest" description="The public list of your routes, prices and delegation. Visitors and apps read it from your site on X Layer." />
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-3">On-chain state {state ? <ManifestStateBadge state={state} /> : null}</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {status.isPending ? <Spinner /> : null}
          {state ? <p data-testid="manifest-sentence">{MANIFEST_LOOK[state].sentence}</p> : null}
          <ErrorNotice error={status.error} />
          {status.data?.onChain ? <p className="flex flex-wrap items-center gap-2 text-muted-foreground">On chain since <TimeText value={status.data.onChain.updatedAt} />, hash <AddressText value={status.data.onChain.sha256} /></p> : null}
          {status.data?.expected ? <p className="flex flex-wrap items-center gap-2 text-muted-foreground">Would publish now: hash <AddressText value={status.data.expected.sha256} />, {status.data.expected.size} bytes</p> : null}
          {preview.data && preview.data.problems.length ? (
            <Alert><AlertDescription><p className="font-medium">Before you can publish:</p><ul className="list-disc pl-5">{preview.data.problems.map((p) => <li key={p}>{explainProblem(p)}</li>)}</ul></AlertDescription></Alert>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Publish</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <ConnectWallet wallet={wallet} />
          {wallet.isConnected && !holderConnected && site.data ? <Alert variant="destructive"><AlertDescription>Connect the holder wallet <AddressText value={site.data.holder} /> to publish.</AlertDescription></Alert> : null}
          {!wallet.onXLayer && wallet.isConnected ? <WalletStepNotice step={WALLET_STEPS.switchChain} /> : null}
          <WalletStepNotice step={WALLET_STEPS.publish} />
          <Button type="button" disabled={!canPublish || !holderConnected || publish.isPending} onClick={() => publish.mutate((d, t) => setProgress([d, t]))}>
            {publish.isPending ? <Spinner /> : null}{state === 'out-of-date' ? 'Publish the update' : 'Publish the manifest'}
          </Button>
          {publish.isPending && progress ? <HintText>Transaction {progress[0]} of {progress[1]} confirmed. Keep your wallet open.</HintText> : null}
          {publish.isSuccess ? <HintText>Published in {publish.data.length} transaction{publish.data.length === 1 ? '' : 's'}.</HintText> : null}
          <ErrorNotice error={publish.error} />
        </CardContent>
      </Card>
      {preview.data ? (
        <Collapsible>
          <CollapsibleTrigger className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">Show the manifest ({preview.data.size} bytes) <ChevronDown className="size-4" /></CollapsibleTrigger>
          <CollapsibleContent><pre className="mt-2 max-h-96 overflow-auto rounded-lg border border-border bg-card p-4 font-mono text-xs">{JSON.stringify(preview.data.manifest, null, 2)}</pre></CollapsibleContent>
        </Collapsible>
      ) : null}
    </section>
  )
}
