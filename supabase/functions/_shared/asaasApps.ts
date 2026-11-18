// Vários apps na MESMA conta do Asaas (ex.: MetaBuilderPRO e TraderMasterPRO). Regras PURAS (sem rede), usadas pelo checkout, pelo webhook (Edge
// Functions), pela tela do SuperAdmin (Next) e pelos testes. Convenções em docs/asaas-varios-apps.md.
//
// O webhook do Asaas é da CONTA: todo evento de qualquer app chega ao nosso endereço. Por isso cada app precisa reconhecer o que é seu:
//  - pagamentos e assinaturas: pela referência externa (os nossos começam com w_, ws_ ou u_) ou por já existirem no nosso banco;
//  - chaves de API: pelo NOME da chave, cadastrado na tela "Apps neste Asaas" (aba Sistema);
//  - clientes: pela marca mb_<id do usuário> na referência externa do cliente (nunca por e-mail, que pode ser de outro app).

/** Referências externas dos NOSSOS pagamentos e assinaturas (checkout: w_..., legado: ws_ e u_). */
export const OWN_EXTERNAL_REF_PREFIXES = ["w_", "ws_", "u_"] as const;
/** Marca dos NOSSOS clientes no Asaas: mb_<id do usuário>. */
export const OWN_CUSTOMER_REF_PREFIX = "mb_";

export const ownCustomerRef = (userId: string): string => `${OWN_CUSTOMER_REF_PREFIX}${userId}`;

export function isOwnPaymentRef(ref: unknown): boolean {
  return typeof ref === "string" && OWN_EXTERNAL_REF_PREFIXES.some(p => ref.startsWith(p));
}

export function isOwnCustomerRef(ref: unknown): boolean {
  return typeof ref === "string" && ref.startsWith(OWN_CUSTOMER_REF_PREFIX);
}

export const MAX_ASAAS_APPS = 20;
export const MAX_ASAAS_APP_NAME = 60;

export interface AsaasApp {
  /** nome da chave de API como o Asaas informa (ex.: MetaBuilderPRO) */
  name: string;
  /** true = é a chave deste sistema; false = é a chave de OUTRO app que usa a mesma conta */
  own: boolean;
}

export interface AsaasAppsSettings {
  apps: AsaasApp[];
  /** aviso de chave de OUTRO app: "info" = e-mail discreto ("não afeta o MetaBuilder"); "none" = não avisa */
  otherKeyAlerts: "info" | "none";
}

/** Sem nada cadastrado, toda chave gera o alerta de urgência (o comportamento de sempre). */
export const DEFAULT_ASAAS_APPS: AsaasAppsSettings = { apps: [], otherKeyAlerts: "info" };

/** Chave de comparação do nome: sem acento, sem espaços nas pontas, minúscula. */
const asaasAppNameKey = (name: string): string => name.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

/** Lê o ajuste com segurança: qualquer coisa fora do esperado é descartada (nomes vazios, repetidos, longos demais). */
export function parseAsaasApps(value: unknown): AsaasAppsSettings {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const seen = new Set<string>();
  const apps: AsaasApp[] = [];
  if (Array.isArray(v.apps)) {
    for (const raw of v.apps) {
      if (apps.length >= MAX_ASAAS_APPS) break;
      const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      const name = typeof r.name === "string" ? r.name.trim().slice(0, MAX_ASAAS_APP_NAME) : "";
      if (!name) continue;
      const key = asaasAppNameKey(name);
      if (seen.has(key)) continue;
      seen.add(key);
      apps.push({ name, own: r.own === true });
    }
  }
  return { apps, otherKeyAlerts: v.otherKeyAlerts === "none" ? "none" : "info" };
}

export type KeyScope = "own" | "other" | "unknown";

/** A chave é nossa, de outro app registrado, ou desconhecida (sem nome, ou nome não cadastrado)? */
export function classifyKey(name: unknown, settings: AsaasAppsSettings): KeyScope {
  if (typeof name !== "string" || !name.trim()) return "unknown";
  const key = asaasAppNameKey(name);
  const app = settings.apps.find(a => asaasAppNameKey(a.name) === key);
  if (!app) return "unknown";
  return app.own ? "own" : "other";
}

/** Manda o alerta? Chave nossa e desconhecida: sempre (na dúvida, avisa). Chave de outro app: conforme o ajuste. */
export function keyAlertDecision(name: unknown, settings: AsaasAppsSettings): { send: boolean; scope: KeyScope } {
  const scope = classifyKey(name, settings);
  return { scope, send: scope !== "other" || settings.otherKeyAlerts !== "none" };
}

/**
 * O evento é de OUTRO app? Só quando a referência externa existe, NÃO tem o formato do MetaBuilder e o pagamento/assinatura NÃO está no nosso banco.
 * Sem referência: não dá para saber, então NÃO é tratado como de outro app (o alerta de "pagamento não identificado" continua valendo).
 */
export function isForeignAsaasEvent(a: { externalReference: unknown; isKnownPayment: boolean; isKnownSubscription: boolean }): boolean {
  const ref = a.externalReference;
  if (typeof ref !== "string" || !ref.trim()) return false;
  if (isOwnPaymentRef(ref)) return false;
  return !(a.isKnownPayment || a.isKnownSubscription);
}

/** Lê os apps cadastrados (platform_settings, chave asaas_apps). Qualquer falha = nada cadastrado = comportamento antigo. */
export async function loadAsaasApps(supabase: any): Promise<AsaasAppsSettings> {
  try {
    const { data } = await supabase.from("platform_settings").select("value").eq("key", "asaas_apps").maybeSingle();
    return parseAsaasApps(data?.value);
  } catch {
    return { ...DEFAULT_ASAAS_APPS };
  }
}
