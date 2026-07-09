import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// Esta rota deve ser chamada pela GitHub Action no final do Workflow
// Opcional: Adicionar autenticação por um Header de Authorization contendo um Secret
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { buildId, status, downloadUrl, errorMessage, sizeBytes, secret } = body

    if (!buildId || !status) {
      return NextResponse.json({ error: 'Campos buildId e status são obrigatórios' }, { status: 400 })
    }

    // Segurança básica: Se configurado, verificar o secret
    const expectedSecret = process.env.WEBHOOK_SECRET
    if (expectedSecret && secret !== expectedSecret) {
      return NextResponse.json({ error: 'Acesso negado. Secret inválido.' }, { status: 401 })
    }

    const supabase = await createClient()

    // Atualiza a tabela desktop_builds
    const updatePayload: any = { 
      status,
      updated_at: new Date().toISOString()
    }
    
    if (downloadUrl) updatePayload.download_url = downloadUrl
    if (errorMessage) updatePayload.error_message = errorMessage
    if (sizeBytes !== undefined && sizeBytes !== null) updatePayload.size_bytes = sizeBytes

    const { error } = await supabase
      .from('desktop_builds')
      .update(updatePayload)
      .eq('id', buildId)

    if (error) {
      console.error('Falha ao atualizar o desktop_builds:', error)
      return NextResponse.json({ error: 'Falha ao atualizar o banco de dados' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: `Build ${buildId} atualizado para ${status}` })
  } catch (error) {
    console.error('Erro no webhook de build:', error)
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 })
  }
}
