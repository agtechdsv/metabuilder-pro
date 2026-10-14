import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import JSZip from 'jszip'
import { buildProjectSource, ProjectSourceError, type ProjectSourceInput } from '@/lib/generator/projectSource'

/**
 * POST /api/export-native
 *
 * Gera o código fonte do projeto (motor único: lib/generator/projectSource) e devolve um ZIP.
 * Usado pelo Ejetar da IDE Local, que grava os arquivos na pasta escolhida.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ProjectSourceInput & { dbStack?: string }
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { files, project } = await buildProjectSource(supabase, body as ProjectSourceInput)

    const zip = new JSZip()
    for (const [filePath, content] of files) zip.file(filePath, content)
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } })

    const stack = body.backendStack === 'java-spring' ? 'java-spring' : 'nodejs'
    return new NextResponse(zipBuffer as any, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${project.slug || 'app'}-${stack}-source.zip"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    })
  } catch (err: any) {
    if (err instanceof ProjectSourceError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('[ExportNative] Error:', err)
    return NextResponse.json({ error: err.message || 'Erro interno ao gerar código nativo' }, { status: 500 })
  }
}
