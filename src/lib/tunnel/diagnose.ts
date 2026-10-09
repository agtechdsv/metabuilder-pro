import type { SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { getProjectSecretToken, serviceClient, TunnelTimeoutError, tunnelCall } from './server'

/**
 * "Teste de conexão" do túnel feito pelo servidor: manda `SELECT 1` ao Agente CLI do projeto, ASSINADO (é o único formato
 * que o Agente aceita), e mede o tempo. Valida o caminho servidor → túnel → agente → banco.
 */

/** Quanto poder tem o usuário do banco que o Agente usa (ver cli/dbPrivileges.js). Ausente: Agente anterior à 1.3.2 ou não deu para conferir. */
export interface DbPrivileges { level: 'ok' | 'warn' | 'danger' | 'unknown'; findings: string[] }

export type DiagnoseResult =
  | { ok: true; ms: number; privileges?: DbPrivileges }
  | { ok: false; reason: 'no_project' | 'no_token' | 'offline' | 'agent_error' | 'transport'; detail?: string }

export interface DiagnoseDeps {
  client?: Pick<SupabaseClient, 'from'>
  token?: (projectId: string) => Promise<string | null>
  /** envia o comando de teste assinado e devolve a resposta do Agente */
  call?: (projectId: string, payload: Record<string, any>, secret: string) => Promise<any>
  now?: () => number
}

const PROBE_TIMEOUT_MS = 8_000

async function defaultCall(projectId: string, payload: Record<string, any>, secret: string) {
  return tunnelCall(projectId, 'sql_query', payload as any, { timeoutMs: PROBE_TIMEOUT_MS, secret })
}

/** Pergunta ao Agente o poder do usuário do banco. Melhor esforço: um Agente antigo não conhece a ação e a resposta vem vazia. */
async function readPrivileges(call: NonNullable<DiagnoseDeps['call']>, projectId: string, token: string, schemaName: string, newId: () => string): Promise<DbPrivileges | undefined> {
  try {
    const res = await call(projectId, { queryId: newId(), projectId, action: 'db_privileges', schemaName }, token)
    const row = res?.success && Array.isArray(res.data) ? res.data[0] : null
    if (row && ['ok', 'warn', 'danger', 'unknown'].includes(row.level) && Array.isArray(row.findings)) {
      return { level: row.level, findings: row.findings.filter((f: unknown) => typeof f === 'string').slice(0, 20) }
    }
  } catch { /* sem resposta: segue sem a informação */ }
  return undefined
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
  // `access` vazio faz o teste ir assinado como comando de usuário final (v2): só o Agente 1.3+ o responde, então o teste também confere a versão
  const probe = { queryId: randomUUID(), projectId, action: 'select', table: 'diagnostico', schemaName, query: sql, sql, limit: 1, access: { policies: [], flags: {} } }

  const started = now()
  try {
    const res = await call(projectId, probe, token)
    if (res?.success) {
      const ms = now() - started
      const privileges = await readPrivileges(call, projectId, token, schemaName, randomUUID)
      return privileges ? { ok: true, ms, privileges } : { ok: true, ms }
    }
    return { ok: false, reason: 'agent_error', detail: typeof res?.error === 'string' ? res.error.slice(0, 200) : undefined }
  } catch (e) {
    // sem resposta: o Agente está desligado, não é deste projeto ou é anterior à v1.3 (que não entende o formato de acesso por tabela)
    if (e instanceof TunnelTimeoutError) return { ok: false, reason: 'offline' }
    return { ok: false, reason: 'transport', detail: e instanceof Error ? e.message.slice(0, 200) : undefined }
  }
}
