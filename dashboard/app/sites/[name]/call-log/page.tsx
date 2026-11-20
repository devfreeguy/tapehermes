import { CallLogSection } from '@/components/sections/call-log-section'

export default async function Page({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  return <CallLogSection siteName={decodeURIComponent(name)} />
}
