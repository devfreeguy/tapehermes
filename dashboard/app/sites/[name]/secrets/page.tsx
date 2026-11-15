import { SecretsSection } from '@/components/sections/secrets-section'

export default async function Page({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  return <SecretsSection siteName={decodeURIComponent(name)} />
}
