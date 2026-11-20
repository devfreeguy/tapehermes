'use client'

import { useRouter } from 'next/navigation'
import { HintText } from '@/components/atoms/hint-text'
import { Spinner } from '@/components/atoms/spinner'
import { ConnectWallet } from '@/components/molecules/connect-wallet'
import { ErrorNotice } from '@/components/molecules/error-notice'
import { WalletStepNotice } from '@/components/molecules/wallet-step-notice'
import { Button } from '@/components/ui/button'
import { WALLET_STEPS } from '@/copy/wallet-steps'
import { useSignIn } from '@/hooks/use-sign-in'
import { useWallet } from '@/hooks/use-wallet'

/** Sign in with a wallet. The signature proves the wallet is yours; it is free and moves nothing. */
export function SignInSection({ onDone }: { onDone?: () => void }) {
  const router = useRouter()
  const wallet = useWallet()
  const signIn = useSignIn(wallet.address)
  return (
    <div className="space-y-4">
      <HintText>Your wallet is your account. There is no password and no email.</HintText>
      <ConnectWallet wallet={wallet} className="pill-control" />
      {wallet.isConnected ? (
        <>
          <WalletStepNotice step={WALLET_STEPS.signIn} presentation="dialog" />
          <Button type="button" className="pill-control h-auto! min-h-11 whitespace-normal" disabled={signIn.isPending} onClick={() => signIn.mutate(undefined, { onSuccess: () => (onDone ? onDone() : router.push('/sites')) })}>
            {signIn.isPending ? <Spinner /> : null}Sign in with this wallet
          </Button>
        </>
      ) : null}
      <ErrorNotice error={signIn.error} />
    </div>
  )
}
