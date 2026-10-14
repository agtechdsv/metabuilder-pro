import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { parseWorkspaceJSON } from '@/lib/generator/parser'
import { generateWorkspaceProject } from '@/lib/generator/emitter'
import { DbType } from '@/lib/generator/ast'
import JSZip from 'jszip'
import { toParseOptions } from '@/lib/generator/projectSource'
import { fetchWorkspaceProjects } from '@/lib/generator/workspaceData'

/**
 * POST /api/export-workspace
 *
 * Gera um único projeto Next.js (portal + N sub-rotas) para download em ZIP.
 * Chamado pelo botão "Export Source Code (Next.js)" no WorkspaceManager.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      workspaceId,
      dbStack = 'auto',
      backendStack = 'nodejs',
      javaGroupId,
      javaPort,
      targetLanguage,
      accessAdmin = false
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

    // 3. Buscar todos os projetos com seus dados
    const rawProjects = await fetchWorkspaceProjects(supabase, workspaceId, { accessAdmin: accessAdmin === true })

    if (rawProjects.length === 0) {
      return NextResponse.json({ error: 'Nenhum projeto encontrado neste workspace' }, { status: 404 })
    }

    // 4. Parser → AST
    // as mesmas opções (Java, idioma...) do motor de um projeto valem para cada projeto do workspace
    const ast = parseWorkspaceJSON(workspace, rawProjects, dbStack as DbType | 'auto', {
      ...toParseOptions(body),
      backendStack,
      javaGroupId,
      javaPort,
      targetLanguage
    })

    // 5. Emitter → File Map
    const fileMap = generateWorkspaceProject(ast)

    // 6. Compactar em ZIP
    const zip = new JSZip()
    for (const [filePath, content] of fileMap) {
      zip.file(filePath, content)
    }
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 }
    })

    // 7. Retornar o ZIP
    return new NextResponse(zipBuffer as any, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${workspace.slug || 'workspace'}-${backendStack === 'java-spring' ? 'java-spring' : 'nodejs'}-source.zip"`,
        'Content-Length': zipBuffer.length.toString()
      }
    })

  } catch (err: any) {
    console.error('[ExportWorkspace] Error:', err)
    return NextResponse.json({ error: err.message || 'Erro interno ao gerar código' }, { status: 500 })
  }
}
