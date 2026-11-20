'use client'

import Link from 'next/link'
import { Dialog } from 'radix-ui'
import { ActionDialog } from '@/components/molecules/action-dialog'
import { StepItem } from '@/components/molecules/step-item'
import { WalletStepNotice } from '@/components/molecules/wallet-step-notice'
import { Button } from '@/components/ui/button'
import type { GuideStep } from '@/copy/guide'
import { WALLET_STEPS } from '@/copy/wallet-steps'
import { guideStates, stepsDone, type GuideFacts } from '@/lib/guide/progress'
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
  const steps = guideStates(facts)
  const done = stepsDone(facts)
  const completed = steps.filter(({ step }) => done[step.id]).length
  const action = (id: GuideStep['id']) => {
    switch (id) {
      case 'signin': return <SignInSection onDone={() => undefined} />
      case 'register': return (
        <ActionDialog title="Add your site" description="Enter the name of the TapeOut site your wallet owns."
          trigger={<Button type="button" className="pill-control">Add your site</Button>}
        >
          <RegisterSiteForm presentation="viewer" />
          <Dialog.Close asChild><Button type="button" variant="outline" className="pill-control w-full">Close</Button></Dialog.Close>
        </ActionDialog>
      )
      case 'activate': return <Button asChild className="pill-control"><Link href={base} onNavigate={selectSite}>Open site settings</Link></Button>
      case 'secret': return (<div className="flex flex-wrap gap-2"><Button asChild className="pill-control"><Link href={`${base}/keys`} onNavigate={selectSite}>Open Keys</Link></Button><Button type="button" variant="ghost" className="pill-control" onClick={onSkipSecret}>My service needs no key</Button></div>)
      case 'route': return <Button asChild className="pill-control"><Link href={`${base}/actions/new`} onNavigate={selectSite}>Add an action</Link></Button>
      case 'delegation': return <Button asChild className="pill-control"><Link href={`${base}/permission`} onNavigate={selectSite}>Open Permission</Link></Button>
      case 'publish': return <Button asChild className="pill-control"><Link href={`${base}/api-list`} onNavigate={selectSite}>Open API List</Link></Button>
      case 'live': return <Button asChild variant="outline" className="pill-control"><Link href={`${base}/call-log`} onNavigate={selectSite}>Open Call Log</Link></Button>
    }
  }
  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-(family-name:--font-auth) text-base font-semibold">Setup progress</h2>
          <span className="text-sm text-muted-foreground">{completed} of {steps.length} complete</span>
        </div>
        <div role="progressbar" aria-label="Setup progress" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={steps.length} className="grid grid-cols-8 gap-1">
          {steps.map(({ step }) => <span key={step.id} className={done[step.id] ? 'h-1.5 rounded-full bg-primary-action' : 'h-1.5 rounded-full bg-surface'} />)}
        </div>
      </div>
      <ol className="space-y-3">
        {steps.map(({ step, state }, i) => (
          <StepItem key={step.id} number={i + 1} title={step.title} why={step.why} state={state} optional={step.optional}>
            <div className="space-y-3">
              {WALLET_NOTICE[step.id] && step.id !== 'signin' ? <WalletStepNotice step={WALLET_STEPS[WALLET_NOTICE[step.id]!]} presentation="dialog" /> : null}
              {action(step.id)}
            </div>
          </StepItem>
        ))}
      </ol>
    </div>
  )
}
