import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateSecret, generateURI } from 'otplib'
import QRCode from 'qrcode'

export async function POST(req: NextRequest) {
  try {
    const { projectId, externalUserId, userEmail } = await req.json()

    if (!projectId || !externalUserId) {
      return NextResponse.json({ error: 'Faltam parâmetros obrigatórios' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // Usa service role para bypassar RLS, pois o front-end end-user não tem sessão do supabase
    )

    // 1. Verifica se já existe
    const { data: existing } = await supabase
      .from('project_users_security')
      .select('*')
      .eq('project_id', projectId)
      .eq('external_user_id', externalUserId)
      .single()

    let secret = existing?.totp_secret

    // 2. Se não existe, cria um secret e um registro
    if (!existing || !secret) {
      secret = generateSecret()
      
      const { error } = await supabase
        .from('project_users_security')
        .upsert({
          project_id: projectId,
          external_user_id: externalUserId,
          totp_secret: secret,
          mfa_enabled: false
        }, { onConflict: 'project_id,external_user_id' })

      if (error) {
        throw new Error('Erro ao salvar no cofre de segurança: ' + error.message)
      }
    }

    // 3. Gera o QR Code URI (otpauth://...)
    // O nome do app será exibido no Google Authenticator
    const { data: project } = await supabase.from('projects').select('name').eq('id', projectId).single()
    const appName = project?.name || 'MetaBuilder App'
    const accountName = userEmail || externalUserId

    const otpauthUrl = generateURI({
      issuer: appName,
      label: accountName,
      secret
    })
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl)

    return NextResponse.json({
      secret,
      qrCodeDataUrl,
      mfaEnabled: existing?.mfa_enabled || false
    })

  } catch (error: any) {
    console.error('Erro na geração de MFA (end-user):', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
