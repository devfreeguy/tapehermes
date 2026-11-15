'use client'

import { useRouter } from 'next/navigation'
import { HintText } from '@/components/atoms/hint-text'
import { Spinner } from '@/components/atoms/spinner'
import { ConnectWallet } from '@/components/molecules/connect-wallet'
import { ErrorNotice } from '@/components/molecules/error-notice'
import { WalletStepNotice } from '@/components/molecules/wallet-step-notice'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { WALLET_STEPS } from '@/copy/wallet-steps'
import { useSignIn } from '@/hooks/use-sign-in'
import { useWallet } from '@/hooks/use-wallet'

/** Sign in with a wallet. The signature proves the wallet is yours; it is free and moves nothing. */
export function SignInSection({ onDone }: { onDone?: () => void }) {
  const router = useRouter()
  const wallet = useWallet()
  const signIn = useSignIn(wallet.address)
  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Your wallet is your account. There is no password and no email.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ConnectWallet wallet={wallet} />
        {wallet.isConnected ? (
          <>
            <WalletStepNotice step={WALLET_STEPS.signIn} />
            <Button type="button" disabled={signIn.isPending} onClick={() => signIn.mutate(undefined, { onSuccess: () => (onDone ? onDone() : router.push('/sites')) })}>
              {signIn.isPending ? <Spinner /> : null}Sign in with this wallet
            </Button>
          </>
        ) : <HintText>Connect first, then you will sign one short message.</HintText>}
        <ErrorNotice error={signIn.error} />
      </CardContent>
    </Card>
  )
}
