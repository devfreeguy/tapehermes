import { SelectedSiteView } from '@/components/sections/selected-site-view'
import { RouteEditorSection } from '@/components/sections/route-editor-section'

export default async function Page({ params }: { params: Promise<{ route: string }> }) {
  const { route } = await params
  return <SelectedSiteView><RouteEditorSection routeName={route} /></SelectedSiteView>
}
