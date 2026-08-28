import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { parseMetaBuilderJSON } from '@/lib/generator/parser'
import { generateNativeProject } from '@/lib/generator/emitter'
import { DbType } from '@/lib/generator/ast'
export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const projectId = payload.projectId
    const dataMode = payload.dataMode
    const legacyDriver = payload.legacyDriver
    const dbConfig = payload.dbConfig
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

    // 3. Fetch Models, Views, Relations & Auth Config in parallel
    const [
      { data: models },
      { data: views },
      { data: relations },
      { data: authConfig }
    ] = await Promise.all([
      supabase.from('models').select('*, fields(*)').eq('project_id', projectId),
      supabase.from('ui_views').select('*, ui_components(*)').eq('project_id', projectId).eq('status', 'published'),
      supabase.from('relations').select('*').eq('project_id', projectId),
      supabase.from('project_auth_config').select('*').eq('project_id', projectId).maybeSingle()
    ])

    let finalViews = views
    if (!finalViews || finalViews.length === 0) {
      const { data: allViews } = await supabase
        .from('ui_views')
        .select('*, ui_components(*)')
        .eq('project_id', projectId)
      finalViews = allViews
    }

    // Flatten UI Components
    const components = finalViews?.flatMap(v => v.ui_components || []) || []
    const flatFields = models?.flatMap(m => m.fields || []) || []

    // 5. Constroi o JSON bruto simulando a exportação padrão
    const rawJson = {
      project,
      models: models || [],
      fields: flatFields,
      views: finalViews || [],
      components,
      relations: relations || [],
      auth_config: authConfig ? {
        auth_type: authConfig.auth_type,
        table_name: authConfig.db_table_name,
        email_column: authConfig.db_email_column,
        password_column: authConfig.db_password_column,
        hash_format: authConfig.db_password_hash_type
      } : undefined
    }

    // Resolver credenciais de conexão
    const resolvedStack: DbType = (legacyDriver as DbType) || (dataMode as DbType) || 'postgres'
    const options = dbConfig?.url
      ? { dbConnectionString: dbConfig.url }
      : {}

    // --- CLEAN CODE GENERATOR ---
    const ast = parseMetaBuilderJSON(rawJson, resolvedStack, options)
    const generatedFiles = generateNativeProject(ast)

    // Return as JSON { path: content }
    const jsonMap: Record<string, string> = {}
    for (const [path, content] of generatedFiles) {
      jsonMap[path] = content
    }

    return NextResponse.json(jsonMap)

  } catch (err: any) {
    console.error('[ExportSource] Error:', err)
    return NextResponse.json({ error: err.message || 'Erro interno ao gerar código' }, { status: 500 })
  }
}
