/**
 * Disjuntor dos pedidos de renovação de token do Supabase (POST /auth/v1/token?grant_type=refresh_token).
 *
 * Por que existe: em 17/11/2026 um Chrome ficou mandando ~1.100 renovações por minuto, quase todas com 429. O limite do Supabase é por IP,
 * então esse loop bloqueou o login de todas as máquinas da mesma rede. A biblioteca não tira a sessão quando recebe 429 e qualquer
 * getSession/getUser seguinte tenta renovar de novo; se algo chama isso em laço, o 429 vira uma avalanche.
 *
 * O que faz (só para renovação; qualquer outra chamada passa direto):
 * - pedidos iguais ao mesmo tempo viram um só (mesmo refresh token no corpo);
 * - depois de um 429 ou 400, novos pedidos de renovação recebem na hora uma resposta 429 local, sem ir à rede, até o fim da pausa.
 * - além disso, se GET /auth/v1/user responder 403 session_not_found (sessão revogada com o token de acesso ainda válido), avisa quem
 *   chamou (onSessionGone) para limpar os cookies presos: sem isso a limpeza só acontecia quando o token vencesse e a renovação desse 400.
 * Nunca lança erro: no pior caso o usuário espera a pausa e tenta de novo.
 */
export interface RefreshGuardOptions {
  /** pausa depois de um 429 (limite do servidor) */
  cooldown429Ms?: number
  /** pausa depois de um 400 (token inválido): curta, só para não repetir o mesmo pedido */
  cooldown400Ms?: number
  now?: () => number
  /** chamado uma vez por pausa, com o motivo (diagnóstico) */
  onBlock?: (info: { status: number; until: number; refreshToken: string }) => void
  /**
   * chamado (uma vez por token) quando GET /auth/v1/user responde 403 session_not_found: a sessão deste token de acesso foi revogada
   * (outro dispositivo assumiu a vaga, logout em outro lugar...). Quem chama apaga os cookies que ainda carregam esse token.
   */
  onSessionGone?: (info: { accessToken: string }) => void
}

type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

const urlOf = (input: RequestInfo | URL): string => (typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)

export const isRefreshRequest = (input: RequestInfo | URL, init?: RequestInit): boolean => {
  const url = urlOf(input)
  if (!url.includes('/auth/v1/token') || !url.includes('grant_type=refresh_token')) return false
  const method = (init?.method || (typeof input === 'object' && 'method' in input ? (input as Request).method : 'GET') || 'GET').toUpperCase()
  return method === 'POST'
}

/** o refresh token que foi enviado neste pedido (para saber qual cookie ficou preso) */
const tokenOf = (init?: RequestInit): string => {
  try {
    const t = JSON.parse(typeof init?.body === 'string' ? init.body : '{}')?.refresh_token
    return typeof t === 'string' ? t : ''
  } catch {
    return ''
  }
}

/** GET /auth/v1/user (a consulta de "quem sou eu" que o supabase-js faz no getUser) */
export const isUserRequest = (input: RequestInfo | URL, init?: RequestInit): boolean => {
  const url = urlOf(input)
  if (!/\/auth\/v1\/user(\?|$)/.test(url)) return false
  const method = (init?.method || (typeof input === 'object' && 'method' in input ? (input as Request).method : 'GET') || 'GET').toUpperCase()
  return method === 'GET'
}

/** o token de acesso (Bearer) enviado neste pedido */
export const bearerOf = (input: RequestInfo | URL, init?: RequestInit): string => {
  try {
    const h = init?.headers ?? (typeof input === 'object' && 'headers' in input ? (input as Request).headers : undefined)
    let auth: string | null | undefined
    if (!h) auth = undefined
    else if (typeof (h as Headers).get === 'function') auth = (h as Headers).get('authorization')
    else if (Array.isArray(h)) auth = h.find(([k]) => k.toLowerCase() === 'authorization')?.[1]
    else auth = Object.entries(h as Record<string, string>).find(([k]) => k.toLowerCase() === 'authorization')?.[1]
    const m = /^Bearer\s+(\S+)$/i.exec(auth ?? '')
    return m ? m[1] : ''
  } catch {
    return ''
  }
}

const localLimited = () =>
  new Response(JSON.stringify({ code: 429, error_code: 'over_request_rate_limit', msg: 'Request rate limit reached' }), {
    status: 429,
    headers: { 'content-type': 'application/json' },
  })

export function createRefreshGuard(realFetch: FetchFn, opts: RefreshGuardOptions = {}): FetchFn {
  const cooldown429 = opts.cooldown429Ms ?? 60_000
  const cooldown400 = opts.cooldown400Ms ?? 5_000
  const now = opts.now ?? Date.now
  let blockedUntil = 0
  const inflight = new Map<string, Promise<Response>>()
  const goneSeen = new Set<string>()

  return async (input, init) => {
    if (!isRefreshRequest(input, init)) {
      const res = await realFetch(input, init)
      if (opts.onSessionGone && res.status === 403 && isUserRequest(input, init)) {
        const accessToken = bearerOf(input, init)
        if (accessToken && !goneSeen.has(accessToken)) {
          try {
            const body = await res.clone().json()
            if (body?.error_code === 'session_not_found') {
              goneSeen.add(accessToken)
              opts.onSessionGone({ accessToken })
            }
          } catch { /* corpo ilegível: não faz nada */ }
        }
      }
      return res
    }

    if (now() < blockedUntil) return localLimited()

    const key = typeof init?.body === 'string' ? init.body : ''
    if (key) {
      const pending = inflight.get(key)
      if (pending) return (await pending).clone()
    }

    const run = (async () => {
      const res = await realFetch(input, init)
      if (res.status === 429 || res.status === 400) {
        const until = now() + (res.status === 429 ? cooldown429 : cooldown400)
        if (until > blockedUntil) {
          blockedUntil = until
          opts.onBlock?.({ status: res.status, until, refreshToken: tokenOf(init) })
        }
      }
      return res
    })()

    if (key) {
      inflight.set(key, run)
      run.then(() => inflight.delete(key), () => inflight.delete(key))
    }
    return key ? (await run).clone() : run
  }
}
