import { SITE_TERMS } from '@/copy/site-terms'

export const NAV_ITEMS = [
  { href: '/sites', label: 'My sites' },
  { href: '/guide', label: 'Guided setup' },
] as const

/** The tabs inside one site, in the order an owner meets them. */
export const SITE_TABS = [
  { path: '', label: 'Overview' },
  { path: '/keys', label: SITE_TERMS.secrets.label },
  { path: '/actions', label: SITE_TERMS.routes.label },
  { path: '/permission', label: SITE_TERMS.delegation.label },
  { path: '/api-list', label: SITE_TERMS.manifest.label },
  { path: '/call-log', label: SITE_TERMS.logs.label },
] as const
