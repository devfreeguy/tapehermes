import { ManifestSection } from '@/components/sections/manifest-section'

export default async function Page({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  return <ManifestSection siteName={decodeURIComponent(name)} />
}
