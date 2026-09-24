import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/utils/supabase/server'

export async function GET() {
  try {
    // Requer sessão autenticada — lista todos os workspaces/projetos, não pode ser pública
    const sessionClient = await createServerClient()
    const { data: { user } } = await sessionClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false },
      }
    )

    const { data: workspaces, error: wsError } = await supabase
      .from('workspaces')
      .select(`
        id,
        name,
        slug,
        projects (
          id,
          name,
          slug,
          is_active,
          theme_config
        )
      `)
      .order('created_at', { ascending: false })

    if (wsError) {
      console.error('[preview/targets] Error fetching workspaces:', wsError)
      return NextResponse.json({ workspaces: [] }, { status: 500 })
    }

    const formatted = (workspaces || []).map((w: any) => {
      const projects = (w.projects || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        is_active: p.is_active,
        show_in_portal: p.theme_config?.show_in_portal === true,
      }))

      const has_portal_project = projects.some((p: any) => p.show_in_portal === true)

      return {
        id: w.id,
        name: w.name,
        slug: w.slug,
        has_portal_project,
        projects,
      }
    })

    return NextResponse.json({ workspaces: formatted })
  } catch (err: any) {
    console.error('[preview/targets] Internal error:', err)
    return NextResponse.json({ workspaces: [] }, { status: 500 })
  }
}
