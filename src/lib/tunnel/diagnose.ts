import type { SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { getProjectSecretToken, serviceClient, TunnelTimeoutError, tunnelCall } from './server'

/**
 * "Teste de conexão" do túnel feito pelo servidor: manda `SELECT 1` ao Agente CLI do projeto e mede o tempo.
 * Serve para validar o caminho (servidor → túnel → agente → banco) ANTES de ligar o relay para todo mundo, e também
 * descobre se o Agente já sabe verificar comandos assinados (sem isso não se pode ligar TUNNEL_SIGN).
 */

export type DiagnoseResult =
  | {
      ok: true
      ms: number
      /** true: o Agente respondeu a um comando ASSINADO (sem token no canal). false: só entende o formato antigo — atualize o CLI. */
      signed: boolean
    }
  | { ok: false; reason: 'no_project' | 'no_token' | 'offline' | 'agent_error' | 'transport'; detail?: string }

export type ProbeMode = 'signed' | 'legacy'

export interface DiagnoseDeps {
  client?: Pick<SupabaseClient, 'from'>
  token?: (projectId: string) => Promise<string | null>
  /** envia o comando de teste no modo indicado e devolve a resposta do Agente */
  call?: (projectId: string, payload: Record<string, any>, mode: ProbeMode, secret: string) => Promise<any>
  now?: () => number
}

const PROBE_TIMEOUT_MS: Record<ProbeMode, number> = { signed: 6_000, legacy: 8_000 }

async function defaultCall(projectId: string, payload: Record<string, any>, mode: ProbeMode, secret: string) {
  return mode === 'signed'
    ? tunnelCall(projectId, 'sql_query', payload as any, { timeoutMs: PROBE_TIMEOUT_MS.signed, secret })
    : tunnelCall(projectId, 'sql_query', { ...payload, token: secret } as any, { timeoutMs: PROBE_TIMEOUT_MS.legacy })
}

export async function diagnoseTunnel(projectId: string, deps: DiagnoseDeps = {}): Promise<DiagnoseResult> {
  const client = deps.client ?? serviceClient()
  const now = deps.now ?? Date.now
  const call = deps.call ?? defaultCall
  const { data: project } = await client.from('projects').select('id, db_type').eq('id', projectId).maybeSingle()
  if (!project) return { ok: false, reason: 'no_project' }
  const token = await (deps.token ?? getProjectSecretToken)(projectId)
  if (!token) return { ok: false, reason: 'no_token' }

  // o agente de um projeto com vários bancos só responde ao schema dele: usa o primeiro schema cadastrado
  const { data: models } = await client.from('models').select('db_schema_name').eq('project_id', projectId).limit(1)
  const schemaName = (models as any)?.[0]?.db_schema_name || 'public'
  const oracle = String((project as any).db_type || '').toLowerCase() === 'oracle'
  const sql = oracle ? 'SELECT 1 AS "ok" FROM DUAL' : 'SELECT 1 AS ok'
  const probe = () => ({ queryId: randomUUID(), projectId, action: 'select', table: 'diagnostico', schemaName, query: sql, sql, limit: 1 })

  const attempt = async (mode: ProbeMode): Promise<DiagnoseResult | 'silent'> => {
    const started = now()
    try {
      const res = await call(projectId, probe(), mode, token)
      if (res?.success) return { ok: true, ms: now() - started, signed: mode === 'signed' }
      return { ok: false, reason: 'agent_error', detail: typeof res?.error === 'string' ? res.error.slice(0, 200) : undefined }
    } catch (e) {
      if (e instanceof TunnelTimeoutError) return 'silent'
      return { ok: false, reason: 'transport', detail: e instanceof Error ? e.message.slice(0, 200) : undefined }
    }
  }

  // 1) comando assinado: é o caminho final. 2) se o Agente não respondeu, ele pode ser uma versão antiga (só entende o
  // token no comando) ou estar desligado: o formato antigo diferencia os dois casos.
  const signed = await attempt('signed')
  if (signed !== 'silent') return signed
  const legacy = await attempt('legacy')
  if (legacy === 'silent') return { ok: false, reason: 'offline' }
  return legacy
}
