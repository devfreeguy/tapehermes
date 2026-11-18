import { vi } from 'vitest'
import { S } from './sections-state'

/**
 * Import this file BEFORE the section under test. It replaces the hooks (which talk to the server and the wallet) with the
 * values in S, so a section can be rendered in any state without a network or a wallet.
 */
vi.mock('next/navigation', () => ({ useRouter: () => S.router, usePathname: () => '/sites/1.2.396.tape' }))
vi.mock('next/link', () => import('./mocks/next-link'))
vi.mock('@/hooks/use-wallet', () => ({ useWallet: () => S.wallet }))
vi.mock('@/lib/session/session-context', () => ({ useSession: () => S.session }))
vi.mock('@/hooks/use-sign-in', () => ({ useSignIn: () => S.signInMutation }))
vi.mock('@/hooks/use-sites', () => ({
  useSite: () => S.site, useSites: () => S.sites, useRegisterSite: () => S.register, useSetPayout: () => S.setPayout, useSetSiteStatus: () => S.setStatus,
}))
vi.mock('@/hooks/use-delegation-signing', () => ({ useDelegationSigning: () => S.signing }))
vi.mock('@/hooks/use-publish-manifest', () => ({ usePublishManifest: () => S.publish }))
vi.mock('@/hooks/use-manifest', () => ({ useManifestPreview: () => S.preview, useManifestStatus: () => S.status }))
vi.mock('@/hooks/use-activation', () => ({ useActivation: () => S.activation, useRecheckActivation: () => S.recheck, useSwitchOn: () => S.switchOn }))
vi.mock('@/hooks/use-secrets', () => ({ useSecrets: () => S.secrets, useSecretActions: () => S.secretActions }))
vi.mock('@/hooks/use-routes', () => ({ useRoutes: () => S.routes, useRouteActions: () => S.routeActions }))
vi.mock('@/hooks/use-logs', () => ({ useLogs: () => S.logs, useLogSummary: () => S.summary }))
