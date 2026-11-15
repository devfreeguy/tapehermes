'use client'

import { Wallet as WalletIcon } from 'lucide-react'
import { AddressText } from '@/components/atoms/address-text'
import { HintText } from '@/components/atoms/hint-text'
import { Spinner } from '@/components/atoms/spinner'
import { Button } from '@/components/ui/button'
import type { Wallet } from '@/hooks/use-wallet'

/** Connect, or show the connected wallet. Says plainly when no wallet extension is installed. */
export function ConnectWallet({ wallet }: { wallet: Pick<Wallet, 'address' | 'isConnected' | 'noWallet' | 'connecting' | 'connect' | 'disconnect'> }) {
  if (wallet.noWallet) return <HintText>No wallet was found in this browser. Install a wallet extension such as MetaMask or OKX Wallet, then reload this page.</HintText>
  if (wallet.isConnected && wallet.address) {
    return (
      <div className="flex flex-wrap items-center gap-3"><span className="text-sm text-muted-foreground">Connected</span><AddressText value={wallet.address} />
        <Button type="button" variant="ghost" size="sm" onClick={wallet.disconnect}>Disconnect</Button></div>
    )
  }
  return (
    <Button type="button" onClick={() => wallet.connect(0)} disabled={wallet.connecting}>
      {wallet.connecting ? <Spinner /> : <WalletIcon className="size-4" />}Connect wallet
    </Button>
  )
}
