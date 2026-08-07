import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildViewProps } from '@/lib/build-view-props'

/**
 * GET /api/runtime/slot-props
 *
 * Retorna as props completas de um ViewContainer para um dado slug de caso de uso.
 * Usado pelo CustomUseCaseRenderer para renderizar abas do Personalizado com
 * paridade 100% em relação ao caso de uso original.
 *
 * Query params:
 *   - projectId: string (obrigatório)
 *   - slug: string (obrigatório)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const slug = searchParams.get('slug')

    if (!projectId || !slug) {
      return NextResponse.json(
        { error: 'projectId e slug são obrigatórios' },
        { status: 400 }
      )
    }

    // Usamos service role server-side — nunca exposta ao browser
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false },
        global: {
          fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
        },
      }
    )

    // Valida que o projeto existe (verificação básica de segurança)
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Projeto não encontrado' },
        { status: 404 }
      )
    }

    // Constrói os props usando o mesmo código de page.tsx
    const props = await buildViewProps(supabase, projectId, slug)

    if (!props) {
      return NextResponse.json(
        { error: `Caso de uso "${slug}" não encontrado ou inativo` },
        { status: 404 }
      )
    }

    return NextResponse.json(props, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    console.error('[slot-props API] Erro:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
