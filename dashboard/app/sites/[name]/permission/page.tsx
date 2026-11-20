import { DelegationSection } from '@/components/sections/delegation-section'

export default async function Page({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  return <DelegationSection siteName={decodeURIComponent(name)} />
}
