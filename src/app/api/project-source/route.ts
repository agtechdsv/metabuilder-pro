import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { SourceCodeGenerator } from '@/utils/export/SourceCodeGenerator'

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const projectId = payload.projectId
    const dataMode = payload.dataMode
    let authStrategy = payload.authStrategy // Será resolvido após carregar o projeto
    const legacyDriver = payload.legacyDriver
    const dbConfig = payload.dbConfig
    const authConfig = payload.authConfig
    const supabase = await createClient()

    // 1. Authenticate
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // 2. Fetch Project Config
    const { data: project, error: projError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (projError || !project) {
      return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })
    }

    if (authConfig) {
      project.auth_config = { ...(project.auth_config || {}), ...authConfig }
    } else {
      // Busca as configurações de autenticação salvas no banco
      const { data: dbAuthConfig } = await supabase
        .from('project_auth_config')
        .select('auth_config')
        .eq('project_id', projectId)
        .single()
      
      if (dbAuthConfig && dbAuthConfig.auth_config) {
        project.auth_config = { ...(project.auth_config || {}), ...dbAuthConfig.auth_config }
      }
    }

    // 3. Fetch Models to generate Features (including fields and views)
    const { data: models } = await supabase
      .from('models')
      .select('*, fields(*), ui_views(*)')
      .eq('project_id', projectId)
      
    // 3.5 Fetch BYOC (Custom Components)
    const { data: customComponents } = await supabase
      .from('ui_custom_components')
      .select('*')
      .eq('project_id', projectId)

    // 3.6 Fetch all UI Views independently to drive the export logic
    const { data: uiViews } = await supabase
      .from('ui_views')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'published') // Somente views publicadas
      .order('created_at', { ascending: true })

    // Se não tiver views publicadas, pega todas (fallback temporário)
    let finalUiViews = uiViews
    if (!finalUiViews || finalUiViews.length === 0) {
      const { data: allViews } = await supabase
        .from('ui_views')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true })
      finalUiViews = allViews
    }

    // Mapear os modelos do banco de dados (models e fields) para o formato esperado pelo exportador
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
        db_table_name: m.db_table_name,  // keep both so runtime lookups work
        name: m.display_name,
        ui_fields: mappedFields,
        ui_views: m.ui_views || []
      }
    })

    // 3.7 Fetch Roles and Permissions
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

    // 3.8 Fetch Enumerations
    const { data: enumerations } = await supabase
      .from('project_enumerations')
      .select('*')
      .eq('project_id', projectId)

    // 3.9 Fetch Relations
    const { data: rawProjectRelations } = await supabase
      .from('relations')
      .select('*')
      .eq('project_id', projectId)

    const finalDataMode = dataMode || project.data_mode || 'supabase'
    const finalLegacyDriver = legacyDriver || project.legacy_db_driver || 'supabase'
    const finalAuthStrategy = authStrategy || project.auth_strategy || 'managed'
    let finalDbConfig = dbConfig
      
    // Se dbConfig não foi fornecido via API (ex: Sincronização automática via IDE), 
    // monta o dbConfig lendo as configurações salvas no banco de dados do projeto.
    if (!finalDbConfig && project.legacy_db_driver) {
      finalDbConfig = {
        host: project.legacy_db_host,
        port: project.legacy_db_port,
        user: project.legacy_db_user,
        password: project.legacy_db_password,
        database: project.legacy_db_name,
        url: project.legacy_db_url
      }
    }

    // 4. Generate the Source Code (File Map)
    const generator = new SourceCodeGenerator(project, mappedModels, finalUiViews || [], customComponents || [], finalDataMode, finalAuthStrategy, finalLegacyDriver, finalDbConfig, projectRoles || [], rolePermissions, enumerations || [], rawProjectRelations || [])
    const fileMap = await generator.generateFileMap()

    // 5. Return as JSON
    return NextResponse.json(fileMap)

  } catch (err: any) {
    console.error('[ExportSource] Error:', err)
    return NextResponse.json({ error: err.message || 'Erro interno ao gerar código' }, { status: 500 })
  }
}
