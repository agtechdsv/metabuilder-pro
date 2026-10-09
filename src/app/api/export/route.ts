import { createClient } from '@supabase/supabase-js'
import { authenticateCommand } from '@/lib/tunnel/commandSigning'
import { getProjectSecretToken, tunnelSend } from '@/lib/tunnel/server'
import { NextResponse, type NextRequest } from 'next/server'
import { resolveDownloadOwner } from '@/lib/tunnel/authorize'
import { endUserCookieName, verifyEndUserSession } from '@/lib/tunnel/sessionToken'
import { loadAccessContext } from '@/lib/tunnel/tableAccess'
import { accessForSession } from '@/lib/rowPolicy/server'
import { exportProblem } from '@/lib/rowPolicy/exportGuard'
import { executeExportBackground } from '@/utils/export/worker'
import ws from 'ws'

let _supabase: any = null;
function getSupabase(): any {
  if (!_supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    _supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
      realtime: { transport: ws as any }
    })
  }
  return _supabase;
}
async function broadcastDelete(projectId: string, localPaths: string[]) {
  if (!localPaths || localPaths.length === 0) return
  // O Agente só apaga arquivo a pedido autenticado (assinado ou com o token do projeto) e só dentro da pasta de exportações
  const token = await getProjectSecretToken(projectId)
  if (!token) return
  await Promise.all(localPaths.filter(Boolean).map((localPath: any) =>
    tunnelSend(projectId, 'delete_export_file', authenticateCommand(token, 'delete_export_file', projectId, { localPath }), undefined, token).catch(() => {})
  ))
}


