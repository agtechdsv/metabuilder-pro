import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { resolveDownloadOwner } from '@/lib/tunnel/authorize'
import ws from 'ws'
import { wrapChannelWithChunking } from '@/lib/chunkedChannel'
import { authenticateCommand, newReplyTopic } from '@/lib/tunnel/commandSigning'
import { getProjectSecretToken, tunnelSend } from '@/lib/tunnel/server'

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
      realtime: { transport: ws as any }
    })

    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')
    const projectId = searchParams.get('projectId')

    if (!jobId || !projectId) {
      return new NextResponse('Missing jobId or projectId', { status: 400 })
    }

    // Requer sessão — download de arquivos não pode ser público. Quem pede é o usuário final do app ou um membro do projeto.
    const owner = await resolveDownloadOwner(request, projectId)
    if (!owner) return new NextResponse('Não autorizado', { status: 401 })
    if ('error' in owner) return new NextResponse(owner.error, { status: 400 })

    // 1. Validate Job, fetch filename e verifica ownership
    const { data: job, error: jobError } = await supabase
      .from('download_jobs')
      .select('file_name, local_path, user_id, project_id')
      .eq('id', jobId)
      .single()

    if (jobError || !job || String(job.project_id) !== projectId) {
      return new NextResponse('Job not found', { status: 404 })
    }

    // Garante que o job pertence a quem pede (IDOR fix) e ao projeto informado
    if (job.user_id !== owner.id) {
      return new NextResponse('Não autorizado', { status: 403 })
    }

    const fileName = job.file_name || `export_${jobId}.csv`

    // O Agente só entrega o arquivo a quem pedir com o token do projeto (ou com assinatura) — antes ele entregava a qualquer um.
    const projectToken = await getProjectSecretToken(projectId)
    if (!projectToken) return new NextResponse('Projeto sem token de túnel', { status: 404 })
    // O arquivo volta por um tópico privado só deste download (e nunca pelo canal público)
    const replyTopic = newReplyTopic(projectId, 'd')

    // 2. Prepare HTTP headers for file download
    const headers = new Headers()
    headers.set('Content-Disposition', `attachment; filename="${fileName}"`)
    headers.set('Content-Type', 'application/octet-stream')
    headers.set('Transfer-Encoding', 'chunked')

    // 3. Create a ReadableStream
    const stream = new ReadableStream({
      start(controller) {
        const channelName = replyTopic
        // O agente envia pedaços grandes divididos em "chunked_message"; o wrapper os remonta (sem ele o arquivo chegava com 0 bytes)
        const rawChannel = supabase.channel(channelName)
        const channel = wrapChannelWithChunking(rawChannel)

        let isDone = false

        // Timeout global de 60 segundos sem receber chunks
        let timeout = setTimeout(() => {
          if (!isDone) {
            isDone = true
            controller.error(new Error('Timeout aguardando chunks do CLI'))
            supabase.removeChannel(rawChannel)
          }
        }, 60000)

        // Event listener for chunks
        const eventName = `download_chunk_${jobId}`
        
        channel.on('broadcast', { event: eventName }, (payloadEvent: any) => {
          if (isDone) return
          
          const { chunk, isLast, error } = payloadEvent.payload

          if (error) {
            console.log(`[Stream API] Received ERROR for job ${jobId}:`, error)
            isDone = true
            controller.error(new Error(error))
            supabase.removeChannel(rawChannel)
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
                supabase.removeChannel(rawChannel)
              }
            }, 30000)

            // Decode base64 and enqueue
            const buffer = Buffer.from(chunk, 'base64')
            controller.enqueue(new Uint8Array(buffer))
          }

          if (isLast) {
            console.log(`[Stream API] Received IS_LAST for job ${jobId}. Closing stream shortly.`)
            // Folga curta: o último pedaço grande (remontado) pode chegar logo depois do aviso de fim
            setTimeout(() => {
              if (isDone) return
              isDone = true
              clearTimeout(timeout)
              controller.close()
              supabase.removeChannel(rawChannel)
            }, 800)
          }
        })

        channel.subscribe(async (status: string) => {
          if (status === 'SUBSCRIBED') {
            // Ask CLI to start sending chunks
            const command = authenticateCommand(projectToken, 'request_download_stream', projectId, { jobId, localPath: job.local_path }, { replyTo: replyTopic })
            // o pedido (assinado) vai ao canal em que o Agente escuta, e a resposta volta pelo tópico privado que esta rota ouve
            Promise.resolve(tunnelSend(projectId, 'request_download_stream', command)).catch((err: any) => {
              if (!isDone) {
                isDone = true
                clearTimeout(timeout)
                controller.error(err)
                supabase.removeChannel(rawChannel)
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

