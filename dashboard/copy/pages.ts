/** The words of the pages the app shows when a page is missing or breaks. Plain, calm, and never a technical message. */
export const NOT_FOUND = {
  title: 'Page not found',
  description: 'This page may have moved, or the link may be incomplete. You can return to your sites or open the setup guide.',
  home: 'Go to my sites',
  guide: 'Open the guide',
} as const

export const CRASH = {
  title: 'Something went wrong on this page',
  description: 'Try loading this page again. If the problem continues, use the reference below when reporting it, if one is shown.',
  retry: 'Try again',
  home: 'Go to my sites',
  reference: 'Reference',
} as const

/** Shown when even the page frame could not be drawn. */
export const FATAL = {
  title: 'TapeHermes could not load',
  description: 'Reload the dashboard to try again. If the problem continues, return to the sign-in page.',
  retry: 'Reload page',
  home: 'Back to sign-in',
} as const
