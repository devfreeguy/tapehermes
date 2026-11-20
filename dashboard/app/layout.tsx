import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { headers } from 'next/headers'
import { ScrollAreaNonceProvider } from '@/components/ui/scroll-area'
import { themeInitializer } from '@/lib/theme'
import { LocaleProvider } from '@/lib/locale-context'
import { getLocale, getTranslator } from '@/lib/server-locale'
import { Providers } from './providers'
import './globals.css'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator()
  return {
    title: { default: 'TapeHermes', template: '%s | TapeHermes' },
    description: t('Run outside calls for your TapeOut site: keep secrets safe, set prices, get paid.'),
    robots: { index: false, follow: false },
  }
}

/**
 * Every page is rendered per request: Next only puts the CSP nonce on its scripts when it renders on demand, and without
 * the nonce a strict CSP blocks every script. `pnpm smoke` checks this against a real build.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const [requestHeaders, locale] = await Promise.all([headers(), getLocale()])
  const nonce = requestHeaders.get('x-nonce') ?? undefined
  return (
    <html lang={locale} className="dark" suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeInitializer }} />
      </head>
      <body className="h-dvh overflow-hidden">
        <LocaleProvider locale={locale}>
          <Providers>
            <ScrollAreaNonceProvider nonce={nonce}>
              {children}
            </ScrollAreaNonceProvider>
          </Providers>
        </LocaleProvider>
      </body>
    </html>
  )
}
