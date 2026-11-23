'use server'

import { headers } from 'next/headers'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { LEGAL_DOCS, LEGAL_VERSION, isLegalAccepted, isLegalSource } from '@/lib/legal/legalVersions'

/**
 * Aceite dos Termos de Serviço e da Política de Privacidade. A identidade vem SEMPRE da sessão (nunca do corpo do pedido) e a versão gravada é a vigente no
 * servidor (nunca a que o navegador disser). Uma linha por documento e versão; aceitar de novo a mesma versão não duplica.
 */
export async function acceptLegalAction(source: unknown): Promise<{ success: boolean; code?: 'unauthorized' | 'invalid' | 'unknown' }> {
  if (!isLegalSource(source)) return { success: false, code: 'invalid' }
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, code: 'unauthorized' }
    const ua = ((await headers()).get('user-agent') || '').slice(0, 200) || null
    const rows = LEGAL_DOCS.map(doc => ({ user_id: user.id, doc, version: LEGAL_VERSION, source, user_agent: ua }))
    const { error } = await createAdminClient().from('terms_acceptances').upsert(rows, { onConflict: 'user_id,doc,version', ignoreDuplicates: true })
    if (error) { console.error('[aceite] erro ao gravar:', error.message); return { success: false, code: 'unknown' } }
    return { success: true }
  } catch (e) {
    console.error('[aceite] erro:', (e as Error)?.message)
    return { success: false, code: 'unknown' }
  }
}

/** O cliente logado ainda precisa aceitar a versão vigente? (false também sem sessão ou se a consulta falhar: o aviso nunca atrapalha o painel). */
export async function myLegalStatusAction(): Promise<{ needsAcceptance: boolean; version: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { needsAcceptance: false, version: LEGAL_VERSION }
    const { data, error } = await createAdminClient().from('terms_acceptances').select('doc, version').eq('user_id', user.id).eq('version', LEGAL_VERSION)
    if (error) return { needsAcceptance: false, version: LEGAL_VERSION }
    return { needsAcceptance: !isLegalAccepted(data || []), version: LEGAL_VERSION }
  } catch {
    return { needsAcceptance: false, version: LEGAL_VERSION }
  }
}
