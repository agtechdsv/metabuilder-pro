import type { AccessDenied } from './access'

/**
 * Chamada do navegador ao servidor de consultas do BI (/api/bi/query). Devolve sempre no formato que o painel já lê do
 * Agente CLI ({ success, data, error }), para que o resto do painel não mude: o que falha vira `success: false`.
 */
export interface BiQueryResult {
  success: boolean
  data?: any[]
  error?: string
  /** a regra de acesso por linha negou (sem usuário ou sem o dado que a regra pede) */
  denied?: AccessDenied
  /** a falha foi do servidor (sem sessão, regra de acesso, conferência de tabelas, tempo...), não do banco do cliente */
  serverError?: true
  code?: string
  [k: string]: unknown
}

export async function fetchBiQuery(body: Record<string, unknown>, fetcher: typeof fetch = fetch): Promise<BiQueryResult> {
  try {
    const res = await fetcher('/api/bi/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json: any = await res.json().catch(() => ({}))
    if (res.ok) return json && typeof json === 'object' ? json : { success: false, error: 'Resposta inválida.' }
    if (res.status === 401) return { success: false, error: 'Sessão expirada: entre novamente.', code: 'unauthorized', serverError: true }
    if (res.status === 504) return { success: false, error: 'tempo esgotado', code: 'timeout', serverError: true }
    return { success: false, error: json?.error || `Erro ${res.status}`, code: json?.code, serverError: true, ...(json?.denied ? { denied: json.denied } : {}) }
  } catch {
    return { success: false, error: 'Não foi possível consultar os dados.', code: 'network', serverError: true }
  }
}
