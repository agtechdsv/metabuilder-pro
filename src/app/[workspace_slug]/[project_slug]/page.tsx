import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

interface ProjectPageProps {
  params: Promise<{
    workspace_slug: string
    project_slug: string
  }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function ProjectRootPage({ params, searchParams }: ProjectPageProps) {
  const { workspace_slug, project_slug } = await params
  const resolvedSearchParams = await searchParams
  
  const headersList = await headers()
  const isCustomDomain = headersList.get('x-custom-domain') === 'true'
  const customDomainType = headersList.get('x-custom-domain-type')
  
  const isStandalone = resolvedSearchParams?.standalone === 'true'
  const appendParams = isStandalone ? '?standalone=true' : ''

  if (isCustomDomain && customDomainType !== 'workspace') {
    redirect(`/dashboard${appendParams}`)
  } else if (isCustomDomain && customDomainType === 'workspace') {
    redirect(`/${project_slug}/dashboard${appendParams}`)
  } else {
    redirect(`/${workspace_slug}/${project_slug}/dashboard${appendParams}`)
  }
}
