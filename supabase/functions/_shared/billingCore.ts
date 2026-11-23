// Regras PURAS dos avisos de cobranca (sem banco, sem rede): usadas pelo webhook (Edge Function), pela rotina diaria (Next) e pelos testes.
// Fica aqui, em _shared, para as duas pontas usarem exatamente a mesma conta.

export type MailLang = "pt" | "en" | "es";

/** Avisos ao CLIENTE. */
export const CUSTOMER_KINDS = [
  "invoice_created", "reminder_3d", "reminder_due", "overdue_1d", "overdue_3d", "suspended", "payment_received",
  "card_refused", "refunded", "canceled", "ending_soon", "checkout_reminder",
] as const;
/** Avisos ao ADMIN. */
export const ADMIN_KINDS = ["admin_overdue", "admin_refund", "admin_unresolved", "admin_digest", "admin_key_alert"] as const;
/**
 * Avisos dos repasses a parceiros. Saem SEMPRE (não dependem do interruptor dos avisos de cobrança): são transacionais e ligados a um Pix que o
 * SuperAdmin mandou fazer. "partner_payout_paid" vai ao parceiro (um por item do lote, quando o Asaas conclui o Pix); "admin_payout_summary" vai
 * ao admin (um por lote, quando todos os itens terminaram: pagos ou com falha).
 */
export const PAYOUT_KINDS = ["partner_payout_paid", "admin_payout_summary"] as const;
/** Boas-vindas ao cliente novo (um por usuário). Também sai sempre, sem depender do interruptor dos avisos de cobrança. */
export const WELCOME_KIND = "welcome" as const;
export type NoticeKind = (typeof CUSTOMER_KINDS)[number] | (typeof ADMIN_KINDS)[number] | (typeof PAYOUT_KINDS)[number] | typeof WELCOME_KIND;
/** O que sai mesmo com os avisos de cobrança desligados (avisos transacionais). */
export const ALWAYS_SEND_KINDS = [...PAYOUT_KINDS, WELCOME_KIND, "admin_key_alert"] as const;

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

/**
 * Cliente FREE que so gerou o checkout e nunca pagou (plano gratis e nenhum pagamento 'paid'). Esse cliente NUNCA e suspenso nem recebe os avisos de
 * atraso do PRO: so um lembrete suave (ver checkoutReminderStep). O app ja ignora o bloqueio de conta FREE, entao suspender so geraria um e-mail falso.
 */
export function isCheckoutOnly(tier: string | null | undefined, paidCount: number): boolean {
  const t = String(tier ?? '').trim().toLowerCase();
  return (t === '' || t === 'free') && !(paidCount > 0);
}

/** Lembretes do checkout abandonado: 1 dia e 3 dias depois de gerada a cobranca. Depois de MAX dias nao avisa mais. 0 = nada hoje. */
export const CHECKOUT_REMINDER_MAX_DAYS = 10;
export function checkoutReminderStep(createdAt: string | Date | null | undefined, now: Date): 0 | 1 | 3 {
  if (!createdAt) return 0;
  const t = new Date(createdAt).getTime();
  if (!Number.isFinite(t)) return 0;
  const age = Math.floor((now.getTime() - t) / DAY);
  if (age > CHECKOUT_REMINDER_MAX_DAYS) return 0;
  return age >= 3 ? 3 : age >= 1 ? 1 : 0;
}

/**
 * Reativação: assinatura CANCELADA (o cliente, ou o SuperAdmin, parou a renovação) com o acesso ainda pago. Devolve o dia (YYYY-MM-DD, horário de Brasília)
 * da primeira cobrança da assinatura nova, que é o fim do acesso: assim não se cobra duas vezes o mesmo período. null se não for reativação
 * (status diferente de cancelada, sem data de acesso, ou acesso já terminado: aí é uma compra nova, cobrada hoje).
 */
export function reactivationDueDate(status: string | null | undefined, accessEndsAt: string | Date | null | undefined, now: Date): string | null {
  if (String(status ?? "").trim().toLowerCase() !== "canceled") return null;
  if (!accessEndsAt) return null;
  const end = new Date(accessEndsAt).getTime();
  if (!Number.isFinite(end) || end <= now.getTime()) return null;
  return new Date(end - 3 * 3_600_000).toISOString().slice(0, 10); // Brasília é UTC-3 (sem horário de verão desde 2019)
}

/** A cobranca do checkout esta abandonada? Passou da janela dos lembretes (CHECKOUT_REMINDER_MAX_DAYS) sem pagar: a rotina cancela no Asaas. */
export function isCheckoutAbandoned(createdAt: string | Date | null | undefined, now: Date): boolean {
  if (!createdAt) return false;
  const t = new Date(createdAt).getTime();
  if (!Number.isFinite(t)) return false;
  return Math.floor((now.getTime() - t) / DAY) > CHECKOUT_REMINDER_MAX_DAYS;
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

export function isPayoutKind(kind: string): boolean {
  return (PAYOUT_KINDS as readonly string[]).includes(kind);
}

/** O lote terminou? Todos os itens estão pagos ou com falha (nenhum preparando, enviando ou aguardando o Asaas). Lote sem itens não termina. */
export function payoutIsFinal(itemStatuses: readonly string[]): boolean {
  return itemStatuses.length > 0 && itemStatuses.every(s => s === "done" || s === "failed");
}

/** O dono pode ser avisado? So tem e-mail se o perfil tiver; e o idioma cai em portugues. */
export function isCustomerKind(kind: string): boolean {
  return (CUSTOMER_KINDS as readonly string[]).includes(kind);
}
