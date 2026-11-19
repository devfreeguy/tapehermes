import { SITE_NAME_RE } from '@/config/app'

/** The site name from a URL segment, or null when it is not a well-formed name (the page is then a 404, not an API error). */
export function parseSiteParam(raw: string): string | null {
  let name: string
  try { name = decodeURIComponent(raw) } catch { return null }
  return SITE_NAME_RE.test(name) ? name : null
}
