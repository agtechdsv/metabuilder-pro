import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { executeExportBackground } from '@/utils/export/worker'
import ws from 'ws'

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
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
  const supabase = getSupabase()
  const channel = supabase.channel(`tunnel:${projectId}`)
  await new Promise<void>((resolve) => {
    let isDone = false
    const timeout = setTimeout(() => { if (!isDone) { isDone = true; supabase.removeChannel(channel); resolve() } }, 3000)
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED' && !isDone) {
        Promise.all(localPaths.filter(Boolean).map(localPath => 
          channel.send({ type: 'broadcast', event: 'delete_export_file', payload: { localPath } })
        )).then(() => {
          if (!isDone) { isDone = true; clearTimeout(timeout); supabase.removeChannel(channel); resolve() }
        })
      }
    })
  })
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabase()
    const body = await request.json()
    const {
      projectId,
      userId,
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

    if (!projectId || !userId || !workspaceSlug || !viewName || !modelName || !fileType || !columnsList) {
      return NextResponse.json(
        { error: 'Parâmetros incompletos para a exportação' },
        { status: 400 }
      )
    }

    // Fetch project slug for the filename
    const { data: projData } = await supabase.from('projects').select('slug').eq('id', projectId).single()
    const projectSlug = projData?.slug || 'projeto'

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

    // 2. Fire and forget background execution (awaited to prevent Vercel suspension)
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
      recordId
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

export async function DELETE(request: Request) {
  try {
    const supabase = getSupabase()
    const body = await request.json()
    const { userId, jobId, clearAll, projectId, cleanup } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // --- CASE 1: Expired jobs cleanup ---
    if (cleanup) {
      console.log('[Export API] Running auto-cleanup for expired download jobs...')
      
      const { data: projects } = await supabase.from('projects').select('id, download_retention_hours')
      let totalCleaned = 0

      for (const project of (projects || [])) {
        // Se for null/vazio, significa que nunca deve apagar automaticamente
        if (project.download_retention_hours === null) continue

        const retentionMs = project.download_retention_hours * 60 * 60 * 1000
        const cutoffDate = new Date(Date.now() - retentionMs).toISOString()

        const { data: expiredJobs, error: fetchError } = await supabase
          .from('download_jobs')
          .select('id, local_path, project_id')
          .eq('project_id', project.id)
          .lt('created_at', cutoffDate)

        if (fetchError) {
          console.error(`[Export API] Error fetching expired jobs for project ${project.id}:`, fetchError)
          continue
        }

        if (expiredJobs && expiredJobs.length > 0) {
          const localPaths = expiredJobs.map(j => j.local_path).filter(Boolean)
          
          if (localPaths.length > 0) {
            await broadcastDelete(project.id, localPaths)
          }

          // Delete from database
          const ids = expiredJobs.map(j => j.id)
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
      return NextResponse.json({ success: true, message: `Cleaned up ${totalCleaned} jobs.` })
    }

    // --- CASE 2: Single job deletion ---
    if (jobId) {
      // Find the job to get the file_name
      const { data: job, error: fetchError } = await supabase
        .from('download_jobs')
        .select('*')
        .eq('id', jobId)
        .single()

      if (fetchError || !job) {
        return NextResponse.json(
          { error: 'Job not found' },
          { status: 404 }
        )
      }

      // Check authorization
      if (job.user_id !== userId) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 403 }
        )
      }

      // Broadcast deletion to local agent
      if (job.local_path) {
        await broadcastDelete(job.project_id, [job.local_path])
      }

      // Delete database record
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
      // Find all completed/failed jobs for this user and project
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
        const localPaths = jobsToDelete.map(j => j.local_path).filter(Boolean)

        // Broadcast deletion
        if (localPaths.length > 0) {
          await broadcastDelete(projectId, localPaths)
        }

        // Remove from database
        const ids = jobsToDelete.map(j => j.id)
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

export async function GET(request: Request) {
  try {
    const supabase = getSupabase()
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const userId = searchParams.get('userId')

    if (!projectId || !userId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

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
