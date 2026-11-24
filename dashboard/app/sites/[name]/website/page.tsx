import { WebsiteSection } from '@/components/sections/website-section'

export default async function Page({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  return <WebsiteSection siteName={decodeURIComponent(name)} />
}
