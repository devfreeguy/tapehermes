import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { headers } from 'next/headers'
import { ScrollAreaNonceProvider } from '@/components/ui/scroll-area'
import { themeInitializer } from '@/lib/theme'
import { LocaleProvider } from '@/lib/locale-context'
import { getLocale } from '@/lib/server-locale'
import { Providers } from './providers'
import './globals.css'

const siteTitle = 'TapeHermes | TapeOut 站点的付费 API'
const siteDescription = '为 TapeOut 站点添加可按次收费的 API 操作。保护服务商密钥，自主定价，并通过 X Layer 收款。'
const shareImage = {
  url: '/brand/sign-in-preview.jpg',
  width: 1200,
  height: 630,
  alt: 'TapeHermes 中文登录页，左侧为安全插图，右侧可连接钱包。',
}

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers()
  const host = requestHeaders.get('host')
  const protocol = requestHeaders.get('x-forwarded-proto') === 'http' ? 'http' : 'https'
  const origin = host ? `${protocol}://${host}` : undefined
  return {
    metadataBase: origin && URL.canParse(origin) ? new URL(origin) : undefined,
    title: { default: siteTitle, template: '%s | TapeHermes' },
    description: siteDescription,
    openGraph: {
      type: 'website',
      locale: 'zh_CN',
      siteName: 'TapeHermes',
      title: siteTitle,
      description: siteDescription,
      images: [shareImage],
    },
    twitter: { card: 'summary_large_image', title: siteTitle, description: siteDescription, images: [shareImage] },
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
