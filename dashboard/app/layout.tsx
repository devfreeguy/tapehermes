import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { connection } from 'next/server'
import { AppHeader } from '@/components/sections/app-header'
import { Providers } from './providers'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'TapeHermes', template: '%s | TapeHermes' },
  description: 'Run outside calls for your TapeOut site: keep secrets safe, set prices, get paid.',
}

/**
 * Dark is the default look (the "Tape" direction); the tokens also define a light theme.
 * Every page is rendered per request: Next only puts the CSP nonce on its scripts when it renders on demand, and without
 * the nonce a strict CSP blocks every script. `pnpm smoke` checks this against a real build.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  await connection()
  return (
    <html lang="en" className="dark">
      <body>
        <Providers>
          <AppHeader />
          <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        </Providers>
      </body>
    </html>
  )
}