/** Dono dos arquivos, sempre da sessão (usuário final do app ou membro do projeto), nunca do corpo do pedido. */
async function ownerOrError(request: NextRequest, projectId: unknown): Promise<{ userId: string; kind: 'end_user' | 'member' | 'anonymous' } | { res: NextResponse }> {
  if (typeof projectId !== 'string' || !projectId) return { res: NextResponse.json({ error: 'Missing parameters' }, { status: 400 }) }
  const owner = await resolveDownloadOwner(request, projectId)
  if (!owner) return { res: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }) }
  if ('error' in owner) return { res: NextResponse.json({ error: owner.error }, { status: 400 }) }
  return { userId: owner.id, kind: owner.kind }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase()

    const body = await request.json()
    // O dono vem da sessão — nunca do body
    const who = await ownerOrError(request, body?.projectId)
    if ('res' in who) return who.res
    const userId = who.userId

    // Usuário final (ou visitante): o servidor monta o SQL com nomes que vieram do navegador, então confere tudo antes e envia
    // as permissões/regras de acesso por linha dentro do comando assinado (o Agente as aplica a esta consulta e ao grafo).
    let access: Record<string, any> | undefined
    if (who.kind !== 'member') {
      try {
        const problem = exportProblem(body, await loadAccessContext(body.projectId))
        if (problem) {
          console.warn(`[export/guard] projeto=${body.projectId} ${problem}`)
          return NextResponse.json({ error: 'Exportação não permitida para estes dados.' }, { status: 403 })
        }
        const session = verifyEndUserSession(request.cookies.get(endUserCookieName(body.projectId))?.value, body.projectId)
        access = await accessForSession(body.projectId, session)
      } catch (e: any) {
        console.error('[export] não foi possível validar o acesso:', e?.message)
        return NextResponse.json({ error: 'Não foi possível validar o acesso.' }, { status: 503 })
      }
    }
    const {
      projectId,
      workspaceSlug,
      viewName,
      modelName,
      fileType, // 'xlsx' | 'csv' | 'json'
      columnsList,
      joins = [],
      filters = {},
      exportGraph = false,
      projectRelations = [],
      masterModelId = null,
      dictionary = {},
      recordId = null
    } = body

    if (!projectId || !workspaceSlug || !viewName || !modelName || !fileType || !columnsList) {
      return NextResponse.json(
        { error: 'Parâmetros incompletos para a exportação' },
        { status: 400 }
      )
    }

    // Fetch project slug for the filename
    const { data: projData } = await supabase.from('projects').select('slug').eq('id', projectId).single()
    const projectSlug = (projData as any)?.slug || 'projeto'

    // 1. Insert the pending job record in database
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)
    const ms = Date.now().toString().slice(-4)
    const cleanViewName = viewName.toLowerCase().replace(/[^a-z0-9]/g, '_')
    const cleanFileName = `${workspaceSlug}_${projectSlug}_${cleanViewName}_${timestamp}${ms}_pending.${fileType}`
    const { data: jobData, error: jobError } = await supabase
      .from('download_jobs')
      .insert({
        user_id: userId,
        workspace_slug: workspaceSlug,
        project_id: projectId,
        view_name: viewName,
        file_name: cleanFileName,
        file_type: fileType,
        progress: 0,
        status: 'pending'
      })
      .select('id')
      .single()

    if (jobError || !jobData) {
      console.error('[Export API] Error creating download job in DB:', jobError)
      return NextResponse.json(
        { error: 'Falha ao registrar job de exportação no banco' },
        { status: 500 }
      )
    }

    const jobId = jobData.id
    console.log(`[Export API] Registered Job ${jobId} (pending). Launching background execution...`)

    // 2. Fire and forget background execution
    await executeExportBackground({
      jobId,
      projectId,
      userId,
      workspaceSlug,
      viewName,
      modelName,
      fileType,
      columnsList,
      joins,
      filters,
      exportGraph,
      projectRelations,
      masterModelId,
      dictionary,
      recordId,
      access,
    })

    // 3. Return 202 Accepted response with jobId
    return NextResponse.json(
      {
        success: true,
        jobId,
        message: 'Processamento de exportação iniciado em segundo plano.'
      },
      { status: 202 }
    )

  } catch (error: any) {
    console.error('[Export API] General handler error:', error)
    return NextResponse.json(
      { error: error.message || 'Erro interno no servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabase()

    const body = await request.json()
    const { jobId, clearAll, projectId, cleanup } = body

    // O dono vem da sessão — nunca do body. Para apagar um arquivo só pelo id, o projeto é o do próprio arquivo.
    let scopeProjectId: unknown = projectId
    if (!scopeProjectId && jobId) {
      const { data: found } = await supabase.from('download_jobs').select('project_id').eq('id', jobId).maybeSingle()
      scopeProjectId = (found as any)?.project_id
      if (!scopeProjectId) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    const who = await ownerOrError(request, scopeProjectId)
    if ('res' in who) return who.res
    const userId = who.userId

    // --- CASE 1: Expired jobs cleanup ---
    if (cleanup) {
      // A limpeza vale SÓ para o projeto aberto e só para os jobs do usuário logado (mesmo escopo da listagem).
      if (!projectId) {
        return NextResponse.json({ error: 'projectId é obrigatório para a limpeza' }, { status: 400 })
      }
      console.log(`[Export API] Running auto-cleanup for expired download jobs (project ${projectId})...`)

      const { data: projects } = await supabase
        .from('projects')
        .select('id, download_retention_hours')
        .eq('id', projectId)
      let totalCleaned = 0

      for (const project of (projects || [])) {
        if (project.download_retention_hours === null) continue

        const retentionMs = project.download_retention_hours * 60 * 60 * 1000
        const cutoffDate = new Date(Date.now() - retentionMs).toISOString()

        const { data: expiredJobs, error: fetchError } = await supabase
          .from('download_jobs')
          .select('id, local_path, project_id')
          .eq('project_id', project.id)
          .eq('user_id', userId)
          .lt('created_at', cutoffDate)

        if (fetchError) {
          console.error(`[Export API] Error fetching expired jobs for project ${project.id}:`, fetchError)
          continue
        }

        if (expiredJobs && expiredJobs.length > 0) {
          const localPaths = expiredJobs.map((j: any) => j.local_path).filter(Boolean)
          
          if (localPaths.length > 0) {
            await broadcastDelete(project.id, localPaths)
          }

          const ids = expiredJobs.map((j: any) => j.id)
          const { error: deleteError } = await supabase
            .from('download_jobs')
            .delete()
            .in('id', ids)

          if (deleteError) {
            console.error('[Export API] DB deletion error:', deleteError)
          } else {
            totalCleaned += expiredJobs.length
          }
        }
      }

      console.log(`[Export API] Cleaned up ${totalCleaned} expired download jobs across all projects.`)
      return NextResponse.json({ success: true, cleaned: totalCleaned, message: `Cleaned up ${totalCleaned} jobs.` })
    }

    // --- CASE 2: Single job deletion ---
    if (jobId) {
      const { data: job, error: fetchError } = await supabase
        .from('download_jobs')
        .select('*')
        .eq('id', jobId)
        .single()

      if (fetchError || !job || String(job.project_id) !== String(scopeProjectId)) {
        return NextResponse.json(
          { error: 'Job not found' },
          { status: 404 }
        )
      }

      // Verifica autorização usando userId da sessão (não do body)
      if (job.user_id !== userId) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 403 }
        )
      }

      if (job.local_path) {
        await broadcastDelete(job.project_id, [job.local_path])
      }

      const { error: deleteError } = await supabase
        .from('download_jobs')
        .delete()
        .eq('id', jobId)

      if (deleteError) {
        throw deleteError
      }

      return NextResponse.json({ success: true, message: 'Job and associated file deleted successfully.' })
    }

    // --- CASE 3: Clear all completed/failed history for project ---
    if (clearAll && projectId) {
      const { data: jobsToDelete, error: fetchError } = await supabase
        .from('download_jobs')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .in('status', ['completed', 'failed'])

      if (fetchError) {
        throw fetchError
      }

      if (jobsToDelete && jobsToDelete.length > 0) {
        const localPaths = jobsToDelete.map((j: any) => j.local_path).filter(Boolean)

        if (localPaths.length > 0) {
          await broadcastDelete(projectId, localPaths)
        }

        const ids = jobsToDelete.map((j: any) => j.id)
        const { error: deleteError } = await supabase
          .from('download_jobs')
          .delete()
          .in('id', ids)

        if (deleteError) {
          throw deleteError
        }
      }

      return NextResponse.json({ success: true, message: 'History cleared successfully.' })
    }

    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })

  } catch (error: any) {
    console.error('[Export API] DELETE handler error:', error)
    return NextResponse.json(
      { error: error.message || 'Erro interno no servidor' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase()
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    // O dono vem da sessão — nunca do query param
    const who = await ownerOrError(request, projectId)
    if ('res' in who) return who.res
    const userId = who.userId

    const { data, error } = await supabase
      .from('download_jobs')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ jobs: data })
  } catch (error: any) {
    console.error('[Export API] GET handler error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
