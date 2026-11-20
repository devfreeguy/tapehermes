import { StatusBadge, type Tone } from '@/components/atoms/status-badge'
import type { DelegationState } from '@/lib/api/schemas'
import { useTranslator } from '@/lib/locale-context'

export const DELEGATION_LOOK: Record<DelegationState, { tone: Tone; label: string }> = {
  none: { tone: 'neutral', label: 'No permission' },
  valid: { tone: 'good', label: 'Permission active' },
  expiring: { tone: 'warn', label: 'Expiring soon' },
  expired: { tone: 'bad', label: 'Expired' },
}

/** The delegation state of a site as one badge: none, valid, expiring (7 days or less) or expired. */
export function DelegationBadge({ state }: { state: DelegationState }) {
  const t = useTranslator()
  const l = DELEGATION_LOOK[state]
  return <StatusBadge tone={l.tone}>{t(l.label)}</StatusBadge>
}
