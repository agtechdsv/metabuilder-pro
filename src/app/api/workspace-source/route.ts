import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { parseWorkspaceJSON } from '@/lib/generator/parser'
import { generateWorkspaceProject } from '@/lib/generator/emitter'
import { DbType } from '@/lib/generator/ast'

/**
 * POST /api/workspace-source
 *
 * Retorna o mapa de arquivos do workspace como JSON (path → content).
 * Chamado pela IDE Local (useIDEGit.ts → syncManager.syncFromWeb)
 * quando target.type === 'workspace'.
 *
 * O syncManager recebe o mapa e escreve os arquivos no repositório local via Git.
 */
export async function POST(request: Request) {
  try {
    const { workspaceId, dbStack = 'postgres', dbConfig, legacyDriver } = await request.json()
    const supabase = await createClient()

    // 1. Autenticação
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    if (!workspaceId) {
      return NextResponse.json({ error: 'ID do workspace obrigatório' }, { status: 400 })
    }

    // 2. Buscar Workspace
    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .single()

    if (wsError || !workspace) {
      return NextResponse.json({ error: 'Workspace não encontrado' }, { status: 404 })
    }

    // 3. Buscar projetos completos
    const rawProjects = await fetchWorkspaceProjects(supabase, workspaceId)

    if (rawProjects.length === 0) {
      return NextResponse.json({ error: 'Nenhum projeto encontrado neste workspace' }, { status: 404 })
    }

    // 4. Resolver credenciais de conexão
    // A IDE Local pode enviar dbConfig com a connection string já configurada
    const resolvedStack: DbType = (legacyDriver as DbType) || (dbStack as DbType) || 'postgres'
    const options = dbConfig?.url
      ? { dbConnectionString: dbConfig.url }
      : {}

    // 5. Parser → AST
    const ast = parseWorkspaceJSON(workspace, rawProjects, resolvedStack, options)

    // 6. Emitter → File Map
    const fileMap = generateWorkspaceProject(ast)

    // 7. Retornar como JSON { path: content } — formato esperado pelo syncManager
    const jsonMap: Record<string, string> = {}
    for (const [path, content] of fileMap) {
      jsonMap[path] = content
    }

    return NextResponse.json(jsonMap)

  } catch (err: any) {
    console.error('[WorkspaceSource] Error:', err)
    return NextResponse.json({ error: err.message || 'Erro interno ao gerar código' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: busca projetos completos (models + views + fields)
// ─────────────────────────────────────────────────────────────────────────────
async function fetchWorkspaceProjects(supabase: any, workspaceId: string) {
  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('workspace_id', workspaceId)

  if (!projects || projects.length === 0) return []

  const enriched = await Promise.all(projects.map(async (project: any) => {
    const projectId = project.id

    const [{ data: models }, { data: uiViewsPublished }, { data: relations }] = await Promise.all([
      supabase.from('models').select('*, fields(*)').eq('project_id', projectId),
      supabase.from('ui_views').select('*').eq('project_id', projectId).eq('status', 'published').order('created_at', { ascending: true }),
      supabase.from('relations').select('*').eq('project_id', projectId),
    ])

    let finalViews = uiViewsPublished
    if (!finalViews || finalViews.length === 0) {
      const { data: allViews } = await supabase
        .from('ui_views').select('*').eq('project_id', projectId).order('created_at', { ascending: true })
      finalViews = allViews
    }

    return {
      ...project,
      models: models || [],
      views: finalViews || [],
      fields: (models || []).flatMap((m: any) => m.fields || []),
      relations: relations || [],
    }
  }))

  return enriched
}
