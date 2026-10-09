import type { SupabaseClient } from '@supabase/supabase-js'
import { verifyCommandSignature } from './commandSigning'
import { getProjectSecretToken, serviceClient } from './server'

/**
 * O Agente CLI avisa o servidor do andamento de uma exportação (processando, concluída, falhou).
 *
 * Antes o Agente gravava direto em `download_jobs` com a chave PÚBLICA do Supabase, o que exigia deixar a tabela aberta a
 * qualquer visitante (ler e gravar todos os jobs, inclusive o caminho dos arquivos). Agora o Agente manda um aviso ASSINADO
 * com o token do projeto e é o servidor quem grava (com a chave de serviço), só no job daquele projeto e só nos campos de
 * andamento. A tabela fica fechada ao público.
 */
export const EXPORT_PROGRESS_EVENT = 'export_progress'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const STATUSES = new Set(['processing', 'completed', 'failed'])
const seen = new Map<string, number>()

export type ProgressResult = { ok: true } | { ok: false; status: number; error: string }

export interface ProgressDeps {
  client?: Pick<SupabaseClient, 'from'>
  token?: (projectId: string) => Promise<string | null>
  now?: () => number
  seen?: Map<string, number>
}

const text = (v: unknown, max: number): string | undefined => (typeof v === 'string' ? v.slice(0, max) : undefined)

export async function applyExportProgress(projectId: unknown, command: unknown, deps: ProgressDeps = {}): Promise<ProgressResult> {
  if (typeof projectId !== 'string' || !UUID_RE.test(projectId) || !command || typeof command !== 'object') return { ok: false, status: 400, error: 'Pedido inválido.' }
  const c = command as Record<string, any>

  const secret = await (deps.token ?? getProjectSecretToken)(projectId)
  if (!secret) return { ok: false, status: 404, error: 'Projeto sem token.' }
  const verified = verifyCommandSignature(secret, EXPORT_PROGRESS_EVENT, projectId, c, { now: (deps.now ?? Date.now)(), seen: deps.seen ?? seen })
  if (!verified.ok) return { ok: false, status: 401, error: 'Assinatura inválida.' }

  const jobId = c.jobId
  if (typeof jobId !== 'string' || !UUID_RE.test(jobId)) return { ok: false, status: 400, error: 'Job inválido.' }
  const status = c.status
  if (typeof status !== 'string' || !STATUSES.has(status)) return { ok: false, status: 400, error: 'Status inválido.' }

  // só os campos de andamento, validados; nada de user_id, project_id ou outros
  const update: Record<string, unknown> = { status, updated_at: new Date((deps.now ?? Date.now)()).toISOString() }
  if (c.progress !== undefined) {
    const p = Number(c.progress)
    if (!Number.isFinite(p)) return { ok: false, status: 400, error: 'Progresso inválido.' }
    update.progress = Math.max(0, Math.min(100, Math.round(p)))
  }
  if (status === 'completed') {
    update.progress = 100
    const lp = text(c.localPath, 1000); if (lp) update.local_path = lp
    const fn = text(c.fileName, 255); if (fn) update.file_name = fn
    const rc = Number(c.recordCount); if (Number.isFinite(rc) && rc >= 0) update.record_count = Math.floor(rc)
  }
  if (status === 'failed') update.error_message = text(c.error, 500) ?? 'Falha na exportação.'

  const client = deps.client ?? serviceClient()
  let q = client.from('download_jobs').update(update as any).eq('id', jobId).eq('project_id', projectId)
  // o andamento não "volta atrás": um job concluído ou que falhou não recebe mais atualização de progresso
  if (status === 'processing') q = q.in('status', ['pending', 'processing'])
  const { data, error } = await (q as any).select('id')
  if (error) return { ok: false, status: 502, error: 'Não foi possível gravar.' }
  if (!data || data.length === 0) return { ok: false, status: 404, error: 'Job não encontrado.' }
  return { ok: true }
}
