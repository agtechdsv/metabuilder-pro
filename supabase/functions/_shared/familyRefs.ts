// Padrão de referências externas da Família PRO (MetaBuilderPRO, TraderMasterPRO, VeritumPRO) na conta do Asaas. Regras PURAS (sem rede), usadas pelo
// checkout e pelo webhook (Edge Functions), pela tela do SuperAdmin (Next) e pelos testes. Padrão completo em docs/familia-pro-referencias.md.
//
//   <app>_<entidade>_<id>[_<rótulo>_<valor>]...      tudo minúsculo, separado por "_"
//
//   app      mb = MetaBuilderPRO · tm = TraderMasterPRO · vt = VeritumPRO (2 letras, fixas, nunca reutilizadas)
//   entidade ws = workspace (pagamentos e assinaturas) · us = usuário (cliente no Asaas)
//   rótulos  l/u = licenças / upgrade · cy = ciclo (mo, qu, se, ye) · t = timestamp (segundos)
//
//   pagamento/assinatura  mb_ws_<32 hex do workspace>_l_3_cy_mo_t_1763000000     (upgrade: ..._u_2_...)
//   cliente               mb_us_<id do usuário>
//
// Os rótulos só precisam ser únicos DENTRO do app: o código do app vem primeiro, então não colidem com os dos outros.
// A referência do Asaas tem limite de 100 caracteres; o formato acima fica em ~64.

export const FAMILY_APPS = { mb: "MetaBuilderPRO", tm: "TraderMasterPRO", vt: "VeritumPRO" } as const;
export type FamilyAppCode = keyof typeof FAMILY_APPS;

/** Código DESTE app. Ao levar este módulo para outro app da família, troque só esta constante (e as entidades que ele usar). */
export const OWN_APP_CODE: FamilyAppCode = "mb";

/**
 * LEGADO: formatos de antes do padrão (w_<workspace>..., ws_..., u_...). Só existem em dados de TESTE (nenhum cliente real).
 * REMOVER NA PRIMEIRA LIMPEZA GERAL (quando os dados de teste forem zerados): esta constante, o formato antigo em parsePaymentRef e o teste do legado.
 */
export const LEGACY_OWN_REF_PREFIXES = ["w_", "ws_", "u_"] as const;

export type FamilyCycleCode = "mo" | "qu" | "se" | "ye";

export interface PaymentRefData {
  /** id do workspace, 32 caracteres hex, sem hífen */
  workspaceId: string;
  licenses: number;
  /** a cobrança é um upgrade (licenças acrescentadas), e não a compra normal */
  upgrade: boolean;
  cycleCode: FamilyCycleCode;
  /** segundos desde 1970 */
  timestamp: number;
}

/** Monta a referência de um pagamento/assinatura. O id do workspace entra sem hífen e em minúsculas. */
export function buildPaymentRef(a: PaymentRefData): string {
  const ws = a.workspaceId.replace(/-/g, "").toLowerCase();
  return `${OWN_APP_CODE}_ws_${ws}_${a.upgrade ? "u" : "l"}_${Math.max(0, Math.floor(a.licenses))}_cy_${a.cycleCode}_t_${Math.floor(a.timestamp)}`;
}

const familyRefPattern = new RegExp(`^${OWN_APP_CODE}_ws_([0-9a-f]{32})_(l|u)_(\\d{1,6})_cy_(mo|qu|se|ye)_t_(\\d{1,13})$`);
// LEGADO (remover junto com LEGACY_OWN_REF_PREFIXES): w_<workspace>_<l|u>_<licenças>_c_<ciclo>_<timestamp>
const legacyRefPattern = /^w_([0-9a-f]{32})_(l|u)_(\d{1,6})_c_(mo|qu|se|ye)_(\d{1,13})$/;

/** Lê uma referência de pagamento/assinatura do MetaBuilder. null se não for deste app ou não tiver o formato conhecido. */
export function parsePaymentRef(ref: unknown): (PaymentRefData & { legacy: boolean }) | null {
  if (typeof ref !== "string") return null;
  const m = familyRefPattern.exec(ref);
  const l = m ? null : legacyRefPattern.exec(ref);
  const hit = m || l;
  if (!hit) return null;
  return {
    workspaceId: hit[1],
    upgrade: hit[2] === "u",
    licenses: Number(hit[3]),
    cycleCode: hit[4] as FamilyCycleCode,
    timestamp: Number(hit[5]),
    legacy: !m,
  };
}

/** A referência é DESTE app? (código do app no início, ou o formato legado). */
export function isOwnRef(ref: unknown): boolean {
  if (typeof ref !== "string") return false;
  return ref.startsWith(`${OWN_APP_CODE}_`) || LEGACY_OWN_REF_PREFIXES.some(p => ref.startsWith(p));
}

/** Marca dos NOSSOS clientes no Asaas: mb_us_<id do usuário> (nunca se acha cliente só pelo e-mail: ele pode ser de outro app). */
export const OWN_CUSTOMER_REF_PREFIX = `${OWN_APP_CODE}_us_`;

export const ownCustomerRef = (userId: string): string => `${OWN_CUSTOMER_REF_PREFIX}${userId}`;

export function isOwnCustomerRef(ref: unknown): boolean {
  return typeof ref === "string" && ref.startsWith(OWN_CUSTOMER_REF_PREFIX);
}

/** De qual app da família é a referência? (null = não segue o padrão da família). O formato legado conta como deste app. */
export function appOfRef(ref: unknown): FamilyAppCode | null {
  if (typeof ref !== "string") return null;
  for (const code of Object.keys(FAMILY_APPS) as FamilyAppCode[]) {
    if (ref.startsWith(`${code}_`)) return code;
  }
  return LEGACY_OWN_REF_PREFIXES.some(p => ref.startsWith(p)) ? OWN_APP_CODE : null;
}
