import { RouteEditorSection } from '@/components/sections/route-editor-section'

export default async function Page({ params }: { params: Promise<{ name: string; route: string }> }) {
  const { name, route } = await params
  return <RouteEditorSection siteName={decodeURIComponent(name)} routeName={decodeURIComponent(route)} />
}
