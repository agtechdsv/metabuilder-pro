import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

// GET — Lista tabelas do banco do projeto via túnel (information_schema)
// O frontend usa o túnel Realtime para buscar as tabelas diretamente do banco do cliente
// Esta rota apenas valida o acesso e retorna metadados básicos do projeto
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const projectId = req.nextUrl.searchParams.get('project_id')
    if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 })

    // Busca o projeto e verifica acesso (garante segurança RLS via cliente normal)
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Projeto não encontrado ou sem permissão' }, { status: 404 })
    }

    const { createClient: createAdmin } = await import('@supabase/supabase-js')
    const admin = createAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Busca os models já sincronizados no MetaBuilder (forma mais confiável)
    // Usamos o admin aqui para garantir que todas as colunas de fields sejam retornadas sem esbarrar em restrições de RLS aninhadas
    const { data: models, error: modelsError } = await admin
      .from('models')
      .select(`
        id,
        db_table_name,
        display_name,
        fields (
          id,
          display_name,
          field_type,
          db_column_name
        )
      `)
      .eq('project_id', projectId)
      .order('db_table_name', { ascending: true })

    if (modelsError) {
      console.error('Erro ao buscar models:', modelsError)
      return NextResponse.json({ error: `DB Error: ${modelsError.message}` }, { status: 500 })
    }

    return NextResponse.json({ models: models || [] })
  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json({ error: `API Exception: ${error.message}` }, { status: 500 })
  }
}
