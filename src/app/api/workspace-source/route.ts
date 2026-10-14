import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { parseWorkspaceJSON } from '@/lib/generator/parser'
import { generateWorkspaceProject } from '@/lib/generator/emitter'
import { DbType } from '@/lib/generator/ast'
import { toParseOptions } from '@/lib/generator/projectSource'
import { fetchWorkspaceProjects, connectionsMap } from '@/lib/generator/workspaceData'

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
    const body = await request.json()
    const {
      workspaceId,
      dbStack = 'auto',
      dbConfig,
      legacyDriver,
      connections,
      accessAdmin = false,
      backendStack = 'nodejs',
      javaGroupId,
      javaPort,
      targetLanguage
    } = body
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
    const rawProjects = await fetchWorkspaceProjects(supabase, workspaceId, { accessAdmin: accessAdmin === true })

    if (rawProjects.length === 0) {
      return NextResponse.json({ error: 'Nenhum projeto encontrado neste workspace' }, { status: 404 })
    }

    // 4. Resolver credenciais de conexão
    // A IDE Local pode enviar dbConfig com a connection string já configurada
    // cada projeto usa o banco e a conexão dele (a IDE envia as conexões do metabuilder.config.json); sem isso, o banco de cada projeto
    const resolvedStack: DbType | 'auto' = (dbStack as DbType | 'auto') || 'auto'
    const options = {
      ...toParseOptions(body),
      dbConnectionString: dbConfig?.url,
      connections: connectionsMap(connections),
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      backendStack,
      javaGroupId,
      javaPort,
      targetLanguage
    }

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
