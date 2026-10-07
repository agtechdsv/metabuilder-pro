import { endUserCookieName, signEndUserSession, verifyEndUserSession, type EndUserSession } from './sessionToken'

/**
 * Login do usuário final, lado do servidor.
 *
 * Antes o navegador validava o login falando direto com o túnel e depois gravava, por conta própria, o cookie
 * `client_session_<projeto>` com a linha do usuário — qualquer um podia escrever esse cookie à mão. Agora o servidor
 * valida (vendo a resposta do CLI), e só ele emite a sessão assinada `mb_eu_<projeto>`. O cookie antigo continua sendo
 * gravado, mas só para a interface mostrar o nome; as decisões de acesso usam a sessão assinada.
 */

export type UserRow = Record<string, any>

const pick = (row: UserRow, keys: string[]): string | undefined => {
  for (const k of keys) {
    const v = row[k]
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v)
  }
  return undefined
}

/** Texto de exibição do usuário (a coluna configurada no Studio tem prioridade). */
export function displayNameOf(row: UserRow, displayColumn?: string): string | undefined {
  return (displayColumn && pick(row, [displayColumn, displayColumn.toLowerCase(), displayColumn.toUpperCase()])) ||
    pick(row, ['__display_name', 'nome', 'NOME', 'name', 'NAME'])
}

/** Identificador do usuário (o mesmo que o runtime usa nas permissões por papel). */
export function subjectOf(row: UserRow): string | undefined {
  return pick(row, ['id', 'ID', 'Id']) ?? pick(row, ['email', 'EMAIL', 'Email', 'mail'])
}

const MAX_ROW_BYTES = 3000
const MAX_VALUE_LEN = 300

/**
 * Parte da linha do usuário que vai dentro da sessão assinada (o cookie tem limite de 4 KB): só valores simples e
 * curtos. Serve às decisões do servidor, como papel e permissões por tela.
 */
export function compactRow(row: UserRow): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {}
  let size = 2
  for (const [k, v] of Object.entries(row)) {
    if (k.startsWith('__')) continue
    const simple = v === null || typeof v === 'number' || typeof v === 'boolean' || (typeof v === 'string' && v.length <= MAX_VALUE_LEN)
    if (!simple) continue
    const cost = JSON.stringify(k).length + JSON.stringify(v).length + 2
    if (size + cost > MAX_ROW_BYTES) continue
    out[k] = v as any
    size += cost
  }
  return out
}

/** Monta a sessão a partir da linha devolvida pelo Agente CLI. Devolve null se não há como identificar o usuário. */
export function buildSession(projectId: string, row: UserRow, displayColumn?: string): EndUserSession | null {
  const sub = subjectOf(row)
  if (!sub) return null
  return {
    pid: projectId,
    sub,
    email: pick(row, ['email', 'EMAIL', 'Email', 'mail']),
    name: displayNameOf(row, displayColumn),
    row: compactRow(row),
  }
}

export interface CookieSetter {
  set(name: string, value: string, options?: Record<string, any>): unknown
}

/** Grava os dois cookies do usuário final numa resposta: a sessão assinada e o cookie de exibição. */
export function setEndUserCookies(res: { cookies: CookieSetter }, projectId: string, user: UserRow, session: EndUserSession, secure: boolean) {
  // Sem maxAge: é cookie de SESSÃO, some ao fechar o navegador/app, junto com o de exibição abaixo (antes a sessão
  // assinada durava 7 dias e o de exibição não: o navegador reaberto continuava autorizado no servidor, mas a tela
  // mostrava "Entrar" e sem usuário). O prazo máximo de 7 dias fica dentro do próprio token assinado.
  res.cookies.set(endUserCookieName(projectId), signEndUserSession(session), {
    httpOnly: true, sameSite: 'lax', secure, path: '/',
  })
  // o mesmo formato que o navegador gravava: o valor é codificado uma única vez (pelo próprio Next); cookie de sessão do navegador
  res.cookies.set(`client_session_${projectId}`, JSON.stringify(user), { httpOnly: false, sameSite: 'lax', secure, path: '/' })
}

export function clearEndUserCookies(res: { cookies: CookieSetter }, projectId: string) {
  const gone = { path: '/', maxAge: 0, expires: new Date(0) }
  res.cookies.set(endUserCookieName(projectId), '', { ...gone, httpOnly: true })
  res.cookies.set(`client_session_${projectId}`, '', gone)
}

interface CookieReader { get(name: string): { value: string } | undefined }

/**
 * Usuário final da requisição, para as decisões de acesso do servidor.
 *  - relay ligado: SÓ vale a sessão assinada (devolve a linha do usuário que o login guardou nela);
 *  - relay desligado: comportamento antigo, lê o cookie `client_session_*` (que o navegador escreve).
 */
export function readClientUser(cookies: CookieReader, projectId: string, relay: boolean): UserRow | null {
  if (relay) {
    const s = verifyEndUserSession(cookies.get(endUserCookieName(projectId))?.value, projectId)
    if (!s) return null
    return { ...(s.row || {}), id: s.row?.id ?? s.row?.ID ?? s.sub, ...(s.email && !s.row?.email ? { email: s.email } : {}), ...(s.name ? { __display_name: s.name } : {}) }
  }
  const raw = cookies.get(`client_session_${projectId}`)?.value
  if (!raw) return null
  for (const text of [raw, safeDecode(raw)]) {
    try {
      const parsed = JSON.parse(text)
      if (parsed && typeof parsed === 'object') return parsed
    } catch { /* tenta a próxima forma */ }
  }
  return null
}

function safeDecode(s: string): string {
  try { return decodeURIComponent(s) } catch { return s }
}
