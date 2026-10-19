import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { loadProjectAst, normalizeDbStack, ProjectSourceError, type ProjectSourceInput } from '@/lib/generator/projectSource'
import { buildTestManifest } from '@/lib/testing/manifest'

/**
 * POST /api/test-manifest  { projectId, viewSlugs?, dbStack? }
 *
 * Manifesto de testes do projeto (ou só dos casos de uso pedidos): campos de cada zona, máscaras, obrigatórios, botões e abas, como o dev os
 * configurou. Lê o Supabase pelo mesmo motor da exportação (loadProjectAst), com a sessão de quem está logado: só devolve projetos que o usuário pode ver.
 * O ambiente de testes da IDE gera e executa os testes a partir deste manifesto.
 */
export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const input: ProjectSourceInput = {
      projectId: payload.projectId,
      dbStack: normalizeDbStack(payload.dbStack) || normalizeDbStack(payload.legacyDriver),
      backendStack: payload.backendStack,
      authStrategy: payload.authStrategy,
    }
    const { ast } = await loadProjectAst(supabase, input)
    const viewSlugs = Array.isArray(payload.viewSlugs) ? payload.viewSlugs.map(String) : undefined
    return NextResponse.json(buildTestManifest(ast, { viewSlugs }))
  } catch (err: any) {
    if (err instanceof ProjectSourceError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('[TestManifest] Error:', err)
    return NextResponse.json({ error: err.message || 'Erro interno ao gerar o manifesto' }, { status: 500 })
  }
}
