import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { SourceCodeGenerator } from '@/utils/export/SourceCodeGenerator'

export async function POST(request: Request) {
  try {
    const { projectId } = await request.json()
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

    // 3. Fetch Models to generate Features
    const { data: models } = await supabase
      .from('ui_models')
      .select('*')
      .eq('project_id', projectId)

    // 4. Generate the Source Code (ZIP)
    const generator = new SourceCodeGenerator(project, models || [])
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
