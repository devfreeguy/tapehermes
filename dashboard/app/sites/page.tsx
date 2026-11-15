import { RequireSession } from '@/components/molecules/require-session'
import { SitesSection } from '@/components/sections/sites-section'

export const metadata = { title: 'My sites' }
export default function SitesPage() { return <RequireSession><SitesSection /></RequireSession> }
