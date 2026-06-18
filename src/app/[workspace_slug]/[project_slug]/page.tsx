import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

interface ProjectPageProps {
  params: Promise<{
    workspace_slug: string
    project_slug: string
  }>
}

export default async function ProjectRootPage({ params }: ProjectPageProps) {
  const { workspace_slug, project_slug } = await params
  
  const headersList = await headers()
  const isCustomDomain = headersList.get('x-custom-domain') === 'true'

  if (isCustomDomain) {
    redirect('/dashboard')
  } else {
    redirect(`/${workspace_slug}/${project_slug}/dashboard`)
  }
}
