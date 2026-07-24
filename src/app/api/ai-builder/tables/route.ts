import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// GET — Lista tabelas do banco do projeto via túnel (information_schema)
// O frontend usa o túnel Realtime para buscar as tabelas diretamente do banco do cliente
// Esta rota apenas valida o acesso e retorna metadados básicos do projeto
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const projectId = req.nextUrl.searchParams.get('project_id')
  if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 })

  // Busca o projeto e verifica acesso
  const { data: project } = await supabase
    .from('projects')
    .select('id, secret_token, db_schema, workspace_id')
    .eq('id', projectId)
    .single()

  if (!project) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })

  // Busca os models já sincronizados no MetaBuilder (forma mais confiável)
  const { data: models } = await supabase
    .from('models')
    .select(`
      id,
      db_table_name,
      display_name,
      fields (
        id,
        name,
        display_name,
        field_type,
        db_column_name
      )
    `)
    .eq('project_id', projectId)
    .order('db_table_name', { ascending: true })

  return NextResponse.json({ models: models || [] })
}
