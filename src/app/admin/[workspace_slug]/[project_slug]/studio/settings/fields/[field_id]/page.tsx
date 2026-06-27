import { createClient } from '@/utils/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { FieldSettingsClient } from './FieldSettingsClient'

interface FieldSettingsProps {
  params: Promise<{
    workspace_slug: string
    project_slug: string
    field_id: string
  }>
}

export default async function FieldSettings({ params }: FieldSettingsProps) {
  const { workspace_slug, project_slug, field_id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 1. Resolve Workspace
  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('*')
    .eq('slug', workspace_slug)
    .single()

  if (workspaceError || !workspace) {
    notFound()
  }

  // 2. Resolve Project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('slug', project_slug)
    .eq('workspace_id', workspace.id)
    .single()

  if (projectError || !project) {
    notFound()
  }

  // 3. Resolve Field
  const { data: field, error: fieldError } = await supabase
    .from('fields')
    .select('*, models(id, db_table_name, display_name)')
    .eq('id', field_id)
    .single()

  if (fieldError || !field) {
    notFound()
  }

  // 4. Resolve global models and relations to pass to the client (for formulas, relations, enums etc)
  const { data: models } = await supabase
    .from('models')
    .select('*, fields(*)')
    .eq('project_id', project.id)

  const { data: relations } = await supabase
    .from('relations')
    .select('*')
    .eq('project_id', project.id)

  const { data: enumerations } = await supabase
    .from('enumerations')
    .select('id, name, values')
    .eq('project_id', project.id)

  return (
    <FieldSettingsClient
      workspace={workspace}
      project={project}
      field={field}
      models={models || []}
      relations={relations || []}
      enumerations={enumerations || []}
      workspace_slug={workspace_slug}
      project_slug={project_slug}
    />
  )
}
