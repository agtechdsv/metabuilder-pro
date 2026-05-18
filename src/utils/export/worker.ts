import { createClient } from '@supabase/supabase-js'
import { Pool } from 'pg'
import * as xlsx from 'xlsx'
import { jsPDF } from 'jspdf'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Connection string to our Supabase PostgreSQL DB
const dbConnectionString = "postgresql://postgres.chmstvtepzmjhpyxjjam:Goeta815617%40@aws-1-sa-east-1.pooler.supabase.com:6543/postgres"

const supabase = createClient(supabaseUrl, supabaseServiceKey)
const dbPool = new Pool({ connectionString: dbConnectionString })

/**
 * Ensures that the secure 'downloads' storage bucket exists in Supabase.
 */
async function ensureDownloadsBucket() {
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets()
    if (error) throw error
    
    const exists = buckets?.some(b => b.id === 'downloads')
    if (!exists) {
      console.log('[Export Worker] 📁 Creating secure "downloads" bucket in Supabase Storage...')
      const { error: createError } = await supabase.storage.createBucket('downloads', {
        public: false, // Private bucket (we will generate Signed URLs)
        fileSizeLimit: 104857600 // 100MB
      })
      if (createError) throw createError
    } else {
      // Force update existing bucket size limit to 100MB to avoid "maximum allowed size exceeded" errors
      console.log('[Export Worker] 📁 Updating secure "downloads" bucket limit to 100MB...')
      const { error: updateError } = await supabase.storage.updateBucket('downloads', {
        public: false,
        fileSizeLimit: 104857600 // 100MB
      })
      if (updateError) {
        console.warn('[Export Worker] Warning updating storage bucket size limit:', updateError)
      }
    }
  } catch (err) {
    console.error('[Export Worker] Error checking/creating/updating storage bucket:', err)
  }
}

/**
 * Sends a real-time progress update to the client over the Broadcast Tunnel.
 */
async function broadcastProgress(projectId: string, payload: {
  jobId: string
  progress: number
  status: string
  fileName?: string
  viewName: string
  fileUrl?: string
  recordCount?: number
  error?: string
}) {
  try {
    const channelName = `tunnel:${projectId}`
    console.log(`[Export Worker] 📡 Broadcasting progress for job ${payload.jobId}: ${payload.progress}% (${payload.status})`)
    
    const channel = supabase.channel(channelName)
    
    // Subscribe and send
    await new Promise<void>((resolve) => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'download_progress',
            payload
          }).then(() => {
            supabase.removeChannel(channel)
            resolve()
          })
        }
      })
    })
  } catch (err) {
    console.error('[Export Worker] Failed to broadcast progress over tunnel:', err)
  }
}

/**
 * Background worker task that executes the asynchronous export process.
 */
