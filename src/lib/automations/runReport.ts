/**
 * Execuções de fluxos de Automações / BPM reportadas pelo Agente CLI (POST /api/automations/runs) e
 * os dois ajustes do módulo no Studio: retenção de logs e e-mail de falhas (ui_views.layout_config da tela 'automations').
 */
export type RunStatus = 'success' | 'error' | 'loop'

export type RunReport = {
  workflowId: string | null
  workflowName: string
  status: RunStatus
  triggerSource: string | null
  startedAt: string
  finishedAt: string | null
  durationMs: number | null
  errorMessage: string | null
  details: Record<string, unknown>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const STATUSES: RunStatus[] = ['success', 'error', 'loop']
const MAX_DETAILS_BYTES = 20_000

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\u0000/g, '').trim().slice(0, max) : '')
const isoOrNull = (v: unknown): string | null => {
  if (typeof v !== 'string' && typeof v !== 'number') return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function parseRunReport(body: any): { ok: true; run: RunReport } | { ok: false; error: string } {
  const status = String(body?.status || '').toLowerCase() as RunStatus
  if (!STATUSES.includes(status)) return { ok: false, error: 'Status inválido (use success, error ou loop).' }

  const workflowId = typeof body?.workflow_id === 'string' && UUID_RE.test(body.workflow_id) ? body.workflow_id : null
  const workflowName = text(body?.workflow_name, 200)
  if (!workflowId && !workflowName) return { ok: false, error: 'Informe workflow_id ou workflow_name.' }

  const finishedAt = isoOrNull(body?.finished_at)
  const startedAt = isoOrNull(body?.started_at) || finishedAt || new Date().toISOString()
  const rawDuration = Number(body?.duration_ms)
  const durationMs = Number.isFinite(rawDuration) && rawDuration >= 0 ? Math.min(Math.round(rawDuration), 2_147_483_647) : null

  // details é livre, mas limitado: o token do projeto não pode virar um jeito de encher o banco
  let details: Record<string, unknown> = {}
  if (body?.details && typeof body.details === 'object' && !Array.isArray(body.details)) {
    if (JSON.stringify(body.details).length > MAX_DETAILS_BYTES) return { ok: false, error: 'details grande demais.' }
    details = body.details
  }

  return {
    ok: true,
    run: {
      workflowId,
      workflowName,
      status,
      triggerSource: text(body?.trigger_source, 100) || null,
      startedAt,
      finishedAt,
      durationMs,
      errorMessage: status === 'success' ? null : (text(body?.error_message, 2000) || null),
      details,
    },
  }
}

/** Retenção de logs em dias (ajuste do Studio). 0 = guardar para sempre; ausente ou inválido = 30. */
export function retentionDays(layoutConfig: any): number {
  const raw = layoutConfig?.log_retention
  if (raw === undefined || raw === null || raw === '') return 30
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return 30
  return Math.floor(n)
}

/** Data de corte: execuções anteriores a ela são apagadas. null = não apagar. */
export function retentionCutoff(days: number, now: Date = new Date()): Date | null {
  return days > 0 ? new Date(now.getTime() - days * 86_400_000) : null
}

const EMAIL_RE = /^[^\s@<>,;"'()[\]\\]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,24}$/

/** Destinatários do aviso de falha (o campo aceita mais de um e-mail separado por vírgula ou ponto e vírgula). */
export function failureRecipients(layoutConfig: any): string[] {
  const raw = typeof layoutConfig?.error_email === 'string' ? layoutConfig.error_email : ''
  return raw.split(/[;,]/).map((s: string) => s.trim()).filter((s: string) => EMAIL_RE.test(s)).slice(0, 5)
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function failureEmail(projectName: string, run: RunReport): { subject: string; html: string } {
  const label = run.workflowName || run.workflowId || 'fluxo'
  const what = run.status === 'loop' ? 'entrou em loop infinito' : 'terminou com erro'
  const subject = `[MetaBuilder] Automação "${label}" ${what}`.replace(/[\r\n]+/g, ' ').slice(0, 200)
  const rows = [
    ['Projeto', projectName],
    ['Fluxo', label],
    ['Situação', run.status === 'loop' ? 'Loop infinito' : 'Erro'],
    ['Início', run.startedAt],
    ...(run.durationMs !== null ? [['Duração', `${run.durationMs} ms`]] : []),
    ...(run.triggerSource ? [['Disparo', run.triggerSource]] : []),
    ...(run.errorMessage ? [['Mensagem', run.errorMessage]] : []),
  ]
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111">`
    + `<h2 style="margin:0 0 12px">Falha em automação</h2>`
    + `<table cellpadding="6" style="border-collapse:collapse">`
    + rows.map(([k, v]) => `<tr><td style="color:#666">${esc(k)}</td><td><b>${esc(String(v))}</b></td></tr>`).join('')
    + `</table><p style="color:#888;font-size:12px;margin-top:16px">Aviso do módulo Automações / BPM do MetaBuilder PRO.</p></div>`
  return { subject, html }
}
