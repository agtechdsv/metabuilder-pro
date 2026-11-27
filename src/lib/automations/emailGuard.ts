/**
 * Validação do pedido de envio de e-mail das automações (POST /api/automations/email).
 *
 * Quem chama é o Agente CLI, autenticado só pelo `secret_token` do projeto. Quem tiver esse token conseguiria usar o
 * servidor de e-mail da plataforma como um "disparador" aberto: por isso o pedido é limitado em destinatários, tamanho e
 * formato (nada de quebra de linha que injete cabeçalhos), e o uso é limitado por projeto (veja a rota).
 */
export const MAX_RECIPIENTS = 20
export const MAX_SUBJECT = 200
export const MAX_HTML_BYTES = 500_000

const EMAIL_RE = /^[^\s@<>,;"'()[\]\\]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,24}$/

/** Anexos das automações (planilha do resultado de uma consulta): poucos, pequenos e só xlsx/csv. O limite de corpo da plataforma é ~4,5 MB (base64 incha 33%). */
export const MAX_ATTACHMENTS = 2
export const MAX_ATTACHMENT_BYTES = 2_500_000
const ATTACHMENT_TYPES: Record<string, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv; charset=utf-8',
  pdf: 'application/pdf',
  json: 'application/json; charset=utf-8',
  ofx: 'application/x-ofx',
}
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/

export type EmailAttachment = { filename: string; content: Buffer; contentType: string }
export type EmailRequest = { to: string[]; subject: string; html: string; attachments?: EmailAttachment[] }

/** Valida os anexos: nome limpo, extensão permitida (o tipo vem dela, não do pedido) e tamanho total limitado. */
export function parseAttachments(raw: unknown): { ok: true; attachments: EmailAttachment[] } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, attachments: [] }
  if (!Array.isArray(raw)) return { ok: false, error: 'Anexos inválidos.' }
  if (raw.length > MAX_ATTACHMENTS) return { ok: false, error: `No máximo ${MAX_ATTACHMENTS} anexos por envio.` }
  const out: EmailAttachment[] = []
  let total = 0
  for (const item of raw) {
    const name = typeof item?.filename === 'string' ? item.filename.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80) : ''
    const ext = (name.split('.').pop() || '').toLowerCase()
    if (!name || !ATTACHMENT_TYPES[ext]) return { ok: false, error: 'Anexo inválido: só planilhas (.xlsx), CSV (.csv), PDF (.pdf), JSON (.json) e OFX (.ofx).' }
    const b64 = typeof item?.content === 'string' ? item.content : ''
    if (!b64 || !BASE64_RE.test(b64)) return { ok: false, error: 'Anexo inválido: conteúdo ausente ou corrompido.' }
    const content = Buffer.from(b64, 'base64')
    total += content.length
    if (content.length === 0 || total > MAX_ATTACHMENT_BYTES) return { ok: false, error: 'Anexos grandes demais (limite de ' + Math.floor(MAX_ATTACHMENT_BYTES / 1_000_000) + ' MB no total). Reduza o número de linhas da consulta.' }
    out.push({ filename: name, content, contentType: ATTACHMENT_TYPES[ext] })
  }
  return { ok: true, attachments: out }
}

export function parseEmailRequest(body: any): { ok: true; req: EmailRequest } | { ok: false; error: string } {
  const rawTo = body?.to
  const list = (Array.isArray(rawTo) ? rawTo : typeof rawTo === 'string' ? rawTo.split(/[;,]/) : []).map((s: unknown) => String(s).trim()).filter(Boolean)
  if (list.length === 0) return { ok: false, error: 'Informe ao menos um destinatário.' }
  if (list.length > MAX_RECIPIENTS) return { ok: false, error: `No máximo ${MAX_RECIPIENTS} destinatários por envio.` }
  for (const addr of list) if (!EMAIL_RE.test(addr)) return { ok: false, error: `Destinatário inválido: ${addr.slice(0, 80)}` }

  // quebra de linha no assunto permitiria injetar cabeçalhos (Bcc:, etc.): vira espaço (o assunto pode vir de dados do registro)
  const subject = (typeof body?.subject === 'string' ? body.subject : '').replace(/[\r\n]+/g, ' ').trim()
  if (!subject || subject.length > MAX_SUBJECT) return { ok: false, error: 'Assunto inválido (vazio ou maior que ' + MAX_SUBJECT + ' caracteres).' }

  const html = typeof body?.html === 'string' ? body.html : ''
  if (!html.trim()) return { ok: false, error: 'Corpo do e-mail vazio.' }
  if (Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) return { ok: false, error: 'Corpo do e-mail grande demais.' }

  const att = parseAttachments(body?.attachments)
  if (!att.ok) return { ok: false, error: att.error }

  return { ok: true, req: { to: list, subject, html, ...(att.attachments.length ? { attachments: att.attachments } : {}) } }
}
