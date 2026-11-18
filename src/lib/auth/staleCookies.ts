/**
 * Limpeza dos cookies de login do Supabase que ficaram "presos" depois de a sessão morrer.
 *
 * Por que existe (17/11/2026): a VM tinha os cookies sb-*-auth-token como cookie SÓ do host www.metabuilderpro.com (criado antes de o site
 * passar a usar o escopo .metabuilderpro.com). Quando a renovação falhava (400), a biblioteca apagava o cookie no escopo novo, o antigo
 * continuava lá e voltava a ser lido: renovação, 400, renovação... para sempre (e o servidor também repetia com o mesmo cookie).
 *
 * Aqui apagamos o cookie em todos os escopos possíveis (host sozinho, www e domínio raiz), mas SÓ se ele ainda carrega o refresh token que
 * acabou de ser recusado: se outra aba já gravou uma sessão nova, nada é apagado.
 */

/** cookie do login: sb-<ref>-auth-token, com sufixo .0, .1... quando a sessão é grande */
export const AUTH_COOKIE_RE = /^(sb-.+-auth-token)(?:\.(\d+))?$/

export function parseCookieString(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of raw.split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const name = part.slice(0, i).trim()
    if (name) out[name] = part.slice(i + 1).trim()
  }
  return out
}

const decodeB64Url = (s: string): string => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  try {
    return decodeURIComponent(escape(atob(padded)))
  } catch {
    return ''
  }
}

/** Texto de cada sessão guardada em cookie (junta os pedaços .0, .1... e decodifica o prefixo base64-). */
export function authSessionTexts(cookies: Record<string, string>): { base: string; names: string[]; text: string }[] {
  const groups = new Map<string, { idx: number; name: string; value: string }[]>()
  for (const [name, value] of Object.entries(cookies)) {
    const m = name.match(AUTH_COOKIE_RE)
    if (!m) continue
    const list = groups.get(m[1]) ?? []
    list.push({ idx: m[2] === undefined ? -1 : Number(m[2]), name, value })
    groups.set(m[1], list)
  }
  return [...groups.entries()].map(([base, list]) => {
    list.sort((a, b) => a.idx - b.idx)
    const joined = list.map(p => decodeURIComponent(p.value)).join('')
    const text = joined.startsWith('base64-') ? decodeB64Url(joined.slice(7)) : joined
    return { base, names: list.map(p => p.name), text }
  })
}

/** O navegador tem algum cookie de login do Supabase (sb-<ref>-auth-token)? Só olha os nomes. */
export function hasAuthCookie(doc: { cookie: string } = document): boolean {
  try {
    return Object.keys(parseCookieString(doc.cookie)).some(n => AUTH_COOKIE_RE.test(n))
  } catch {
    return false
  }
}

/** Nomes dos cookies de login que ainda carregam este refresh token. */
export function cookiesHoldingToken(cookies: Record<string, string>, refreshToken: string): string[] {
  if (!refreshToken) return []
  return authSessionTexts(cookies).filter(s => s.text.includes(refreshToken)).flatMap(s => s.names)
}

/** Textos de cookie que expiram o nome em cada escopo: host sozinho, host atual e domínio raiz (com e sem www). */
export function expireStrings(names: string[], hostname: string, secure: boolean): string[] {
  const root = hostname.replace(/^www\./, '')
  const scopes = new Set<string>(['', `; domain=${hostname}`])
  if (root.includes('.')) { scopes.add(`; domain=.${root}`); scopes.add(`; domain=www.${root}`) }
  const tail = `; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${secure ? '; Secure' : ''}`
  return names.flatMap(n => [...scopes].map(s => `${n}=${s}${tail}`))
}

/** Apaga, no navegador, os cookies de login que ainda carregam este token (refresh ou de acesso). Devolve quantos nomes foram limpos. */
export function purgeStaleAuthCookies(
  refreshToken: string,
  doc: { cookie: string } = document,
  loc: { hostname: string; protocol: string } = window.location,
): number {
  try {
    const names = cookiesHoldingToken(parseCookieString(doc.cookie), refreshToken)
    for (const s of expireStrings(names, loc.hostname, loc.protocol === 'https:')) doc.cookie = s
    return names.length
  } catch {
    return 0
  }
}
