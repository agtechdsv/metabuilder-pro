import { cookies } from 'next/headers'
import { resolveMailLang } from '@/lib/security/securityMailText'
import type { MailLang } from '@/lib/security/securityMailText'

/**
 * Idioma da tela de quem está agindo agora (cookie `app-language`, o mesmo que a interface grava). É gravado em `user_metadata.lang` no cadastro, no
 * convite e no login, e os modelos de e-mail do Supabase (confirmar cadastro, recuperar senha, convite...) escolhem o texto por ele.
 * Sem cookie ou com valor estranho: português.
 */
export async function currentMailLang(): Promise<MailLang> {
  try {
    return resolveMailLang((await cookies()).get('app-language')?.value)
  } catch {
    return 'pt'
  }
}
