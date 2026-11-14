// Regras PURAS dos avisos de cobranca (sem banco, sem rede): usadas pelo webhook (Edge Function), pela rotina diaria (Next) e pelos testes.
// Fica aqui, em _shared, para as duas pontas usarem exatamente a mesma conta.

export type MailLang = "pt" | "en" | "es";

/** Avisos ao CLIENTE. */
export const CUSTOMER_KINDS = [
  "invoice_created", "reminder_3d", "reminder_due", "overdue_1d", "overdue_3d", "suspended", "payment_received",
  "card_refused", "refunded", "canceled", "ending_soon",
] as const;
/** Avisos ao ADMIN. */
export const ADMIN_KINDS = ["admin_overdue", "admin_refund", "admin_unresolved", "admin_digest"] as const;
export type NoticeKind = (typeof CUSTOMER_KINDS)[number] | (typeof ADMIN_KINDS)[number];

export interface BillingSettings {
  /** desligado: nada e enviado e o atraso bloqueia no mesmo dia, como sempre foi */
  enabled: boolean;
  /** dias entre o aviso de vencida e a suspensao. 0 = suspende no mesmo dia (como antes) */
  graceDays: number;
  /** e-mail dos alertas ao admin (vazio = a caixa de envio do site) */
  adminEmail: string;
}

export const DEFAULT_BILLING_SETTINGS: BillingSettings = { enabled: false, graceDays: 3, adminEmail: "" };
export const MAX_GRACE_DAYS = 30;

/** Le o valor do ajuste com seguranca (qualquer coisa fora do esperado cai nos padroes). */
export function parseBillingSettings(value: unknown): BillingSettings {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const grace = Number(v.graceDays);
  return {
    enabled: v.enabled === true,
    graceDays: Number.isFinite(grace) ? Math.min(MAX_GRACE_DAYS, Math.max(0, Math.floor(grace))) : DEFAULT_BILLING_SETTINGS.graceDays,
    adminEmail: typeof v.adminEmail === "string" ? v.adminEmail.trim().slice(0, 200) : "",
  };
}

export const resolveLang = (v: unknown): MailLang => (v === "en" || v === "es" ? v : "pt");

const DAY = 86_400_000;

/** Dia (UTC, 00:00) de uma data ISO ou YYYY-MM-DD. NaN se invalida. */
export function dayStart(d: string | Date): number {
  const t = typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? Date.parse(d + "T00:00:00Z") : new Date(d).getTime();
  if (!Number.isFinite(t)) return NaN;
  return Math.floor(t / DAY) * DAY;
}

/** Quantos dias faltam para o vencimento (negativo = ja venceu). NaN se a data for invalida. */
export function daysToDue(dueDate: string, now: Date): number {
  return Math.round((dayStart(dueDate) - dayStart(now)) / DAY);
}

/**
 * Qual lembrete uma cobranca em aberto pede HOJE (a unicidade (tipo, referencia) na fila impede repetir):
 *  - pendente: de 3 dias antes ate o dia anterior = "reminder_3d"; no dia = "reminder_due";
 *  - vencida: a partir de 1 dia = "overdue_1d"; a partir de 3 dias = "overdue_3d".
 * Cadencia aprovada pelo dono: 3 dias antes, no dia, 1 dia depois e 3 dias depois.
 */
export function reminderKindFor(status: string, dueDate: string | null | undefined, now: Date): NoticeKind | null {
  if (!dueDate) return null;
  const d = daysToDue(dueDate, now);
  if (!Number.isFinite(d)) return null;
  if (status === "pending") {
    if (d === 0) return "reminder_due";
    if (d >= 1 && d <= 3) return "reminder_3d";
    return null;
  }
  if (status === "overdue") {
    const late = -d;
    if (late >= 3) return "overdue_3d";
    if (late >= 1) return "overdue_1d";
  }
  return null;
}

/** A carencia acabou? (overdue_since + graceDays dias <= agora). Sem data de atraso nunca suspende. */
export function graceExpired(overdueSince: string | null | undefined, graceDays: number, now: Date): boolean {
  if (!overdueSince) return false;
  const start = new Date(overdueSince).getTime();
  if (!Number.isFinite(start)) return false;
  return now.getTime() >= start + Math.max(0, graceDays) * DAY;
}

/** Data (dia) em que a conta sera suspensa se nada for pago. */
export function suspensionDate(overdueSince: string | null | undefined, graceDays: number): Date | null {
  if (!overdueSince) return null;
  const start = new Date(overdueSince).getTime();
  return Number.isFinite(start) ? new Date(start + Math.max(0, graceDays) * DAY) : null;
}

/** Referencia unica de um aviso por pagamento, ou por usuario e data (suspensao, cancelamento). */
export const noticeRef = (parts: (string | number | null | undefined)[]): string => parts.map(p => String(p ?? "")).join(":");

/** O dono pode ser avisado? So tem e-mail se o perfil tiver; e o idioma cai em portugues. */
export function isCustomerKind(kind: string): boolean {
  return (CUSTOMER_KINDS as readonly string[]).includes(kind);
}
