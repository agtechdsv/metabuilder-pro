import { redirect } from 'next/navigation'

interface ProjectPageProps {
  params: Promise<{
    workspace_slug: string
    project_slug: string
  }>
}

export default async function ProjectRootPage({ params }: ProjectPageProps) {
  const { workspace_slug, project_slug } = await params
  redirect(`/${workspace_slug}/${project_slug}/dashboard`)
}
