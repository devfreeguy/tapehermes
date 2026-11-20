import Link from 'next/link'
import { AuthIllustration } from '@/components/atoms/auth-illustration'
import { BrandWordmark } from '@/components/atoms/brand-wordmark'
import { HomeRedirect } from '@/components/molecules/home-redirect'
import { AuthWalletSection } from '@/components/sections/auth-wallet-section'
import { Button } from '@/components/ui/button'

export default function HomePage() {
  return (
    <>
      <HomeRedirect />
      <section aria-labelledby="auth-title" className="auth-screen grid min-h-[calc(100dvh-2rem)] place-items-center rounded-2xl border border-border bg-card px-5 py-6 font-(family-name:--font-auth) max-[360px]:py-3 sm:min-h-[calc(100dvh-4rem)] sm:px-10 lg:min-h-dvh lg:grid-cols-2 lg:rounded-none lg:border-0 lg:p-0">
        <AuthIllustration />
        <div className="w-full lg:grid lg:h-full lg:place-items-center lg:bg-background">
          <div className="mx-auto w-full max-w-md space-y-5 max-[360px]:space-y-3 sm:space-y-7 lg:w-[calc(100%-3rem)] xl:max-w-lg">
            <BrandWordmark />
            <div className="space-y-3">
              <h1 id="auth-title" className="font-(family-name:--font-auth) text-4xl leading-tight font-extrabold max-[360px]:text-3xl sm:text-5xl">
                Keep your API keys <span className="font-(family-name:--font-auth-highlight) font-normal text-primary-action">private.</span>
              </h1>
              <p className="text-base leading-relaxed text-muted-foreground">
                Offer paid actions on your TapeOut site, like AI document summaries, while keeping your provider keys private. Connect your wallet to get started.
              </p>
            </div>
            <AuthWalletSection secondaryAction={
              <Button asChild variant="outline" className="pill-control">
                <Link href="/guide">Read the guide</Link>
              </Button>
            } />
          </div>
        </div>
      </section>
    </>
  )
}
