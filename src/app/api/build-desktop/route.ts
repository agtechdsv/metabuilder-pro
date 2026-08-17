import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Mapeamento de quais repositórios serão usados como "Templates" para o build do cliente
// Você precisará configurar essas variáveis de ambiente na Vercel:
// GITHUB_PERSONAL_ACCESS_TOKEN = um token com permissão de repo no github
// GITHUB_DESKTOP_TEMPLATE_OWNER = o usuário/org dono do repo de template
// GITHUB_DESKTOP_TEMPLATE_REPO = o nome do repo de template

export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    // 1. Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // 2. Extrair dados
    const body = await req.json()
    const {
      contextType,
      contextId,
      appName,
      appDescription,
      iconBase64,
      dbConnectionString,
      tunnelUrl,
      version,
      releaseNotes
    } = body

    if (!appName || !contextId) {
      return NextResponse.json({ error: 'Faltam campos obrigatórios' }, { status: 400 })
    }

    // 3. Buscar os dados do Projeto ou Workspace para embutir na Action (opcional)
    let schemaPayload = {}
    if (contextType === 'project') {
      const { data: project } = await supabase
        .from('projects')
        .select('*')
        .eq('id', contextId)
        .single()
      schemaPayload = { project_schema: project?.schema || {} }
    } else {
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', contextId)
        .single()
      schemaPayload = { workspace_theme: workspace?.theme_config || {} }
    }

    // 4. Configurações do GitHub Actions
    const token = process.env.GITHUB_PAT || process.env.GITHUB_PERSONAL_ACCESS_TOKEN
    const owner = process.env.GITHUB_DESKTOP_TEMPLATE_OWNER || 'agtechdsv'
    const repo = process.env.GITHUB_DESKTOP_TEMPLATE_REPO || 'metabuilder-desktop-template'

    // 4.1 Criar o registro de build na tabela desktop_builds com validade de 48h
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 48)

    const { data: desktopBuild, error: buildInsertError } = await supabase
      .from('desktop_builds')
      .insert({
        user_id: user.id,
        context_type: contextType,
        context_id: contextId,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
        version: version || '1.0.0',
        release_notes: releaseNotes || null
      })
      .select('id')
      .single()

    if (buildInsertError || !desktopBuild) {
      console.error('Falha ao criar registro de build:', buildInsertError)
      return NextResponse.json({ error: 'Falha ao inicializar o processo de build.' }, { status: 500 })
    }

    // 4.2 Upload do ícone personalizado para o Supabase Storage se fornecido
    let iconUrl = null
    if (iconBase64 && iconBase64.trim() !== '') {
      try {
        const supabaseService = createSupabaseClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )
        const base64Data = iconBase64.replace(/^data:image\/\w+;base64,/, '')
        const buffer = Buffer.from(base64Data, 'base64')
        const fileName = `desktop-builds/${desktopBuild.id}/icon.png`
        
        const { error: uploadError } = await supabaseService.storage
          .from('releases')
          .upload(fileName, buffer, {
            contentType: 'image/png',
            upsert: true
          })
          
        if (uploadError) {
          console.error('Falha ao fazer upload do ícone:', uploadError)
        } else {
          const { data: { publicUrl } } = supabaseService.storage
            .from('releases')
            .getPublicUrl(fileName)
          iconUrl = publicUrl
          console.log('Ícone personalizado salvo em:', iconUrl)
        }
      } catch (err) {
        console.error('Erro ao processar base64 do ícone:', err)
      }
    }

    if (!token) {
      // Como ainda estamos implementando a pipeline, vou simular o sucesso se o token não existir
      // Em produção, você deverá configurar o token do github.
      console.warn('GITHUB_PERSONAL_ACCESS_TOKEN não configurado. Simulando disparo de build...')
      
      return NextResponse.json({
        success: true,
        message: 'Modo Simulação: Build disparado com sucesso.',
        jobId: desktopBuild.id
      })
    }

    // 5. Disparar a Action no repositório de Template via Repository Dispatch
    // O workflow no repo do github precisa escutar: on: repository_dispatch: types: [build-desktop-app]
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/dispatches`, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: 'build-desktop-app',
        client_payload: {
          buildId: desktopBuild.id, // Enviando o ID para a Action devolver no Webhook!
          appName,
          appDescription,
          dbConnectionString,
          tunnelUrl: contextType === 'project' && tunnelUrl && !tunnelUrl.includes('standalone=true')
            ? `${tunnelUrl}${tunnelUrl.includes('?') ? '&' : '?'}standalone=true`
            : tunnelUrl,
          iconUrl, // Enviado como URL em vez do Base64 bruto para não exceder limites do Github
          contextType,
          contextId,
          version: version || '1.0.0',
          userId: user.id,
          ...schemaPayload
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Falha ao disparar GitHub Action:', errorText)
      return NextResponse.json({ error: 'Falha na comunicação com o servidor de Build.' }, { status: 502 })
    }

    return NextResponse.json({
      success: true,
      message: 'Build disparado com sucesso.',
      jobId: desktopBuild.id
    })
  } catch (error: any) {
    console.error('Build API Error:', error)
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 })
  }
}
