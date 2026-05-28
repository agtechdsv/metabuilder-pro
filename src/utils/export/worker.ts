import { createClient } from '@supabase/supabase-js'
import { Pool } from 'pg'
import ws from 'ws'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const dbConnectionString = "postgresql://postgres.chmstvtepzmjhpyxjjam:Goeta815617%40@aws-1-sa-east-1.pooler.supabase.com:6543/postgres"

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
  realtime: { transport: ws as any }
})
const dbPool = new Pool({ connectionString: dbConnectionString })

async function broadcastProgress(projectId: string, payload: {
  jobId: string, progress: number, status: string, error?: string, viewName?: string
}) {
  try {
    const channelName = `tunnel:${projectId}`
    const channel = supabase.channel(channelName)
    await new Promise<void>((resolve) => {
      let isDone = false
      const timeout = setTimeout(() => {
        if (!isDone) { isDone = true; supabase.removeChannel(channel); resolve(); }
      }, 5000)
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED' && !isDone) {
          channel.send({ type: 'broadcast', event: 'download_progress', payload }).then(() => {
            if (!isDone) { isDone = true; clearTimeout(timeout); supabase.removeChannel(channel); resolve() }
          }).catch(() => {
            if (!isDone) { isDone = true; clearTimeout(timeout); supabase.removeChannel(channel); resolve() }
          })
        }
      })
    })
  } catch (err) {}
}

export async function executeExportBackground(params: {
  jobId: string, projectId: string, userId: string, workspaceSlug: string,
  viewName: string, modelName: string, fileType: string,
  columnsList: string[], joins: any[], filters: Record<string, string>
}) {
  const { jobId, projectId, workspaceSlug, viewName, modelName, fileType, columnsList, joins, filters } = params
  const client = await dbPool.connect()
  
  try {
    // 1. Fetch secret token & Project Slug
    const { data: projectData, error: projError } = await supabase
      .from('projects').select('secret_token, slug').eq('id', projectId).single()

    if (projError || !projectData) throw new Error('Project secret token not found')

    // 2. Set to processing
    await client.query(`UPDATE public.download_jobs SET status = 'processing', progress = 10, updated_at = NOW() WHERE id = $1`, [jobId])
    await broadcastProgress(projectId, { jobId, progress: 10, status: 'processing', viewName })

    // 3. Build SQL Query
    const safeTable = modelName.replace(/[^a-zA-Z0-9_]/g, '')
    let selectCols = columnsList.map(c => {
      if (c.toLowerCase().includes(' as ')) return c
      if (c.includes('.')) return `${c} AS "${c}"`
      return `"${safeTable}"."${c}" AS "${c}"`
    }).join(', ') || `"${safeTable}".*`

    let joinClause = ''
    if (joins && joins.length > 0) {
      joins.forEach(j => {
        const fromT = String(j.table || j.from).replace(/[^a-zA-Z0-9_]/g, '')
        const toT = String(j.toTable || j.to).replace(/[^a-zA-Z0-9_]/g, '')
        const local = String(j.on || j.localKey).replace(/[^a-zA-Z0-9_]/g, '')
        const foreign = String(j.toOn || j.foreignKey).replace(/[^a-zA-Z0-9_]/g, '')
        if (fromT && toT && local && foreign) {
          joinClause += ` LEFT JOIN "${toT}" ON "${fromT}"."${local}" = "${toT}"."${foreign}"`
        }
      })
    }

    let whereClause = ''
    const sqlParams: any[] = []
    if (filters && Object.keys(filters).length > 0) {
      const conditions: string[] = []
      let i = 1
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== '') {
          let tablePart = safeTable, columnPart = key.replace(/[^a-zA-Z0-9_]/g, '')
          if (key.includes('.')) {
            const parts = key.split('.')
            tablePart = parts[0].replace(/[^a-zA-Z0-9_]/g, '')
            columnPart = parts[1].replace(/[^a-zA-Z0-9_]/g, '')
          }
          conditions.push(`CAST("${tablePart}"."${columnPart}" AS text) ILIKE $${i}`)
          sqlParams.push(`%${value}%`)
          i++
        }
      }
      if (conditions.length > 0) whereClause = ` WHERE ${conditions.join(' AND ')}`
    }

    const rawSql = `SELECT DISTINCT ${selectCols} FROM "${safeTable}"${joinClause}${whereClause}`

    // 4. Send request to CLI Tunnel
    const channelName = `tunnel:${projectId}`
    const channel = supabase.channel(channelName)

    await new Promise<void>((resolve, reject) => {
      let isDone = false
      const timeout = setTimeout(() => {
        if (!isDone) { isDone = true; supabase.removeChannel(channel); reject(new Error('Timeout enviando requisição para CLI local')); }
      }, 10000)

      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED' && !isDone) {
          channel.send({
            type: 'broadcast',
            event: 'export_job_start',
            payload: {
              jobId,
              token: projectData.secret_token,
              sql: rawSql,
              params: sqlParams,
              fileType,
              viewName,
              workspaceSlug,
              projectSlug: projectData.slug
            }
          }).then(() => {
            if (!isDone) { isDone = true; clearTimeout(timeout); supabase.removeChannel(channel); resolve() }
          }).catch(err => {
            if (!isDone) { isDone = true; clearTimeout(timeout); supabase.removeChannel(channel); reject(err) }
          })
        }
      })
    })

    console.log(`[Export Worker] Job ${jobId} offloaded to local CLI.`)
  } catch (err: any) {
    console.error(`[Export Worker] Job ${jobId} failed:`, err)
    await client.query(`UPDATE public.download_jobs SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2`, [err.message || 'Erro inesperado', jobId])
    await broadcastProgress(projectId, { jobId, progress: 0, status: 'failed', viewName, error: err.message })
  } finally {
    client.release()
  }
}
