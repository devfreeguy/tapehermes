import { RoutesSection } from '@/components/sections/routes-section'

export default async function Page({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  return <RoutesSection siteName={decodeURIComponent(name)} />
}
