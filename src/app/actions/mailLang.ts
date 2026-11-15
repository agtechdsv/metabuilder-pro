'use server'

import { createAdminClient } from '@/utils/supabase/server'
import { currentMailLang } from '@/lib/auth/mailLangServer'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Antes de pedir "Esqueceu?": grava, na conta que tem esse e-mail, o idioma que está NA TELA agora (cookie do idioma), para o e-mail de
 * redefinição sair nele. Sem isto, o e-mail sairia no idioma do último login, mesmo que a pessoa tenha trocado de idioma depois de sair.
 *
 * Nunca diz se a conta existe (não devolve nada) e nunca lança. O idioma vem do cookie lido no servidor, não do pedido. Só mexe em `lang`
 * (preserva o resto dos dados da conta) e só grava se mudou.
 */
export async function prepareResetMailLang(email: string): Promise<void> {
  try {
    const address = (email || '').trim().toLowerCase()
    if (!EMAIL_RE.test(address) || address.length > 200) return
    const lang = await currentMailLang()
    const admin = createAdminClient()
    // ilike sem curingas: o e-mail do perfil pode estar com maiúsculas
    const pattern = address.replace(/[\\%_]/g, c => `\\${c}`)
    const { data: profile } = await admin.from('profiles').select('id').ilike('email', pattern).limit(1).maybeSingle()
    if (!profile?.id) return
    const { data: found } = await admin.auth.admin.getUserById(profile.id)
    const meta = (found?.user?.user_metadata || {}) as Record<string, unknown>
    if (meta.lang === lang) return
    await admin.auth.admin.updateUserById(profile.id, { user_metadata: { ...meta, lang } })
  } catch (e) {
    console.error('[idioma-email] não foi possível preparar o idioma da redefinição:', (e as Error)?.message)
  }
}
