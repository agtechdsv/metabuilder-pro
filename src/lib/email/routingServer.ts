import { createAdminClient } from '@/utils/supabase/server'
import { formatFrom, parseEmailRouting, resolveRoute, type EmailRouting, type EmailTopic, type ResolvedRoute } from './routing'

/** Só no servidor: lê o roteamento de e-mails do SuperAdmin (platform_settings.email_routing) com uma pequena memória (1 min). Falha = padrões de sempre. */

const KEY = 'email_routing'
const TTL_MS = 60_000
let cache: { at: number; routing: EmailRouting } | null = null

export async function loadEmailRouting(force = false): Promise<EmailRouting> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.routing
  try {
    const { data } = await createAdminClient().from('platform_settings').select('value').eq('key', KEY).maybeSingle()
    cache = { at: Date.now(), routing: parseEmailRouting(data?.value) }
  } catch {
    cache = { at: Date.now(), routing: {} }
  }
  return cache.routing
}

/** Depois de salvar na tela, o próximo envio já vale a nova regra. */
export const forgetEmailRouting = () => { cache = null }

/** O que usar num envio deste assunto: remetente pronto para o cabeçalho "De", Responder para e (avisos à equipe) o destino escolhido. */
export async function routeFor(topic: EmailTopic): Promise<ResolvedRoute & { fromHeader: string }> {
  const smtpUser = (process.env.SMTP_USER || '').trim()
  const r = resolveRoute(await loadEmailRouting(), topic, smtpUser)
  return { ...r, fromHeader: formatFrom(r.from) }
}
