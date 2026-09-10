import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import JSZip from 'jszip'
import { parseMetaBuilderJSON } from '@/lib/generator/parser'
import { generateNativeProject } from '@/lib/generator/emitter'
import type { BackendStack, JavaVersion } from '@/lib/generator/ast'

export async function POST(request: Request) {
  try {
    const {
      projectId,
      dbStack = 'postgres',
      dbConnectionString,
      supabaseUrl,
      supabaseAnonKey,
      backendStack = 'nodejs' as BackendStack,   // NOVO: 'nodejs' | 'java-spring'
      javaVersion = 21 as JavaVersion,            // NOVO: 17 | 21
      javaGroupId,                                // NOVO: ex: 'com.empresa'
      javaArtifactId,                             // NOVO: ex: 'crm-backend'
      javaPort = 8080                             // NOVO: porta Spring Boot
    } = await request.json()

    // Validar backendStack — tratar valores inválidos como 'nodejs' (GAP edge case)
    const resolvedBackendStack: BackendStack =
      backendStack === 'java-spring' ? 'java-spring' : 'nodejs'

    // Validar javaPort — clampar entre 1 e 65535
    const resolvedJavaPort = (Number.isInteger(javaPort) && javaPort >= 1 && javaPort <= 65535)
      ? javaPort
      : 8080
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

    // 3. Fetch Models, Views, Relations & Auth Config in parallel
    const [
      { data: models },
      { data: views },
      { data: relations },
      { data: authConfig },
      { data: enumerations }
    ] = await Promise.all([
      supabase.from('models').select('*, fields(*)').eq('project_id', projectId),
      supabase.from('ui_views').select('*, ui_components(*)').eq('project_id', projectId).eq('status', 'published'),
      supabase.from('relations').select('*').eq('project_id', projectId),
      supabase.from('project_auth_config').select('*').eq('project_id', projectId).maybeSingle(),
      supabase.from('project_enumerations').select('*').eq('project_id', projectId)
    ])

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
      components,
      relations: relations || [],
      enumerations: enumerations || [],
      auth_config: authConfig ? {
        auth_type: authConfig.auth_type,
        table_name: authConfig.db_table_name,
        email_column: authConfig.db_email_column,
        password_column: authConfig.db_password_column,
        hash_format: authConfig.db_password_hash_type
      } : undefined
    }

    // --- CLEAN CODE GENERATOR ---

    // Parse (com as credenciais reais para gerar .env.local pré-preenchido)
    const ast = parseMetaBuilderJSON(rawJson, dbStack, {
      dbConnectionString,
      supabaseUrl: supabaseUrl || project.supabase_url || process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: supabaseAnonKey || project.supabase_anon_key || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      backendStack: resolvedBackendStack,
      javaVersion,
      javaGroupId,
      javaArtifactId,
      javaPort: resolvedJavaPort,
    })
    
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
        'Content-Disposition': `attachment; filename="${project.slug || 'app'}-${resolvedBackendStack === 'java-spring' ? 'java-spring' : 'nodejs'}-source.zip"`,
        'Content-Length': zipBuffer.length.toString()
      }
    })

  } catch (err: any) {
    console.error('[ExportNative] Error:', err)
    return NextResponse.json({ error: err.message || 'Erro interno ao gerar código nativo' }, { status: 500 })
  }
}