export async function executeExportBackground(params: {
  jobId: string
  projectId: string
  userId: string
  workspaceSlug: string
  viewName: string
  modelName: string
  fileType: 'xlsx' | 'csv' | 'json' | 'pdf'
  columnsList: string[]
  joins: any[]
  filters: Record<string, string>
}) {
  const {
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
  } = params

  const client = await dbPool.connect()
  
  try {
    // 1. Update status to 'processing' (10% progress)
    await client.query(
      `UPDATE public.download_jobs SET status = 'processing', progress = 10, updated_at = NOW() WHERE id = $1`,
      [jobId]
    )
    await broadcastProgress(projectId, { jobId, progress: 10, status: 'processing', viewName })

    // Ensure bucket is available
    await ensureDownloadsBucket()

    // 2. Build the exact same raw SQL query with joins and filters from Runtime
    const safeTable = modelName.replace(/[^a-zA-Z0-9_]/g, '')
    let selectCols = columnsList.map(c => {
      // Clean col names or keep them intact if they are expressions
      const lowerC = c.toLowerCase()
      if (lowerC.includes(' as ')) {
        return c
      }
      if (c.includes('.')) {
        return `${c} AS "${c}"`
      }
      // Primary table column without table prefix: fully qualify it to avoid ambiguity
      return `"${safeTable}"."${c}" AS "${c}"`
    }).join(', ')
    
    if (!selectCols) {
      selectCols = `"${safeTable}".*`
    }

    let joinClause = ''
    if (joins && joins.length > 0) {
      joins.forEach(j => {
        const fromTable = j.table || j.from
        const toTable = j.toTable || j.to
        const localOn = j.on || j.localKey
        const foreignOn = j.toOn || j.foreignKey

        if (fromTable && toTable && localOn && foreignOn) {
          const safeFrom = String(fromTable).replace(/[^a-zA-Z0-9_]/g, '')
          const safeTo = String(toTable).replace(/[^a-zA-Z0-9_]/g, '')
          const safeLocal = String(localOn).replace(/[^a-zA-Z0-9_]/g, '')
          const safeForeign = String(foreignOn).replace(/[^a-zA-Z0-9_]/g, '')
          
          joinClause += ` LEFT JOIN "${safeTo}" ON "${safeFrom}"."${safeLocal}" = "${safeTo}"."${safeForeign}"`
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
          let tablePart = safeTable
          let columnPart = key
          if (key.includes('.')) {
            const parts = key.split('.')
            tablePart = parts[0].replace(/[^a-zA-Z0-9_]/g, '')
            columnPart = parts[1].replace(/[^a-zA-Z0-9_]/g, '')
          } else {
            columnPart = key.replace(/[^a-zA-Z0-9_]/g, '')
          }
          
          conditions.push(`CAST("${tablePart}"."${columnPart}" AS text) ILIKE $${i}`)
          sqlParams.push(`%${value}%`)
          i++
        }
      }
      if (conditions.length > 0) {
        whereClause = ` WHERE ${conditions.join(' AND ')}`
      }
    }

    const rawSql = `SELECT ${selectCols} FROM "${safeTable}"${joinClause}${whereClause} LIMIT 100000`
    console.log('[Export Worker] Executing query:', rawSql, 'Params:', sqlParams)

    // 3. Run database query (progress 40%)
    await client.query(
      `UPDATE public.download_jobs SET progress = 40, updated_at = NOW() WHERE id = $1`,
      [jobId]
    )
    await broadcastProgress(projectId, { jobId, progress: 40, status: 'processing', viewName })

    const result = await client.query(rawSql, sqlParams)
    const rows = result.rows
    const recordCount = rows.length

    console.log(`[Export Worker] Query returned ${recordCount} records. Processing file format...`)

    // 4. Format files (progress 70%)
    await client.query(
      `UPDATE public.download_jobs SET progress = 70, updated_at = NOW() WHERE id = $1`,
      [jobId]
    )
    await broadcastProgress(projectId, { jobId, progress: 70, status: 'processing', viewName })

    let buffer: Buffer
    let mimeType = 'application/octet-stream'
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)
    const cleanViewName = viewName.toLowerCase().replace(/[^a-z0-9]/g, '_')
    const fileName = `export_${cleanViewName}_${timestamp}.${fileType}`

    if (fileType === 'xlsx') {
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      
      // Clean up column names for business readability
      const cleanedRows = rows.map(row => {
        const cleanRow: Record<string, any> = {}
        for (const [key, val] of Object.entries(row)) {
          // Exclui chaves internas auxiliares
          if (key === '_key' || key === '_details') continue
          
          // Limpa nomes do tipo "tabela.coluna" para apenas "Coluna"
          const cleanKey = key.includes('.') ? key.split('.').pop() || key : key
          const formattedKey = cleanKey.charAt(0).toUpperCase() + cleanKey.slice(1).replace(/_/g, ' ')
          
          cleanRow[formattedKey] = val
        }
        return cleanRow
      })

      const worksheet = xlsx.utils.json_to_sheet(cleanedRows)
      const workbook = xlsx.utils.book_new()
      xlsx.utils.book_append_sheet(workbook, worksheet, 'Dados Exportados')
      
      buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    } else if (fileType === 'csv') {
      mimeType = 'text/csv'
      
      if (rows.length === 0) {
        buffer = Buffer.from('', 'utf-8')
      } else {
        const headers = Object.keys(rows[0]).filter(k => k !== '_key' && k !== '_details')
        const csvHeaders = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',')
        
        const csvRows = rows.map(row => {
          return headers.map(h => {
            const val = row[h]
            if (val === null || val === undefined) return '""'
            return `"${String(val).replace(/"/g, '""')}"`
          }).join(',')
        })
        
        const csvContent = '\uFEFF' + [csvHeaders, ...csvRows].join('\n') // Add UTF-8 BOM for Excel compatibility
        buffer = Buffer.from(csvContent, 'utf-8')
      }
    } else if (fileType === 'pdf') {
      mimeType = 'application/pdf'
      
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      // Page parameters (margins and dynamic column auto-widths)
      const pageWidth = 210
      const pageHeight = 297
      const margin = 14
      const usableWidth = pageWidth - (margin * 2) // 182mm
      const rowHeight = 8
      const headerHeight = 10
      const startY = 35
      
      // Limit PDF export to 500 rows to ensure fast generation and keep file size under 1MB (avoiding Supabase size limits)
      const maxPdfRows = 500
      const isLimited = rows.length > maxPdfRows
      const rowsToProcess = rows.slice(0, maxPdfRows)

      const rawCols = rows.length > 0 ? Object.keys(rows[0]).filter(k => k !== '_key' && k !== '_details') : []
      const headers = rawCols.map(col => {
        const cleanKey = col.includes('.') ? col.split('.').pop() || col : col
        return cleanKey.charAt(0).toUpperCase() + cleanKey.slice(1).replace(/_/g, ' ')
      })

      const colCount = Math.max(headers.length, 1)
      const colWidth = usableWidth / colCount

      let pageCount = 1
      const drawPageDecorations = (pdfDoc: any, currentPage: number) => {
        // Indigo top color bar
        pdfDoc.setFillColor(79, 70, 229)
        pdfDoc.rect(0, 0, pageWidth, 4, 'F')
        
        // Report Title
        pdfDoc.setFont('helvetica', 'bold')
        pdfDoc.setFontSize(14)
        pdfDoc.setTextColor(31, 41, 55)
        pdfDoc.text(viewName.toUpperCase(), margin, 16)
        
        // Metadata subtitle
        pdfDoc.setFont('helvetica', 'normal')
        pdfDoc.setFontSize(8)
        pdfDoc.setTextColor(107, 114, 128)
        const dateStr = `Exportado em: ${new Date().toLocaleString('pt-BR')}`
        const totalRowsCount = rows.length
        const recordsStr = isLimited
          ? `Registros: ${maxPdfRows} de ${totalRowsCount} (Visualização Limitada)`
          : `Registros: ${totalRowsCount}`
        pdfDoc.text(`${dateStr}  |  ${recordsStr}`, margin, 22)
        
        // Dynamic Warning Subtitle for limited exports
        if (isLimited) {
          pdfDoc.setFont('helvetica', 'oblique')
          pdfDoc.setFontSize(7)
          pdfDoc.setTextColor(239, 68, 68) // red-500
          pdfDoc.text('* Base completa disponível nos formatos Excel (.xlsx) e CSV (.csv).', margin, 24)
        }

        // Thin gray line
        pdfDoc.setDrawColor(229, 231, 235)
        pdfDoc.setLineWidth(0.3)
        pdfDoc.line(margin, 25, pageWidth - margin, 25)
        
        // Footer (Page indicator)
        pdfDoc.setFont('helvetica', 'normal')
        pdfDoc.setFontSize(8)
        pdfDoc.setTextColor(156, 163, 175)
        pdfDoc.text(`Página ${currentPage}`, pageWidth / 2, pageHeight - 10, { align: 'center' })
      }

      drawPageDecorations(doc, pageCount)

      let currentY = startY
      
      // Draw Header row block
      doc.setFillColor(31, 41, 55)
      doc.rect(margin, currentY, usableWidth, headerHeight, 'F')
      
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(255, 255, 255)

      headers.forEach((h, index) => {
        const xPos = margin + (index * colWidth) + 2
        const maxChars = Math.max(Math.floor(colWidth / 1.8), 1)
        const clippedH = h.length > maxChars ? h.slice(0, maxChars - 1) + '..' : h
        doc.text(clippedH, xPos, currentY + 6.5)
      })

      currentY += headerHeight

      // Draw rows list
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)

      rowsToProcess.forEach((row, rowIndex) => {
        // Multi-page spanning: Check page bounds
        if (currentY + rowHeight > pageHeight - 20) {
          doc.addPage()
          pageCount++
          drawPageDecorations(doc, pageCount)
          
          currentY = startY
          doc.setFillColor(31, 41, 55)
          doc.rect(margin, currentY, usableWidth, headerHeight, 'F')
          
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(8)
          doc.setTextColor(255, 255, 255)

          headers.forEach((h, index) => {
            const xPos = margin + (index * colWidth) + 2
            const maxChars = Math.max(Math.floor(colWidth / 1.8), 1)
            const clippedH = h.length > maxChars ? h.slice(0, maxChars - 1) + '..' : h
            doc.text(clippedH, xPos, currentY + 6.5)
          })

          currentY += headerHeight
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8)
        }

        // Zebra striping
        if (rowIndex % 2 === 0) {
          doc.setFillColor(249, 250, 251)
        } else {
          doc.setFillColor(255, 255, 255)
        }
        doc.rect(margin, currentY, usableWidth, rowHeight, 'F')
        
        doc.setDrawColor(243, 244, 246)
        doc.line(margin, currentY + rowHeight, pageWidth - margin, currentY + rowHeight)

        doc.setTextColor(55, 65, 81)
        rawCols.forEach((col, colIndex) => {
          const val = row[col]
          let cellText = val === null || val === undefined ? '' : String(val)
          
          const xPos = margin + (colIndex * colWidth) + 2
          
          // String bounds safety check
          const maxChars = Math.max(Math.floor(colWidth / 1.6), 1)
          if (cellText.length > maxChars) {
            cellText = cellText.slice(0, maxChars - 2) + '..'
          }
          
          doc.text(cellText, xPos, currentY + 5.2)
        })

        currentY += rowHeight
      })

      const pdfArrayBuffer = doc.output('arraybuffer')
      buffer = Buffer.from(pdfArrayBuffer)
    } else {
      // JSON
      mimeType = 'application/json'
      const jsonContent = JSON.stringify(rows, null, 2)
      buffer = Buffer.from(jsonContent, 'utf-8')
    }

    // 5. Upload buffer to Supabase Private Bucket (progress 90%)
    await client.query(
      `UPDATE public.download_jobs SET progress = 90, updated_at = NOW() WHERE id = $1`,
      [jobId]
    )
    await broadcastProgress(projectId, { jobId, progress: 90, status: 'processing', viewName })

    console.log(`[Export Worker] Uploading file ${fileName} (${buffer.length} bytes) to storage...`)
    const { error: uploadError } = await supabase.storage
      .from('downloads')
      .upload(fileName, buffer, {
        contentType: mimeType,
        upsert: true
      })

    if (uploadError) throw uploadError

    // 6. Generate secure temporary Signed URL (expires in 7 days / 604800 seconds)
    // We set 7 days to match our storage policy and pass the download parameter to force attachment headers
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('downloads')
      .createSignedUrl(fileName, 604800, {
        download: fileName
      })

    if (signedUrlError || !signedUrlData) throw signedUrlError || new Error('Failed to generate Signed URL')

    const fileUrl = signedUrlData.signedUrl

    // 7. Update database to completed (progress 100%)
    await client.query(
      `UPDATE public.download_jobs 
       SET status = 'completed', progress = 100, file_url = $1, file_name = $2, record_count = $3, updated_at = NOW() 
       WHERE id = $4`,
      [fileUrl, fileName, recordCount, jobId]
    )

    console.log(`[Export Worker] Job ${jobId} finished successfully! URL generated.`)
    await broadcastProgress(projectId, {
      jobId,
      progress: 100,
      status: 'completed',
      viewName,
      fileName,
      fileUrl,
      recordCount
    })

  } catch (err: any) {
    console.error(`[Export Worker] Job ${jobId} failed:`, err)
    
    // Save error state in DB
    await client.query(
      `UPDATE public.download_jobs 
       SET status = 'failed', error_message = $1, updated_at = NOW() 
       WHERE id = $2`,
      [err.message || 'Erro inesperado na exportação', jobId]
    )

    await broadcastProgress(projectId, {
      jobId,
      progress: 0,
      status: 'failed',
      viewName,
      error: err.message || 'Erro na geração da exportação'
    })
  } finally {
    client.release()
  }
}
