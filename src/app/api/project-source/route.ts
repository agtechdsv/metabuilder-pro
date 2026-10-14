import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { buildProjectSource, normalizeDbStack, ProjectSourceError, type ProjectSourceInput } from '@/lib/generator/projectSource'

/**
 * POST /api/project-source
 *
 * Mesmo motor do /api/export-native (lib/generator/projectSource), mas devolve JSON { caminho: conteúdo }, o formato que o
 * sincronizador da IDE Local (Ejetar & Sincronizar) grava no repositório local.
 */
export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    // A IDE manda o banco do metabuilder.config.json (legacyDriver + dbConfig.url) ou o escolhido na tela (dbStack/dbConnectionString)
    const input: ProjectSourceInput = {
      ...payload,
      dbStack: normalizeDbStack(payload.dbStack) || normalizeDbStack(payload.legacyDriver) || normalizeDbStack(payload.dataMode),
      dbConnectionString: payload.dbConnectionString || payload.dbConfig?.url,
    }
    const { files } = await buildProjectSource(supabase, input)

    const jsonMap: Record<string, string> = {}
    for (const [path, content] of files) jsonMap[path] = content
    return NextResponse.json(jsonMap)
  } catch (err: any) {
    if (err instanceof ProjectSourceError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('[ExportSource] Error:', err)
    return NextResponse.json({ error: err.message || 'Erro interno ao gerar código' }, { status: 500 })
  }
}
