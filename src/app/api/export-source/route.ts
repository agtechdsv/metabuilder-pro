import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { SourceCodeGenerator } from '@/utils/export/SourceCodeGenerator'

export async function POST(request: Request) {
  try {
    const { projectId, dbType = 'supabase' } = await request.json()
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

    // Mapear os modelos do banco de dados (models e fields) para o formato esperado pelo exportador
    const mappedModels = (models || []).map((m: any) => {
      const mappedFields = (m.fields || []).map((f: any) => ({
        column_name: f.db_column_name,
        label: f.display_name,
        field_type: f.data_type,
        list_visible: f.is_visible_in_list !== false,
        form_visible: f.is_visible_in_form !== false,
        required: !f.is_nullable
      }))

      return {
        ...m,
        table_name: m.db_table_name,
        name: m.display_name,
        ui_fields: mappedFields,
        ui_views: m.ui_views || []
      }
    })

    // 4. Generate the Source Code (ZIP)
    const generator = new SourceCodeGenerator(project, mappedModels, customComponents || [], dbType)
    const zipBuffer = await generator.generate()

    // 5. Return as a downloadable stream
    return new NextResponse(zipBuffer as any, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${project.slug || 'app'}-source-code.zip"`
      }
    })

  } catch (err: any) {
    console.error('[ExportSource] Error:', err)
    return NextResponse.json({ error: err.message || 'Erro interno ao gerar código' }, { status: 500 })
  }
}
