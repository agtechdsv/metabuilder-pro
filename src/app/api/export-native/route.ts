import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import JSZip from 'jszip'
import { parseMetaBuilderJSON } from '@/lib/generator/parser'
import { generateNativeProject } from '@/lib/generator/emitter'

export async function POST(request: Request) {
  try {
    const { projectId, dbStack = 'postgres', dbConnectionString, supabaseUrl, supabaseAnonKey } = await request.json()
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

    // 3. Fetch Models & Fields
    const { data: models } = await supabase
      .from('models')
      .select('*, fields(*)')
      .eq('project_id', projectId)

    // 4. Fetch Views & Components
    const { data: views } = await supabase
      .from('ui_views')
      .select('*, ui_components(*)')
      .eq('project_id', projectId)
      .eq('status', 'published')

    // Se não tiver views publicadas, pega todas
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

    // Constroi o JSON bruto simulando a exportação padrão
    const rawJson = {
      project,
      models: models || [],
      fields: flatFields,
      views: finalViews || [],
      components
    }

    // --- CLEAN CODE GENERATOR ---

    // Parse (com as credenciais reais para gerar .env.local pré-preenchido)
    const ast = parseMetaBuilderJSON(rawJson, dbStack, { dbConnectionString, supabaseUrl, supabaseAnonKey })
    
    // Emit
    const generatedFiles = generateNativeProject(ast)

    // Zip
    const zip = new JSZip()
    
    for (const [filePath, content] of Array.from(generatedFiles.entries())) {
      zip.file(filePath, content)
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } })

    // Return as downloadable stream
    return new NextResponse(zipBuffer as any, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${project.slug || 'app'}-native-source.zip"`,
        'Content-Length': zipBuffer.length.toString()
      }
    })

  } catch (err: any) {
    console.error('[ExportNative] Error:', err)
    return NextResponse.json({ error: err.message || 'Erro interno ao gerar código nativo' }, { status: 500 })
  }
}
