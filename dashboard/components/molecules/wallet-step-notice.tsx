import { useTranslator } from '@/lib/locale-context'
import { ShieldCheck } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import type { WalletStepCopy } from '@/copy/wallet-steps'

/** Shown BEFORE a wallet window opens: what is about to happen, what it costs, and what it cannot do. */
export function WalletStepNotice({ step, presentation }: { step: WalletStepCopy; presentation?: 'dialog' }) {
  const t = useTranslator()
  if (presentation === 'dialog') {
    return (
      <div role="note" data-testid="wallet-step-notice" className="space-y-3 rounded-xl bg-surface/65 p-4 text-sm">
        <p className="font-semibold">{t(step.title)}</p>
        <dl className="space-y-3 leading-relaxed">
          <div><dt className="font-medium">{t('What happens')}</dt><dd className="mt-1 text-muted-foreground">{t(step.whatHappens)}</dd></div>
          <div><dt className="font-medium">{t('Cost')}</dt><dd className="mt-1 text-muted-foreground">{t(step.cost)}</dd></div>
          <div><dt className="font-medium">{t('What it cannot do')}</dt><dd className="mt-1 text-muted-foreground">{t(step.cannotDo)}</dd></div>
        </dl>
      </div>
    )
  }

  return (
    <Alert role="note" data-testid="wallet-step-notice">
      <ShieldCheck className="size-4" />
      <AlertTitle>{t('Your wallet will open:') + ' '}{t(step.title)}</AlertTitle>
      <AlertDescription>
        <dl className="mt-1 grid gap-1 text-sm sm:grid-cols-[7rem_1fr]">
          <dt className="font-medium">{t('What happens')}</dt><dd>{t(step.whatHappens)}</dd>
          <dt className="font-medium">{t('Cost')}</dt><dd>{t(step.cost)}</dd>
          <dt className="font-medium">{t('What it cannot do')}</dt><dd>{t(step.cannotDo)}</dd>
        </dl>
      </AlertDescription>
    </Alert>
  )
}
