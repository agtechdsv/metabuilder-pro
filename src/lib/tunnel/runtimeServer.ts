import { readClientUser } from './endUserAuth'
import { relayEnabled } from './server'

/**
 * Ajudantes das páginas do runtime (componentes de servidor).
 *
 * Com o relay ligado a página NÃO entrega o secret_token ao navegador e as decisões de acesso usam a sessão assinada
 * do usuário final, não o cookie `client_session_*` (que o navegador escreve e, portanto, qualquer um forja).
 */

/** O projeto como pode ir ao navegador: sem o secret_token quando o relay está ligado. */
export function publicProject<T extends Record<string, any>>(project: T): T {
  if (!relayEnabled() || !project || !('secret_token' in project)) return project
  const { secret_token: _removed, ...rest } = project
  return rest as T
}

/** Token que pode ser entregue a componentes do navegador ('' com o relay: o servidor coloca o token nos comandos). */
export const browserToken = (project: { secret_token?: string | null }): string => (relayEnabled() ? '' : project.secret_token || '')

interface CookieReader { get(name: string): { value: string } | undefined }

/**
 * Valor do cookie de sessão do usuário final no formato que as páginas já interpretam
 * (`JSON.parse(decodeURIComponent(valor))`). Com o relay vem da sessão assinada; sem ela, undefined.
 */
export function clientSessionCookie(cookies: CookieReader, projectId: string): string | undefined {
  if (!relayEnabled()) return cookies.get(`client_session_${projectId}`)?.value
  const user = readClientUser(cookies, projectId, true)
  return user ? encodeURIComponent(JSON.stringify(user)) : undefined
}
