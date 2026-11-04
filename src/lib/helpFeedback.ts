/**
 * Feedback da ajuda contextual ("Isto ajudou?"): validação pura do que o navegador manda.
 * O servidor monta o comando ao Agente CLI só com estes campos, e quem votou vem SEMPRE da sessão, nunca daqui.
 */

export const HELP_FEEDBACK_MAX_COMMENT = 500
const MAX_ID = 120
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SAFE_ID = /^[\w\-.:]+$/

export interface HelpFeedbackInput {
  projectId: string
  /** tela (id do caso de uso); sempre informada quando conhecida */
  screen: string | null
  /** campo (id); vazio = feedback da ajuda da tela */
  field: string | null
  vote: 'up' | 'down'
  comment: string | null
  language: string | null
}

export function parseHelpFeedback(body: unknown): { ok: true; value: HelpFeedbackInput } | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'Pedido inválido.' }
  const b = body as Record<string, unknown>
  if (typeof b.projectId !== 'string' || !UUID.test(b.projectId)) return { ok: false, error: 'Projeto inválido.' }
  if (b.vote !== 'up' && b.vote !== 'down') return { ok: false, error: 'Voto inválido.' }

  const id = (v: unknown): string | null | undefined => {
    if (v === undefined || v === null || v === '') return null
    if (typeof v !== 'string' || v.length > MAX_ID || !SAFE_ID.test(v)) return undefined
    return v
  }
  const screen = id(b.screen)
  const field = id(b.field)
  if (screen === undefined || field === undefined) return { ok: false, error: 'Identificador inválido.' }
  if (!screen && !field) return { ok: false, error: 'Informe a tela ou o campo.' }

  let comment: string | null = null
  if (b.comment !== undefined && b.comment !== null) {
    if (typeof b.comment !== 'string') return { ok: false, error: 'Comentário inválido.' }
    comment = b.comment.trim().slice(0, HELP_FEEDBACK_MAX_COMMENT) || null
  }
  const language = typeof b.language === 'string' && /^[a-z]{2}(-[A-Za-z]{2})?$/.test(b.language) ? b.language : null

  return { ok: true, value: { projectId: b.projectId, screen, field, vote: b.vote, comment, language } }
}
