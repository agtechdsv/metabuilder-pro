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
  // Membro primeiro: quem é do projeto e também entrou no app publicado como usuário final (a IDE guarda os dois logins
  // no mesmo navegador) continua sendo tratado como desenvolvedor no Studio, em vez de cair nas limitações do usuário final.
  const memberId = await memberIdOf(projectId)
  if (memberId) return { kind: 'member', userId: memberId }

  const session = verifyEndUserSession(req.cookies.get(endUserCookieName(projectId))?.value, projectId)
  if (session) return { kind: 'end_user', session }
  return await anonymousIfPublic(req, projectId).catch(() => null)
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
