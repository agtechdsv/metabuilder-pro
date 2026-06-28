import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import ws from 'ws'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
  realtime: { transport: ws as any }
})

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')
    const projectId = searchParams.get('projectId')

    if (!jobId || !projectId) {
      return new NextResponse('Missing jobId or projectId', { status: 400 })
    }

    // 1. Validate Job and fetch original filename
    const { data: job, error: jobError } = await supabase
      .from('download_jobs')
      .select('file_name, local_path')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return new NextResponse('Job not found', { status: 404 })
    }

    const fileName = job.file_name || `export_${jobId}.csv`

    // 2. Prepare HTTP headers for file download
    const headers = new Headers()
    headers.set('Content-Disposition', `attachment; filename="${fileName}"`)
    headers.set('Content-Type', 'application/octet-stream')
    headers.set('Transfer-Encoding', 'chunked')

    // 3. Create a ReadableStream
    const stream = new ReadableStream({
      start(controller) {
        const channelName = `tunnel:${projectId}`
        const channel = supabase.channel(channelName)

        let isDone = false

        // Timeout global de 60 segundos sem receber chunks
        let timeout = setTimeout(() => {
          if (!isDone) {
            isDone = true
            controller.error(new Error('Timeout aguardando chunks do CLI'))
            supabase.removeChannel(channel)
          }
        }, 60000)

        // Event listener for chunks
        const eventName = `download_chunk_${jobId}`
        
        channel.on('broadcast', { event: eventName }, (payloadEvent) => {
          if (isDone) return
          
          const { chunk, isLast, error } = payloadEvent.payload

          if (error) {
            console.log(`[Stream API] Received ERROR for job ${jobId}:`, error)
            isDone = true
            controller.error(new Error(error))
            supabase.removeChannel(channel)
            return
          }

          if (chunk) {
            console.log(`[Stream API] Received CHUNK for job ${jobId} (length: ${chunk.length})`)
            // Reset timeout
            clearTimeout(timeout)
            timeout = setTimeout(() => {
              if (!isDone) {
                console.log(`[Stream API] Timeout waiting for NEXT chunk for job ${jobId}`)
                isDone = true
                controller.error(new Error('Timeout aguardando proximo chunk'))
                supabase.removeChannel(channel)
              }
            }, 30000)

            // Decode base64 and enqueue
            const buffer = Buffer.from(chunk, 'base64')
            controller.enqueue(new Uint8Array(buffer))
          }

          if (isLast) {
            console.log(`[Stream API] Received IS_LAST for job ${jobId}. Closing stream.`)
            isDone = true
            clearTimeout(timeout)
            controller.close()
            supabase.removeChannel(channel)
          }
        })

        channel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            // Ask CLI to start sending chunks
            channel.send({
              type: 'broadcast',
              event: 'request_download_stream',
              payload: {
                jobId,
                localPath: job.local_path
              }
            }).catch(err => {
              if (!isDone) {
                isDone = true
                clearTimeout(timeout)
                controller.error(err)
                supabase.removeChannel(channel)
              }
            })
          }
        })
      },
      cancel() {
        console.log(`[Stream] Client cancelled download for job ${jobId}`)
      }
    })

    return new NextResponse(stream, { headers })
  } catch (error: any) {
    console.error('[Download Stream API] Error:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
