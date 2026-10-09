import type { NextRequest } from 'next/server'
import { createClient as createSessionClient } from '@/utils/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { serviceClient } from './server'
import { endUserCookieName, verifyEndUserSession, type EndUserSession } from './sessionToken'

export type RelayActor =
  | { kind: 'member'; userId: string }
  | { kind: 'end_user'; session: EndUserSession }

const publicCache = new Map<string, { value: boolean; until: number }>()
const PUBLIC_TTL_MS = 60_000

/**
 * O projeto é aberto (sem login)? Projetos sem autenticação configurada são públicos por escolha do desenvolvedor:
 * o visitante anônimo continua usando o app, agora pelo relay (e sem ações de desenvolvedor).
 */
export async function isProjectPublic(
  projectId: string,
  deps: { client?: Pick<SupabaseClient, 'from'>; now?: () => number } = {},
): Promise<boolean> {
  const now = (deps.now ?? Date.now)()
  const hit = publicCache.get(projectId)
  if (hit && hit.until > now) return hit.value
  const client = deps.client ?? serviceClient()
  const { data, error } = await client.from('project_auth_config').select('auth_type').eq('project_id', projectId).maybeSingle()
  if (error) return false
  const value = !data || !(data as any).auth_type || (data as any).auth_type === 'none'
  publicCache.set(projectId, { value, until: now + PUBLIC_TTL_MS })
  return value
}

export function clearPublicCache() { publicCache.clear() }

// Quem já foi confirmado como membro de um projeto não precisa ser conferido de novo a cada comando (30 s)
const memberCache = new Map<string, number>()
const MEMBER_TTL_MS = 30_000

/**
 * Descobre quem está pedindo para falar com o banco do projeto:
 *  - usuário final: tem o cookie de sessão assinado DESTE projeto (emitido pelo servidor depois de validar o login);
 *  - membro: usuário do MetaBuilder que enxerga o projeto (a regra de acesso do banco, has_project_access, decide).
 * Qualquer outro caso é recusado.
 */
export async function authorizeProjectActor(req: NextRequest, projectId: string): Promise<RelayActor | null> {
  const session = verifyEndUserSession(req.cookies.get(endUserCookieName(projectId))?.value, projectId)

  // Quem é do projeto E também entrou no app publicado como usuário final (a IDE guarda os dois logins no mesmo navegador):
  //  - nas telas do desenvolvedor (Studio, IDE) continua sendo tratado como desenvolvedor;
  //  - nas páginas do app publicado vale o usuário final, para o desenvolvedor testar o app exatamente como aquele usuário o vê
  //    (regras por linha, auditoria "por"). Só ESTREITA o acesso: o cabeçalho de origem não dá poder a ninguém, porque ser
  //    membro depende do login do MetaBuilder, não dele.
  if (session && isPublishedAppPage(req)) return { kind: 'end_user', session }

  const memberId = await memberIdOf(projectId)
  if (memberId) return { kind: 'member', userId: memberId }

  if (session) return { kind: 'end_user', session }
  return await anonymousIfPublic(req, projectId).catch(() => null)
}

// Rotas do próprio MetaBuilder; qualquer outro primeiro segmento é o workspace de um app publicado (/{workspace}/{projeto}/{tela})
const PLATFORM_ROUTES = new Set(['admin', 'workspace', 'ide-local', 'tunnel-logs', 'bpm', 'app-preview', 'client', 'api', 'auth', 'login', 'downloads', 'agendamento', 'beta', 'checkout', 'features', 'privacy', 'splash', 'terms', 'app', 'actions'])

/** O comando saiu de uma página do app publicado (e não de uma tela do desenvolvedor)? Sem origem informada, não. */
export function isPublishedAppPage(req: NextRequest): boolean {
  const ref = req.headers.get('referer')
  if (!ref) return false
  try {
    const parts = new URL(ref).pathname.split('/').filter(Boolean)
    return parts.length >= 3 && !PLATFORM_ROUTES.has(parts[0].toLowerCase())
  } catch {
    return false
  }
}

export interface DownloadOwner { id: string; kind: 'end_user' | 'member' | 'anonymous' }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ANONYMOUS_OWNER = '00000000-0000-0000-0000-000000000000'

/**
 * Dono dos arquivos exportados (`download_jobs.user_id`, uma coluna UUID). Vem SEMPRE da sessão, nunca do que o navegador
 * diz. Mesma ordem que a tela de downloads usa para saber quem está vendo: usuário final do app (cookie assinado) →
 * membro do projeto (login do MetaBuilder) → visitante de um projeto sem login.
 * Devolve null se não for ninguém, e `{ error }` se o usuário final não tem um identificador UUID (a coluna não aceitaria).
 */
export async function resolveDownloadOwner(req: NextRequest, projectId: string): Promise<DownloadOwner | { error: string } | null> {
  const session = verifyEndUserSession(req.cookies.get(endUserCookieName(projectId))?.value, projectId)
  if (session) {
    return UUID_RE.test(session.sub)
      ? { id: session.sub.toLowerCase(), kind: 'end_user' }
      : { error: 'A exportação de arquivos exige que a tabela de usuários do projeto tenha uma chave primária do tipo UUID.' }
  }
  const memberId = await memberIdOf(projectId)
  if (memberId) return { id: memberId, kind: 'member' }
  if (await isProjectPublic(projectId).catch(() => false)) return { id: ANONYMOUS_OWNER, kind: 'anonymous' }
  return null
}

/** Id do usuário do MetaBuilder se ele enxerga o projeto (regra de acesso do banco); senão, null. */
async function memberIdOf(projectId: string): Promise<string | null> {
  try {
    const supabase = await createSessionClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const key = `${user.id}:${projectId}`
    const until = memberCache.get(key)
    if (until && until > Date.now()) return user.id
    // a política de leitura de "projects" só devolve o projeto a quem tem acesso a ele
    const { data } = await supabase.from('projects').select('id').eq('id', projectId).maybeSingle()
    if (!data) return null
    memberCache.set(key, Date.now() + MEMBER_TTL_MS)
    if (memberCache.size > 2000) for (const [k, v] of memberCache) if (v < Date.now()) memberCache.delete(k)
    return user.id
  } catch {
    return null
  }
}

/** Visitante sem login de um projeto aberto: tratado como usuário final anônimo (identificado pelo IP para o limite de uso). */
async function anonymousIfPublic(req: NextRequest, projectId: string): Promise<RelayActor | null> {
  if (!(await isProjectPublic(projectId))) return null
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'ip'
  return { kind: 'end_user', session: { pid: projectId, sub: `anon:${ip}` } }
}
