import { dayInBrasilia } from '@/lib/nfse/queue'

/** Quantos dias antes do vencimento a fatura deixa de ser "cobrança pendente" e vira só "próxima fatura" (o mesmo prazo do primeiro lembrete por e-mail). */
export const UPCOMING_INVOICE_DAYS = 3

const DAY = 86_400_000

/** Dias entre hoje (dia de Brasília) e o vencimento (YYYY-MM-DD). Negativo = já venceu. NaN se a data não valer. */
export function daysUntilDue(dueDate: string | null | undefined, now: Date = new Date()): number {
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}/.test(dueDate)) return NaN
  const due = Date.parse(`${dueDate.slice(0, 10)}T00:00:00Z`)
  const today = Date.parse(`${dayInBrasilia(now)}T00:00:00Z`)
  if (!Number.isFinite(due) || !Number.isFinite(today)) return NaN
  return Math.round((due - today) / DAY)
}

/**
 * A fatura em aberto ainda está longe de vencer? Então a tela do cliente a mostra como "Próxima fatura" (discreta, sem "evite interrupções"),
 * e não como "Cobrança pendente". Sem data válida, nunca é "longe": na dúvida, mostra o aviso normal.
 */
export function isInvoiceFarOff(dueDate: string | null | undefined, now: Date = new Date()): boolean {
  const d = daysUntilDue(dueDate, now)
  return Number.isFinite(d) && d > UPCOMING_INVOICE_DAYS
}
