import { HintText } from '@/components/atoms/hint-text'
import { HomeRedirect } from '@/components/molecules/home-redirect'
import { SignInSection } from '@/components/sections/sign-in-section'

export default function HomePage() {
  return (
    <div className="space-y-8">
      <div className="mx-auto max-w-xl space-y-3 text-center">
        <h1 className="text-3xl font-semibold">Keep your API keys off the chain.</h1>
        <HintText>TapeHermes runs outside calls for your TapeOut site on X Layer. You save the secret keys, set the routes and prices, and every answer is signed so visitors can check it came from your site.</HintText>
      </div>
      <HomeRedirect />
      <SignInSection />
    </div>
  )
}
