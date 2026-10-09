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

export type EmailRequest = { to: string[]; subject: string; html: string }

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

  return { ok: true, req: { to: list, subject, html } }
}
