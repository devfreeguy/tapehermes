/** Site key from a request path of the form /sites/:site/... (undefined if the path has another shape). */
export const siteFromPath = (path: string): string | undefined => /^\/sites\/([^/]+)\//.exec(path)?.[1]

/**
 * A DynamicPayTo for @okxweb3/x402: the receiver wallet is looked up per request from the site in the path.
 * The lookup is the only per-site part; throwing here makes the library refuse the request.
 */
export const payToBySite = (receiverOf: (site: string) => string | undefined) =>
  ({ path }: { path: string }): string => {
    const site = siteFromPath(path)
    const to = site ? receiverOf(site) : undefined
    if (!to) throw new Error(`no receiver wallet for path ${path}`)
    return to
  }
