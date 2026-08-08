import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { SourceCodeGenerator } from '@/utils/export/SourceCodeGenerator'

export async function POST(request: Request) {
  try {
    const { workspaceId, dataMode = 'supabase', authStrategy = 'managed', legacyDriver = 'supabase' } = await request.json()
    const supabase = await createClient()

    // 1. Authenticate
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    if (!workspaceId) {
      return NextResponse.json({ error: 'ID do workspace obrigatório' }, { status: 400 })
    }

    // 2. Fetch Workspace Config
    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .single()

    if (wsError || !workspace) {
      return NextResponse.json({ error: 'Workspace não encontrado' }, { status: 404 })
    }

    // 3. Fetch all projects in the workspace
    const { data: projects, error: projError } = await supabase
      .from('projects')
      .select('*')
      .eq('workspace_id', workspaceId)

    if (projError || !projects || projects.length === 0) {
      return NextResponse.json({ error: 'Nenhum projeto encontrado neste workspace' }, { status: 404 })
    }

    // Master File Map
    const masterFileMap: Record<string, string> = {}

    // Process each project
    for (const project of projects) {
      const projectId = project.id;
      
      // Fetch Models
      const { data: models } = await supabase
        .from('models')
        .select('*, fields(*), ui_views(*)')
        .eq('project_id', projectId)
        
      // Fetch BYOC (Custom Components)
      const { data: customComponents } = await supabase
        .from('ui_custom_components')
        .select('*')
        .eq('project_id', projectId)

      // Fetch all UI Views
      const { data: uiViews } = await supabase
        .from('ui_views')
        .select('*')
        .eq('project_id', projectId)
        .eq('status', 'published')
        .order('created_at', { ascending: true })

      let finalUiViews = uiViews
      if (!finalUiViews || finalUiViews.length === 0) {
        const { data: allViews } = await supabase
          .from('ui_views')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: true })
        finalUiViews = allViews
      }

      const mappedModels = (models || []).map((m: any) => {
        const mappedFields = (m.fields || []).map((f: any) => ({
          id: f.id,
          column_name: f.db_column_name,
          label: f.display_name,
          field_type: f.data_type,
          list_visible: f.is_visible_in_list !== false,
          form_visible: f.is_visible_in_form !== false,
          required: !f.is_nullable,
          config: f.config || {}
        }))

        return {
          ...m,
          table_name: m.db_table_name,
          db_table_name: m.db_table_name,
          name: m.display_name,
          ui_fields: mappedFields,
          ui_views: m.ui_views || []
        }
      })

      // Fetch Roles and Permissions
      const { data: projectRoles } = await supabase
        .from('project_roles')
        .select('*')
        .eq('project_id', projectId)

      let rolePermissions: any[] = []
      if (projectRoles && projectRoles.length > 0) {
        const { data: perms } = await supabase
          .from('project_role_permissions')
          .select('*')
          .in('role_id', projectRoles.map((r: any) => r.id))
        if (perms) rolePermissions = perms
      }

      // Fetch Enumerations
      const { data: enumerations } = await supabase
        .from('project_enumerations')
        .select('*')
        .eq('project_id', projectId)

      // Fetch Relations
      const { data: rawProjectRelations } = await supabase
        .from('relations')
        .select('*')
        .eq('project_id', projectId)

      // Generate the Source Code map for THIS project
      const generator = new SourceCodeGenerator(
        project, 
        mappedModels, 
        finalUiViews || [], 
        customComponents || [], 
        dataMode, 
        authStrategy, 
        legacyDriver, 
        null, 
        projectRoles || [], 
        rolePermissions, 
        enumerations || [], 
        rawProjectRelations || []
      )
      
      const projectFileMap = await generator.generateFileMap()
      
      // Add project files to master map, prefixed with project slug
      const projectPrefix = project.slug || 'project'
      for (const [path, content] of Object.entries(projectFileMap)) {
        masterFileMap[`${projectPrefix}/${path}`] = content
      }
    }

    // Return as JSON map
    return NextResponse.json(masterFileMap)

  } catch (err: any) {
    console.error('[WorkspaceSource] Error:', err)
    return NextResponse.json({ error: err.message || 'Erro interno ao gerar código' }, { status: 500 })
  }
}
