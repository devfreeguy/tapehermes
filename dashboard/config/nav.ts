export const NAV_ITEMS = [
  { href: '/sites', label: 'My sites' },
  { href: '/guide', label: 'Guided setup' },
] as const

/** The tabs inside one site, in the order an owner meets them. */
export const SITE_TABS = [
  { path: '', label: 'Overview' },
  { path: '/secrets', label: 'Secrets' },
  { path: '/routes', label: 'Routes' },
  { path: '/delegation', label: 'Delegation' },
  { path: '/manifest', label: 'Manifest' },
  { path: '/logs', label: 'Call log' },
] as const
