import type { SupabaseClient } from '@supabase/supabase-js'
import { verifyCommandSignature } from './commandSigning'
import { getProjectSecretToken, serviceClient } from './server'

/**
 * Ação "Download" das automações: o Agente CLI gerou um arquivo na pasta de exportações dele e pede ao servidor que o registre na
 * Central de Downloads de cada destinatário (uma linha em `download_jobs` por pessoa; cada um só vê a sua).
 *
 * Autenticado pela ASSINATURA do comando com o token do projeto (nunca por cookie): só o Agente daquele projeto consegue. O caminho do
 * arquivo é do Agente e ele só serve arquivos de dentro da pasta de exportações (o servidor não confia nem usa o caminho para ler nada).
 * Os destinatários precisam ter id UUID: é assim que a Central identifica o dono do arquivo.
 */
export const AUTOMATION_DOWNLOAD_EVENT = 'automation_download'
export const MAX_DOWNLOAD_RECIPIENTS = 200

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FILE_TYPES = new Set(['xlsx', 'csv', 'pdf', 'json', 'ofx'])
const seen = new Map<string, number>()

export type DeliverResult = { ok: true; delivered: number } | { ok: false; status: number; error: string }

export const DOWNLOAD_REFRESH_EVENT = 'download_refresh'

export interface DeliverDeps {
  client?: Pick<SupabaseClient, 'from'>
  token?: (projectId: string) => Promise<string | null>
  now?: () => number
  seen?: Map<string, number>
  /** Avisa as Centrais de Downloads abertas (padrão: broadcast em tempo real). */
  notify?: (projectId: string, userIds: string[]) => Promise<void>
}

/**
 * Avisa as telas abertas que há arquivo novo. O aviso NÃO leva dados do arquivo: só os ids de quem deve recarregar a lista (a lista em si
 * vem da API, com a autorização de sempre). Nunca derruba a entrega: se o aviso falhar, o arquivo já está gravado e aparece ao abrir a tela.
 */
async function notifyDownloadsScreens(projectId: string, userIds: string[]): Promise<void> {
  const channel = serviceClient().channel(`tunnel_manager:${projectId}`)
  try {
    await channel.httpSend(DOWNLOAD_REFRESH_EVENT, { userIds })
  } finally {
    void channel.unsubscribe()
  }
}

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '')

/** Nome do arquivo que o usuário vê e baixa: sem caminho nem caracteres estranhos. */
export const cleanFileName = (v: unknown): string => text(v, 255).replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '')

export async function applyAutomationDownload(projectId: unknown, command: unknown, deps: DeliverDeps = {}): Promise<DeliverResult> {
  if (typeof projectId !== 'string' || !UUID_RE.test(projectId) || !command || typeof command !== 'object') return { ok: false, status: 400, error: 'Pedido inválido.' }
  const c = command as Record<string, any>

  const secret = await (deps.token ?? getProjectSecretToken)(projectId)
  if (!secret) return { ok: false, status: 404, error: 'Projeto sem token.' }
  const verified = verifyCommandSignature(secret, AUTOMATION_DOWNLOAD_EVENT, projectId, c, { now: (deps.now ?? Date.now)(), seen: deps.seen ?? seen })
  if (!verified.ok) return { ok: false, status: 401, error: 'Assinatura inválida.' }

  if (!Array.isArray(c.recipients) || c.recipients.length === 0) return { ok: false, status: 400, error: 'Sem destinatários.' }
  const recipients = [...new Set(c.recipients.map((r: unknown) => String(r)))]
  if (recipients.length > MAX_DOWNLOAD_RECIPIENTS) return { ok: false, status: 400, error: `No máximo ${MAX_DOWNLOAD_RECIPIENTS} destinatários.` }
  if (recipients.some(r => !UUID_RE.test(r))) return { ok: false, status: 400, error: 'Destinatário inválido (o id precisa ser UUID).' }

  const fileName = cleanFileName(c.fileName)
  if (!fileName) return { ok: false, status: 400, error: 'Nome de arquivo inválido.' }
  if (typeof c.fileType !== 'string' || !FILE_TYPES.has(c.fileType)) return { ok: false, status: 400, error: 'Formato inválido.' }
  const localPath = text(c.localPath, 1000)
  if (!localPath || localPath.includes('\0')) return { ok: false, status: 400, error: 'Caminho do arquivo inválido.' }
  const recordCount = Number.isFinite(Number(c.recordCount)) && Number(c.recordCount) >= 0 ? Math.floor(Number(c.recordCount)) : 0
  const title = text(c.title, 200) || 'Automação'

  const client = deps.client ?? serviceClient()
  const { data: project, error: projectError } = await (client as any).from('projects').select('workspace_id').eq('id', projectId).maybeSingle()
  if (projectError || !project?.workspace_id) return { ok: false, status: 404, error: 'Projeto não encontrado.' }
  const { data: workspace, error: workspaceError } = await (client as any).from('workspaces').select('slug').eq('id', project.workspace_id).maybeSingle()
  if (workspaceError || !workspace?.slug) return { ok: false, status: 404, error: 'Workspace não encontrado.' }

  const rows = recipients.map(userId => ({
    user_id: userId,
    workspace_slug: workspace.slug,
    project_id: projectId,
    view_name: title,
    file_name: fileName,
    file_type: c.fileType,
    progress: 100,
    status: 'completed',
    record_count: recordCount,
    local_path: localPath,
  }))
  const { data, error } = await (client as any).from('download_jobs').insert(rows).select('id')
  if (error) return { ok: false, status: 502, error: 'Não foi possível registrar o arquivo.' }
  try {
    await (deps.notify ?? notifyDownloadsScreens)(projectId, recipients)
  } catch (e: any) {
    console.warn('[automationDownload] aviso às telas falhou (o arquivo já foi gravado):', e?.message)
  }
  return { ok: true, delivered: Array.isArray(data) ? data.length : rows.length }
}
