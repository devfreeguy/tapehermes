/** The words of the pages the app shows when a page is missing or breaks. Plain, calm, and never a technical message. */
export const NOT_FOUND = {
  title: 'Page not found',
  description: 'There is nothing at this address. The link may be old, or the address may have been typed wrong.',
  home: 'Go to my sites',
  guide: 'Open the guide',
} as const

export const CRASH = {
  title: 'Something went wrong on this page',
  description: 'Nothing was changed on your site. Try again. If it keeps happening, reload the page or come back in a minute.',
  retry: 'Try again',
  home: 'Go to my sites',
  reference: 'Reference',
} as const

/** Shown when even the page frame could not be drawn. */
export const FATAL = {
  title: 'TapeHermes could not load',
  description: 'Nothing was changed on your site. Reload the page. If it keeps happening, come back in a minute.',
  retry: 'Reload',
} as const
