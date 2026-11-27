import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { ApprovalsClientView } from '@/components/runtime/ApprovalsClientView'
import { authorizeProjectMember } from '@/lib/tunnel/authorize'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ workspace_slug: string; project_slug: string }>
}

/**
 * "Minhas tarefas": as aprovações do bloco "Aguardar aprovação". Quem é o usuário e o que ele pode ver/decidir é conferido
 * pelo servidor em /api/v1/approvals (sessão do app); aqui só se acha o projeto e se sabe se quem abre é o dono (aba "Todas").
 */
export default async function ApprovalsPage({ params }: PageProps) {
  const { workspace_slug, project_slug } = await params
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const { data: workspaces } = await supabase.from('workspaces').select('id').eq('slug', workspace_slug).limit(1)
  const workspace = workspaces?.[0]
  if (!workspace) notFound()
  const { data: projects } = await supabase.from('projects').select('id').eq('slug', project_slug).eq('workspace_id', workspace.id).limit(1)
  const project = projects?.[0]
  if (!project) notFound()

  const isAdmin = !!(await authorizeProjectMember(project.id))

  const h = await headers()
  const isCustomDomain = h.get('x-custom-domain') === 'true'
  const backHref = isCustomDomain ? (h.get('x-custom-domain-type') === 'workspace' ? `/${project_slug}` : '/') : `/${workspace_slug}/${project_slug}`

  return <ApprovalsClientView projectId={project.id} backHref={backHref} isAdmin={isAdmin} />
}
