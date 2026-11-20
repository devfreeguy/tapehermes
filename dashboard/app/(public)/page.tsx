import Link from 'next/link'
import { BrandWordmark } from '@/components/atoms/brand-wordmark'
import { HomeRedirect } from '@/components/molecules/home-redirect'
import { AuthWalletSection } from '@/components/sections/auth-wallet-section'
import { Button } from '@/components/ui/button'

export default function HomePage() {
  return (
    <>
      <HomeRedirect />
      <section aria-labelledby="auth-title" className="grid min-h-[calc(100dvh-2rem)] place-items-center rounded-2xl border border-border bg-card px-5 py-6 font-(family-name:--font-auth) max-[360px]:py-3 sm:min-h-[calc(100dvh-4rem)] sm:px-10">
        <div className="w-full max-w-md space-y-5 max-[360px]:space-y-3 sm:space-y-7">
          <BrandWordmark />
          <div className="space-y-3">
            <h1 id="auth-title" className="font-(family-name:--font-auth) text-4xl leading-tight font-extrabold max-[360px]:text-3xl sm:text-5xl">
              Keep your API keys <span className="font-(family-name:--font-auth-highlight) font-normal text-primary-action">off the chain.</span>
            </h1>
            <p className="text-base leading-relaxed text-muted-foreground">
              TapeHermes runs signed API calls for your TapeOut site on X Layer. Connect your wallet to manage secrets, routes, and pricing.
            </p>
          </div>
          <AuthWalletSection secondaryAction={
            <Button asChild variant="outline" className="pill-control">
              <Link href="/guide">Read the guide</Link>
            </Button>
          } />
        </div>
      </section>
    </>
  )
}
