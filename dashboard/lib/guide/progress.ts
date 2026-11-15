import { GUIDE_STEPS, type GuideStep } from '@/copy/guide'
import type { StepState } from '@/components/molecules/step-item'
import type { DelegationState, ManifestState } from '@/lib/api/schemas'

export interface GuideFacts {
  signedIn: boolean
  /** The site being set up, or null when the owner has none yet. */
  hasSite: boolean
  secretCount: number
  secretSkipped: boolean
  routeCount: number
  delegation: DelegationState | null
  manifest: ManifestState | null
}

/** Which of the guided steps are done. The optional secret step counts as done once there is a secret, a route, or the owner skipped it. */
export function stepsDone(f: GuideFacts): Record<GuideStep['id'], boolean> {
  const signin = f.signedIn
  const register = signin && f.hasSite
  const secret = register && (f.secretCount > 0 || f.secretSkipped || f.routeCount > 0)
  const route = register && f.routeCount > 0
  const delegation = route && (f.delegation === 'valid' || f.delegation === 'expiring')
  const publish = delegation && f.manifest === 'current'
  return { signin, register, secret, route, delegation, publish, live: publish }
}

/** Each step as done, current (the first one not done) or upcoming. When all are done the last step stays current, so its next-action link shows. */
export function guideStates(f: GuideFacts): { step: GuideStep; state: StepState }[] {
  const done = stepsDone(f)
  const open = GUIDE_STEPS.findIndex((s) => !done[s.id])
  const current = open === -1 ? GUIDE_STEPS.length - 1 : open
  return GUIDE_STEPS.map((step, i) => ({ step, state: i === current ? 'current' : done[step.id] ? 'done' : 'upcoming' }))
}
