import { SiteOverviewSection } from '@/components/sections/site-overview-section'

export default async function Page({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  return <SiteOverviewSection siteName={decodeURIComponent(name)} />
}
