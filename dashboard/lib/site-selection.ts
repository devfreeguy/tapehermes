import { parseSiteParam } from './site-param'

function storageKey(wallet: string) {
  return `tapehermes.selected-site.${wallet.toLowerCase()}`
}

export function readSelectedSite(wallet: string) {
  try {
    return parseSiteParam(localStorage.getItem(storageKey(wallet)) ?? '')
  } catch {
    return null
  }
}

export function rememberSite(wallet: string, site: string) {
  try {
    localStorage.setItem(storageKey(wallet), site)
  } catch {
    // A site can still be selected through its URL when storage is unavailable.
  }
}

export function preferredSite(sites: readonly { name: string }[], remembered: string | null) {
  return sites.find(({ name }) => name === remembered)?.name ?? sites[0]?.name ?? null
}
