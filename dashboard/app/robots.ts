import type { MetadataRoute } from 'next'

/** An owner dashboard: nothing in it is for search engines. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', disallow: '/' } }
}
