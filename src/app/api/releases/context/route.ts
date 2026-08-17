import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const contextType = searchParams.get('contextType') || 'project'
    const contextId = searchParams.get('contextId')

    if (!contextId) {
      return NextResponse.json({ releases: [] })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Fetch info about the context (Project or Workspace)
    let appName = 'Sistema'
    let appIcon = null

    if (contextType === 'project') {
      const { data: project } = await supabase
        .from('projects')
        .select('name, icon')
        .eq('id', contextId)
        .single()
      if (project) {
        appName = project.name
        appIcon = project.icon
      }
    } else {
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('name, theme_config')
        .eq('id', contextId)
        .single()
      if (workspace) {
        appName = workspace.name
        appIcon = workspace.theme_config?.logo_url || null
      }
    }

    // 2. Fetch builds for this context
    const { data: builds, error } = await supabase
      .from('desktop_builds')
      .select('id, version, status, download_url, release_notes, created_at, size_bytes')
      .eq('context_id', contextId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching context releases:', error)
      return NextResponse.json({ releases: [], appName, appIcon })
    }

    // Map to release notes format
    const releases = (builds || []).map((build, index) => {
      const v = build.version ? (build.version.startsWith('v') ? build.version : `v${build.version}`) : `v1.0.${builds.length - index}`
      const defaultNotes = index === builds.length - 1 
        ? `### 🎉 Lançamento Oficial\n\nPrimeira versão estável do aplicativo **${appName}** compilada e pronta para uso.`
        : `### 🚀 Atualização ${v}\n\nMelhorias de desempenho, estabilidade e atualização do runtime do aplicativo **${appName}**.`

      return {
        id: build.id,
        version: v,
        published_at: build.created_at,
        download_url: build.download_url,
        status: build.status,
        body: build.release_notes && build.release_notes.trim() !== '' ? build.release_notes : defaultNotes,
        size_bytes: build.size_bytes
      }
    })

    return NextResponse.json({
      appName,
      appIcon,
      contextType,
      contextId,
      releases
    })
  } catch (error: any) {
    console.error('Failed to get context releases', error)
    return NextResponse.json({ error: 'Internal Error', releases: [] }, { status: 500 })
  }
}
