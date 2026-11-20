'use client'

import Link from 'next/link'
import { StepItem } from '@/components/molecules/step-item'
import { WalletStepNotice } from '@/components/molecules/wallet-step-notice'
import { Button } from '@/components/ui/button'
import type { GuideStep } from '@/copy/guide'
import { WALLET_STEPS } from '@/copy/wallet-steps'
import { guideStates, type GuideFacts } from '@/lib/guide/progress'
import { useSession } from '@/lib/session/session-context'
import { rememberSite } from '@/lib/site-selection'
import { RegisterSiteForm } from './register-site-form'
import { SignInSection } from './sign-in-section'

const WALLET_NOTICE: Partial<Record<GuideStep['id'], keyof typeof WALLET_STEPS>> = { signin: 'signIn', activate: 'switchOn', delegation: 'delegation', publish: 'publish' }

/**
 * The eight steps from sign-in to a live route. Each step says WHY first; steps that open the wallet show what will happen,
 * what it costs and what it cannot do BEFORE the button that opens it. The real work happens on the same pages as always.
 */
export function GuideSteps({ facts, site, onSkipSecret }: { facts: GuideFacts; site: string | null; onSkipSecret: () => void }) {
  const { session } = useSession()
  const base = '/sites'
  const selectSite = () => { if (session && site) rememberSite(session.wallet, site) }
  const action = (id: GuideStep['id']) => {
    switch (id) {
      case 'signin': return <SignInSection onDone={() => undefined} />
      case 'register': return <RegisterSiteForm />
      case 'activate': return <Button asChild><Link href={base} onNavigate={selectSite}>Go to switch on</Link></Button>
      case 'secret': return (<div className="flex gap-2"><Button asChild><Link href={`${base}/secrets`} onNavigate={selectSite}>Add a secret</Link></Button><Button type="button" variant="ghost" onClick={onSkipSecret}>My service needs no key</Button></div>)
      case 'route': return <Button asChild><Link href={`${base}/routes/new`} onNavigate={selectSite}>Create a route</Link></Button>
      case 'delegation': return <Button asChild><Link href={`${base}/delegation`} onNavigate={selectSite}>Go to delegation</Link></Button>
      case 'publish': return <Button asChild><Link href={`${base}/manifest`} onNavigate={selectSite}>Go to publish</Link></Button>
      case 'live': return <Button asChild variant="outline"><Link href={`${base}/logs`} onNavigate={selectSite}>Open the call log</Link></Button>
    }
  }
  return (
    <ol className="space-y-3">
      {guideStates(facts).map(({ step, state }, i) => (
        <StepItem key={step.id} number={i + 1} title={step.title} why={step.why} state={state} optional={step.optional}>
          <div className="space-y-3">
            {WALLET_NOTICE[step.id] && step.id !== 'signin' ? <WalletStepNotice step={WALLET_STEPS[WALLET_NOTICE[step.id]!]} /> : null}
            {action(step.id)}
          </div>
        </StepItem>
      ))}
    </ol>
  )
}
