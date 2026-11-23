/**
 * Versão vigente dos documentos legais (Termos de Serviço e Política de Privacidade) e regra do aceite. Puro (sem banco, sem rede): serve ao checkout,
 * ao aviso do painel, às ações do servidor e aos testes. O texto em si mora em src/i18n/translations/{pt,en,es}.json (chaves terms.* e privacy.*), e a
 * linha "DOCUMENTO OFICIAL V3.0" de cada idioma precisa acompanhar esta constante (há teste).
 *
 * Mudou o texto de forma que o cliente precise aceitar de novo? Suba LEGAL_VERSION aqui e a linha de versão nos três idiomas: quem aceitou a versão anterior
 * volta a ver o aviso de aceite no painel. Ajuste só de redação (sem mudar o sentido) não precisa subir a versão.
 */
export const LEGAL_VERSION = '3.0'

/** Documentos que o cliente aceita juntos. */
export const LEGAL_DOCS = ['terms', 'privacy'] as const
export type LegalDoc = (typeof LEGAL_DOCS)[number]

/** De onde veio o aceite: o checkout (antes de pagar) ou o aviso do painel (clientes que já existiam). */
export const LEGAL_SOURCES = ['checkout', 'notice'] as const
export type LegalSource = (typeof LEGAL_SOURCES)[number]

export interface AcceptanceRow { doc: string; version: string }

/** O cliente aceitou a versão vigente de TODOS os documentos? (uma linha por documento e versão). */
export function isLegalAccepted(rows: AcceptanceRow[] | null | undefined, version: string = LEGAL_VERSION): boolean {
  const have = new Set((rows || []).filter(r => r.version === version).map(r => r.doc))
  return LEGAL_DOCS.every(d => have.has(d))
}

export const isLegalSource = (v: unknown): v is LegalSource => typeof v === 'string' && (LEGAL_SOURCES as readonly string[]).includes(v)
