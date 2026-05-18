import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { executeExportBackground } from '@/utils/export/worker'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: Request) {
  try {
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
      filters = {}
    } = body

    if (!projectId || !userId || !workspaceSlug || !viewName || !modelName || !fileType || !columnsList) {
      return NextResponse.json(
        { error: 'Parâmetros incompletos para a exportação' },
        { status: 400 }
      )
    }

    // 1. Insert the pending job record in database
    const cleanFileName = `export_${viewName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_pending.${fileType}`
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

    // 2. Launch background execution WITHOUT awaiting the promise.
    // This offloads the job to Node's async event loop and returns 202 immediately to the browser.
    executeExportBackground({
      jobId,
      projectId,
      userId,
      workspaceSlug,
      viewName,
      modelName,
      fileType,
      columnsList,
      joins,
      filters
    }).catch(err => {
      console.error(`[Export API] Background worker uncaught exception for Job ${jobId}:`, err)
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
      console.log('[Export API] Running auto-cleanup for expired download jobs (>24h)...')
      // Find jobs older than 24 hours
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      
      const { data: expiredJobs, error: fetchError } = await supabase
        .from('download_jobs')
        .select('id, file_name')
        .lt('created_at', twentyFourHoursAgo)

      if (fetchError) {
        console.error('[Export API] Error fetching expired jobs:', fetchError)
        return NextResponse.json({ error: 'Failed to fetch expired jobs' }, { status: 500 })
      }

      if (expiredJobs && expiredJobs.length > 0) {
        const fileNames = expiredJobs.map(j => j.file_name).filter(Boolean)
        
        // Remove files from storage
        if (fileNames.length > 0) {
          const { error: storageError } = await supabase.storage
            .from('downloads')
            .remove(fileNames)
          if (storageError) {
            console.error('[Export API] Storage deletion warning:', storageError)
          }
        }

        // Delete from database
        const ids = expiredJobs.map(j => j.id)
        const { error: deleteError } = await supabase
          .from('download_jobs')
          .delete()
          .in('id', ids)

        if (deleteError) {
          console.error('[Export API] DB deletion error:', deleteError)
          return NextResponse.json({ error: 'Failed to delete expired jobs records' }, { status: 500 })
        }
        
        console.log(`[Export API] Cleaned up ${expiredJobs.length} expired download jobs.`)
      }

      return NextResponse.json({ success: true, message: `Cleaned up ${expiredJobs?.length || 0} jobs.` })
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

      // Delete from storage if file exists
      if (job.file_name) {
        const { error: storageError } = await supabase.storage
          .from('downloads')
          .remove([job.file_name])
        if (storageError) {
          console.error('[Export API] Storage file deletion warning:', storageError)
        }
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
        const fileNames = jobsToDelete.map(j => j.file_name).filter(Boolean)

        // Remove from storage
        if (fileNames.length > 0) {
          const { error: storageError } = await supabase.storage
            .from('downloads')
            .remove(fileNames)
          if (storageError) {
            console.error('[Export API] Storage clear history warning:', storageError)
          }
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
