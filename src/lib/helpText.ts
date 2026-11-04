/**
 * Ajuda contextual (dica de campo e ajuda de tela): um texto por idioma, escrito pelo DEV no Studio.
 *
 * Fica na configuração do caso de uso (`label.help` do campo, `screen_help` da tela), então vai junto no app ejetado
 * e não precisa de nenhuma tabela no banco do cliente.
 */

export const HELP_LANGS = ['pt', 'en', 'es'] as const
export type HelpLang = (typeof HELP_LANGS)[number]
export type HelpText = Partial<Record<HelpLang, string>>

const MAX_HELP_LENGTH = 2000

/** Aceita o formato atual ({ pt, en, es }) ou um texto simples (vale como português) e devolve só textos válidos */
export function normalizeHelp(raw: unknown): HelpText {
  if (typeof raw === 'string') return raw.trim() ? { pt: raw.trim().slice(0, MAX_HELP_LENGTH) } : {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: HelpText = {}
  for (const lang of HELP_LANGS) {
    const value = (raw as Record<string, unknown>)[lang]
    if (typeof value === 'string' && value.trim()) out[lang] = value.trim().slice(0, MAX_HELP_LENGTH)
  }
  return out
}

export function hasHelp(raw: unknown): boolean {
  return Object.keys(normalizeHelp(raw)).length > 0
}

/** Texto no idioma pedido; sem ele, cai para português, inglês, espanhol (o primeiro que existir) */
export function resolveHelp(raw: unknown, language: string | undefined): string {
  const help = normalizeHelp(raw)
  const preferred = HELP_LANGS.includes(language as HelpLang) ? [language as HelpLang] : []
  for (const lang of [...preferred, 'pt', 'en', 'es'] as HelpLang[]) {
    if (help[lang]) return help[lang] as string
  }
  return ''
}

/**
 * Cobertura da ajuda nos campos do formulário: quantos têm dica (em qualquer idioma).
 * `fieldsMetadata` é o `layout_config.fields_metadata` do Studio (chave `form-<id>` tem prioridade sobre `<id>`).
 */
export function helpCoverage(fieldIds: string[], fieldsMetadata: Record<string, any> | undefined): { withHelp: number; total: number } {
  const meta = fieldsMetadata || {}
  let withHelp = 0
  for (const id of fieldIds) {
    const specific = meta[`form-${id}`]?.label?.help
    const base = meta[id]?.label?.help
    if (hasHelp(specific) || hasHelp(base)) withHelp++
  }
  return { withHelp, total: fieldIds.length }
}
