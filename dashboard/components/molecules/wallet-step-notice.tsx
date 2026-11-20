import { ShieldCheck } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import type { WalletStepCopy } from '@/copy/wallet-steps'

/** Shown BEFORE a wallet window opens: what is about to happen, what it costs, and what it cannot do. */
export function WalletStepNotice({ step, presentation }: { step: WalletStepCopy; presentation?: 'dialog' }) {
  if (presentation === 'dialog') {
    return (
      <div role="note" data-testid="wallet-step-notice" className="space-y-3 rounded-xl bg-surface/65 p-4 text-sm">
        <p className="font-semibold">{step.title}</p>
        <dl className="space-y-3 leading-relaxed">
          <div><dt className="font-medium">What happens</dt><dd className="mt-1 text-muted-foreground">{step.whatHappens}</dd></div>
          <div><dt className="font-medium">Cost</dt><dd className="mt-1 text-muted-foreground">{step.cost}</dd></div>
          <div><dt className="font-medium">What it cannot do</dt><dd className="mt-1 text-muted-foreground">{step.cannotDo}</dd></div>
        </dl>
      </div>
    )
  }

  return (
    <Alert role="note" data-testid="wallet-step-notice">
      <ShieldCheck className="size-4" />
      <AlertTitle>Your wallet will open: {step.title}</AlertTitle>
      <AlertDescription>
        <dl className="mt-1 grid gap-1 text-sm sm:grid-cols-[7rem_1fr]">
          <dt className="font-medium">What happens</dt><dd>{step.whatHappens}</dd>
          <dt className="font-medium">Cost</dt><dd>{step.cost}</dd>
          <dt className="font-medium">What it cannot do</dt><dd>{step.cannotDo}</dd>
        </dl>
      </AlertDescription>
    </Alert>
  )
}
