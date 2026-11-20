import type { NextConfig } from 'next'

const previousDashboardPaths = [
  ['secrets', 'keys'],
  ['routes', 'actions'],
  ['routes/:action', 'actions/:action'],
  ['delegation', 'permission'],
  ['manifest', 'api-list'],
  ['logs', 'call-log'],
] as const

const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  // The development indicator injects style tags without the request nonce.
  devIndicators: false,
  // The generated AGENTS.md contains punctuation forbidden by the dashboard conventions.
  agentRules: false,
  async redirects() {
    // Keep the site name on older bookmarks so the dashboard can select that site after sign-in.
    return ['/sites', '/sites/:site'].flatMap((base) =>
      previousDashboardPaths.map(([previous, current]) => ({
        source: `${base}/${previous}`,
        destination: `${base}/${current}`,
        permanent: true,
      })),
    )
  },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'no-referrer' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      ],
    }]
  },
}
export default config
