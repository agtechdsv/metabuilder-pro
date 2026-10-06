import type { SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { getProjectSecretToken, serviceClient, TunnelTimeoutError, tunnelCall } from './server'

/**
 * "Teste de conexão" do túnel feito pelo servidor: manda `SELECT 1` ao Agente CLI do projeto e mede o tempo.
 * Serve para validar o caminho novo (servidor → túnel → agente → banco) ANTES de ligar o relay para todo mundo.
 */

export type DiagnoseResult =
  | { ok: true; ms: number }
  | { ok: false; reason: 'no_project' | 'no_token' | 'offline' | 'agent_error' | 'transport'; detail?: string }

export interface DiagnoseDeps {
  client?: Pick<SupabaseClient, 'from'>
  token?: (projectId: string) => Promise<string | null>
  call?: (projectId: string, payload: Record<string, any>) => Promise<any>
  now?: () => number
}

export async function diagnoseTunnel(projectId: string, deps: DiagnoseDeps = {}): Promise<DiagnoseResult> {
  const client = deps.client ?? serviceClient()
  const now = deps.now ?? Date.now
  const { data: project } = await client.from('projects').select('id, db_type').eq('id', projectId).maybeSingle()
  if (!project) return { ok: false, reason: 'no_project' }
  const token = await (deps.token ?? getProjectSecretToken)(projectId)
  if (!token) return { ok: false, reason: 'no_token' }

  // o agente de um projeto com vários bancos só responde ao schema dele: usa o primeiro schema cadastrado
  const { data: models } = await client.from('models').select('db_schema_name').eq('project_id', projectId).limit(1)
  const schemaName = (models as any)?.[0]?.db_schema_name || 'public'
  const oracle = String((project as any).db_type || '').toLowerCase() === 'oracle'
  const sql = oracle ? 'SELECT 1 AS "ok" FROM DUAL' : 'SELECT 1 AS ok'

  const call = deps.call ?? ((pid: string, payload: Record<string, any>) => tunnelCall(pid, 'sql_query', payload as any, { timeoutMs: 10_000 }))
  const started = now()
  try {
    const res = await call(projectId, {
      queryId: randomUUID(), token, projectId, action: 'select', table: 'diagnostico', schemaName, query: sql, sql, limit: 1,
    })
    if (res?.success) return { ok: true, ms: now() - started }
    return { ok: false, reason: 'agent_error', detail: typeof res?.error === 'string' ? res.error.slice(0, 200) : undefined }
  } catch (e) {
    if (e instanceof TunnelTimeoutError) return { ok: false, reason: 'offline' }
    return { ok: false, reason: 'transport', detail: e instanceof Error ? e.message.slice(0, 200) : undefined }
  }
}
