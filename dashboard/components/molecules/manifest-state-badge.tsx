import { StatusBadge, type Tone } from '@/components/atoms/status-badge'
import type { ManifestState } from '@/lib/api/schemas'

export const MANIFEST_LOOK: Record<ManifestState, { tone: Tone; label: string; sentence: string }> = {
  'not-ready': { tone: 'neutral', label: 'Not ready', sentence: 'There is nothing to publish yet. Finish the points below first.' },
  'not-published': { tone: 'warn', label: 'Not published', sentence: 'Nothing is published on chain yet. Visitors cannot use your routes until you publish.' },
  current: { tone: 'good', label: 'Up to date', sentence: 'The manifest on chain matches your routes, prices and delegation.' },
  'out-of-date': { tone: 'bad', label: 'Out of date', sentence: 'The manifest on chain is older than your settings. Publish again so visitors see the current routes, prices and delegation.' },
}

export function ManifestStateBadge({ state }: { state: ManifestState }) {
  const l = MANIFEST_LOOK[state]
  return <StatusBadge tone={l.tone}>{l.label}</StatusBadge>
}
