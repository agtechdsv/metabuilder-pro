/**
 * Fila de notas fiscais (NFS-e): regras PURAS (sem banco, sem rede), usadas pelas ações do servidor, pela tela do SuperAdmin e pelos testes.
 * O SQL está em scripts/nfse-fila.sql; a conta da data de emissão aqui e a mesma que a trigger faz no banco.
 *
 * A nota sai 8 dias depois do pagamento (7 dias de arrependimento + 1). Por isso nunca precisa ser cancelada por desistencia.
 */

/** Emissor do contador (Lunis) já no modelo do MetaBuilderPRO (modelo 92, serviço 01.05.01). */
export const NFSE_LUNIS_URL = 'https://cliente.lunis.ia.br/nfse/emitir?cnpj=19287384000101&modelo=92'

/** manual = tudo emitido por voce; hybrid = emissão no mesmo mês do pagamento é automática, a do mês seguinte é manual; auto = tudo automático. */
export const NFSE_MODES = ['manual', 'hybrid', 'auto'] as const
export type NfseMode = (typeof NFSE_MODES)[number]
export const DEFAULT_NFSE_MODE: NfseMode = 'manual'

/** A emissão automática ainda não existe (depende da API do contador ou do Asaas). Enquanto for false, só o modo manual pode ser escolhido. */
export const NFSE_AUTO_AVAILABLE = false
export const availableNfseModes = (): NfseMode[] => (NFSE_AUTO_AVAILABLE ? [...NFSE_MODES] : ['manual'])

export const DEFAULT_WAIT_DAYS = 8
export const MIN_WAIT_DAYS = 0
export const MAX_WAIT_DAYS = 60

export type NfseStatus = 'pending' | 'issued' | 'canceled'
export const isNfseStatus = (v: unknown): v is NfseStatus => v === 'pending' || v === 'issued' || v === 'canceled'

export function parseNfseMode(v: unknown): NfseMode {
  const raw = v && typeof v === 'object' ? (v as Record<string, unknown>).mode : v
  return (NFSE_MODES as readonly unknown[]).includes(raw) ? (raw as NfseMode) : DEFAULT_NFSE_MODE
}

export function parseWaitDays(v: unknown): number {
  const raw = v && typeof v === 'object' ? (v as Record<string, unknown>).days : v
  const n = Math.trunc(Number(raw))
  return Number.isFinite(n) ? Math.min(MAX_WAIT_DAYS, Math.max(MIN_WAIT_DAYS, n)) : DEFAULT_WAIT_DAYS
}

// --- datas (sempre em horário de Brasília, UTC-3 o ano todo) ---------------------------------------------------------------------------------

const BRT_OFFSET_MS = 3 * 3_600_000
const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`

/** O dia (AAAA-MM-DD) em Brasília de um instante. */
export function dayInBrasilia(instant: Date | string | number): string {
  return ymd(new Date(new Date(instant).getTime() - BRT_OFFSET_MS))
}

const dayToUtc = (day: string) => {
  const [y, m, d] = day.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export const addDays = (day: string, n: number): string => ymd(new Date(dayToUtc(day) + n * 86_400_000))

/** Dia em que a nota deve ser emitida: dia do pagamento (em Brasília) + prazo. */
export const emitOnFrom = (paidAt: Date | string | number, waitDays: number = DEFAULT_WAIT_DAYS): string => addDays(dayInBrasilia(paidAt), parseWaitDays(waitDays))

/** Quantos dias de `a` até `b` (positivo se b é depois). */
export const daysBetween = (a: string, b: string): number => Math.round((dayToUtc(b) - dayToUtc(a)) / 86_400_000)

export const formatDateBr = (day: string | null | undefined): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day || '')
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

// --- quem emite e o prazo ------------------------------------------------------------------------------------------------------------------

export type Issuer = 'me' | 'auto'

/** Quem emite esta nota, conforme o modo. `paidOn` e `emitOn` são dias (AAAA-MM-DD). No híbrido, mesmo mês = automática. */
export function whoIssues(mode: NfseMode, paidOn: string, emitOn: string): Issuer {
  if (mode === 'auto') return 'auto'
  if (mode === 'hybrid') return paidOn.slice(0, 7) === emitOn.slice(0, 7) ? 'auto' : 'me'
  return 'me'
}

/** Quem emite de verdade hoje: enquanto a automática não existe, tudo cai para você. */
export const effectiveIssuer = (mode: NfseMode, paidOn: string, emitOn: string): Issuer =>
  NFSE_AUTO_AVAILABLE ? whoIssues(mode, paidOn, emitOn) : 'me'

export type DueState = 'late' | 'today' | 'soon' | 'future'

/** Situação do prazo: atrasada, é hoje, vence nos próximos 2 dias, ou ainda longe. `days` = dias de atraso (late) ou até lá (demais). */
export function dueState(emitOn: string, today: string): { state: DueState; days: number } {
  const diff = daysBetween(today, emitOn)
  if (diff < 0) return { state: 'late', days: -diff }
  if (diff === 0) return { state: 'today', days: 0 }
  return { state: diff <= 2 ? 'soon' : 'future', days: diff }
}

// --- campos para copiar ---------------------------------------------------------------------------------------------------------------------------

export const onlyDigits = (s: unknown): string => String(s ?? '').replace(/\D+/g, '')

/** CPF (11) ou CNPJ (14) formatado; qualquer outra coisa volta como veio. */
export function formatDoc(s: unknown): string {
  const d = onlyDigits(s)
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  return String(s ?? '')
}

/** Valor como o emissor espera digitar: 349,00 (vírgula, duas casas, sem milhar). */
export function moneyForCopy(v: number | string): string {
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(2).replace('.', ',') : ''
}

export const moneyBr = (v: number | string): string => {
  const n = Number(v)
  return Number.isFinite(n) ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n) : ''
}

// --- PDF anexado ------------------------------------------------------------------------------------------------------------------------------------

/** Limite do PDF (o corpo de uma ação do servidor tem teto de 1 MB, e o base64 cresce um terço). */
export const MAX_PDF_BYTES = 600 * 1024

export type PdfCheck = { ok: true; bytes: Buffer } | { ok: false; code: 'empty' | 'too_big' | 'not_pdf' }

export function checkPdfBase64(b64: unknown): PdfCheck {
  if (typeof b64 !== 'string' || !b64) return { ok: false, code: 'empty' }
  if (b64.length > Math.ceil((MAX_PDF_BYTES * 4) / 3) + 8) return { ok: false, code: 'too_big' }
  const bytes = Buffer.from(b64, 'base64')
  if (!bytes.length) return { ok: false, code: 'empty' }
  if (bytes.length > MAX_PDF_BYTES) return { ok: false, code: 'too_big' }
  if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-') return { ok: false, code: 'not_pdf' }
  return { ok: true, bytes }
}

/** Nome do arquivo anexado ao e-mail: só letras, números, ponto, hífen e sublinhado; sempre .pdf. */
export function safePdfName(name: unknown, fallback = 'NFS-e.pdf'): string {
  const base = String(name ?? '').replace(/\.pdf$/i, '').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^[._-]+|[._-]+$/g, '').slice(0, 80)
  return base ? `${base}.pdf` : fallback
}
