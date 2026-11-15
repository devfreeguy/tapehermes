import { StatusBadge, type Tone } from '@/components/atoms/status-badge'
import type { DelegationState } from '@/lib/api/schemas'

const LOOK: Record<DelegationState, { tone: Tone; label: string }> = {
  none: { tone: 'neutral', label: 'No delegation' },
  valid: { tone: 'good', label: 'Valid' },
  expiring: { tone: 'warn', label: 'Expiring soon' },
  expired: { tone: 'bad', label: 'Expired' },
}

/** The delegation state of a site as one badge: none, valid, expiring (7 days or less) or expired. */
export function DelegationBadge({ state }: { state: DelegationState }) {
  const l = LOOK[state]
  return <StatusBadge tone={l.tone}>{l.label}</StatusBadge>
}
