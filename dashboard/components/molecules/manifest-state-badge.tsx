import { StatusBadge, type Tone } from '@/components/atoms/status-badge'
import type { ManifestState } from '@/lib/api/schemas'

export const MANIFEST_LOOK: Record<ManifestState, { tone: Tone; label: string; sentence: string }> = {
  'not-ready': { tone: 'neutral', label: 'Not ready', sentence: 'Follow the steps below to get your API list ready.' },
  'not-published': { tone: 'warn', label: 'Not published', sentence: 'Apps cannot read your API list yet. Publish it so they can find your actions.' },
  current: { tone: 'good', label: 'Up to date', sentence: 'The list on X Layer matches your saved actions, prices, and signing permission.' },
  'out-of-date': { tone: 'bad', label: 'Out of date', sentence: 'You changed your settings after you last published. Publish again so apps see the latest actions, prices, and signing permission.' },
}

export function ManifestStateBadge({ state }: { state: ManifestState }) {
  const l = MANIFEST_LOOK[state]
  return <StatusBadge tone={l.tone}>{l.label}</StatusBadge>
}
