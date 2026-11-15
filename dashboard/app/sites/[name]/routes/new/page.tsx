import { RouteEditorSection } from '@/components/sections/route-editor-section'

export default async function Page({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  return <RouteEditorSection siteName={decodeURIComponent(name)} />
}
