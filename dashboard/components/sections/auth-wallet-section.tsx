'use client'

import { useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { HintText } from '@/components/atoms/hint-text'
import { Spinner } from '@/components/atoms/spinner'
import { ErrorNotice } from '@/components/molecules/error-notice'
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { WALLET_STEPS } from '@/copy/wallet-steps'
import { useSignIn } from '@/hooks/use-sign-in'
import { useWallet } from '@/hooks/use-wallet'

export function AuthWalletSection({ secondaryAction }: { secondaryAction: ReactNode }) {
  const router = useRouter()
  const wallet = useWallet()
  const signIn = useSignIn(wallet.address)
  const [open, setOpen] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)

  async function proceed() {
    if (!accepted || pending) return
    setOpen(false)
    setAccepted(false)
    setPending(true)
    setError(null)

    try {
      const address = wallet.isConnected && wallet.address
        ? wallet.address
        : (await wallet.connect(0)).accounts[0]?.toLowerCase()
      if (!address) throw new Error('Connect a wallet first.')
      await signIn.mutateAsync(address)
      router.push('/sites')
    } catch (failure) {
      setError(failure)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="auth-actions">
        {secondaryAction}
        {!wallet.noWallet && (
          <AlertDialog open={open} onOpenChange={(nextOpen) => {
            if (pending) return
            setAccepted(false)
            setOpen(nextOpen)
          }}>
            <AlertDialogTrigger asChild>
              <Button type="button" className="pill-control" aria-disabled={pending}>
                {pending && <Spinner />}
                {pending ? 'Check your wallet' : 'Connect wallet'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="block rounded-2xl p-0 font-(family-name:--font-auth)">
              <ScrollArea label="Wallet connection instructions" viewportClassName="max-h-[calc(100dvh-2rem)]">
                <div className="space-y-6 p-6 sm:p-8">
                <AlertDialogHeader className="block text-start">
                  <AlertDialogTitle className="font-(family-name:--font-auth) text-2xl font-bold">Before you connect</AlertDialogTitle>
                  <AlertDialogDescription className="mt-3 text-base leading-relaxed">
                    Connect your wallet, then approve a one-time signature to prove you control it.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <dl className="space-y-4 text-sm leading-relaxed">
                  <div>
                    <dt className="font-semibold">What happens</dt>
                    <dd className="mt-1 text-muted-foreground">{WALLET_STEPS.signIn.whatHappens}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold">Cost</dt>
                    <dd className="mt-1 text-muted-foreground">{WALLET_STEPS.signIn.cost}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold">What it cannot do</dt>
                    <dd className="mt-1 text-muted-foreground">{WALLET_STEPS.signIn.cannotDo}</dd>
                  </div>
                </dl>
                <label className="flex min-h-13 cursor-pointer items-center gap-3 border-t border-border pt-4 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="size-5 shrink-0 accent-primary-action focus-visible:outline-2 focus-visible:outline-offset-2"
                    checked={accepted}
                    onChange={(event) => setAccepted(event.target.checked)}
                  />
                  <span>I understand and agree to continue.</span>
                </label>
                <div className="auth-actions">
                    <AlertDialogCancel className="pill-control">Cancel</AlertDialogCancel>
                    <Button type="button" className="pill-control" disabled={!accepted} onClick={proceed}>Proceed</Button>
                </div>
                </div>
              </ScrollArea>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
      {wallet.noWallet && <HintText>No wallet was found in this browser. Install a wallet extension such as MetaMask or OKX Wallet, then reload this page.</HintText>}
      <ErrorNotice error={error} />
    </div>
  )
}
