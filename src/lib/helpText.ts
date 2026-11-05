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
    if (hasHelp(getZoneHelp(meta, id, 'form').help)) withHelp++
  }
  return { withHelp, total: fieldIds.length }
}

export const HELP_ZONES = ['filter', 'grid', 'form'] as const
export type HelpZone = (typeof HELP_ZONES)[number]

/**
 * Ajuda por zona, com herança:
 *  - a dica PADRÃO do campo fica na chave base (`<id>`) e vale para todas as zonas onde ele aparece;
 *  - a zona pode ter texto PRÓPRIO: chave `<zona>-<id>` com `label.help_custom = true`.
 * O app publicado lê a chave da zona (ou a base, se ela não existir), então a dica padrão também é copiada
 * para as chaves de zona que existem e não são personalizadas.
 */
const zoneKey = (zone: HelpZone, id: string) => `${zone}-${id}`
const isCustom = (entry: any) => entry?.label?.help_custom === true

/** Dica padrão do campo (a que vale onde a zona não tem texto próprio) */
export function getFieldHelp(fieldsMetadata: Record<string, any> | undefined, fieldId: string): unknown {
  const meta = fieldsMetadata || {}
  if (meta[fieldId]?.label?.help !== undefined) return meta[fieldId].label.help
  // dado antigo: só as chaves de zona têm texto
  for (const zone of HELP_ZONES) {
    const e = meta[zoneKey(zone, fieldId)]
    if (!isCustom(e) && e?.label?.help !== undefined) return e.label.help
  }
  return undefined
}

/** Dica que vale na zona e se o texto é próprio dela */
export function getZoneHelp(fieldsMetadata: Record<string, any> | undefined, fieldId: string, zone: HelpZone): { help: unknown; custom: boolean } {
  const entry = (fieldsMetadata || {})[zoneKey(zone, fieldId)]
  if (isCustom(entry)) return { help: entry.label.help, custom: true }
  return { help: getFieldHelp(fieldsMetadata, fieldId), custom: false }
}

function withLabelHelp(entry: any, help: HelpText | undefined, custom: boolean): any {
  const base = entry || { label: {}, component: { type: 'text' } }
  const label = { ...(base.label || {}) }
  if (help === undefined) delete label.help
  else label.help = help
  if (custom) label.help_custom = true
  else delete label.help_custom
  return { ...base, label }
}

const hasAnyText = (help: HelpText) => Object.values(help || {}).some(v => typeof v === 'string' && v.length > 0)

/**
 * Grava a dica PADRÃO do campo: chave base e todas as chaves de zona que existem e não têm texto próprio.
 * Dica vazia remove só o `help`. Não altera o original.
 */
export function setFieldHelp(fieldsMetadata: Record<string, any> | undefined, fieldId: string, help: HelpText): Record<string, any> {
  const next: Record<string, any> = { ...(fieldsMetadata || {}) }
  const value = hasAnyText(help) ? help : undefined
  next[fieldId] = withLabelHelp(next[fieldId], value, false)
  for (const zone of HELP_ZONES) {
    const key = zoneKey(zone, fieldId)
    if (next[key] !== undefined && !isCustom(next[key])) next[key] = withLabelHelp(next[key], value, false)
  }
  return next
}

/** Texto PRÓPRIO da zona (cria a chave da zona a partir da base, se ainda não existir) */
export function setZoneHelp(fieldsMetadata: Record<string, any> | undefined, fieldId: string, zone: HelpZone, help: HelpText): Record<string, any> {
  const next: Record<string, any> = { ...(fieldsMetadata || {}) }
  const key = zoneKey(zone, fieldId)
  const seed = next[key] || next[fieldId]
  next[key] = withLabelHelp(seed ? { ...seed, label: { ...(seed.label || {}) } } : undefined, help, true)
  return next
}

/** A zona volta a herdar a dica padrão */
export function clearZoneHelp(fieldsMetadata: Record<string, any> | undefined, fieldId: string, zone: HelpZone): Record<string, any> {
  const next: Record<string, any> = { ...(fieldsMetadata || {}) }
  const key = zoneKey(zone, fieldId)
  if (next[key] === undefined) return next
  const inherited = next[fieldId]?.label?.help
  next[key] = withLabelHelp(next[key], inherited, false)
  return next
}

export interface HelpCenterEntry {
  id: string
  slug: string
  name: string
  screen: string
  fields: { id: string; label: string; text: string }[]
}

/**
 * Central de Ajuda: junta a ajuda de todas as telas do projeto no idioma pedido.
 * `views` são as linhas de `ui_views` (com `model.fields` para o nome do campo quando o Studio não definiu um rótulo).
 * Telas sem nenhuma ajuda ficam de fora; campos saem na ordem do formulário.
 */
export function collectHelpCenter(views: any[], language: string | undefined): HelpCenterEntry[] {
  const out: HelpCenterEntry[] = []
  for (const v of views || []) {
    const lc = v?.layout_config || {}
    const meta: Record<string, any> = lc.fields_metadata || {}
    const modelFields: any[] = v?.model?.fields || []
    const ids: string[] = (lc.form_fields || []).map((f: any) => (typeof f === 'string' ? f : f?.id)).filter(Boolean)
    const fields = ids.flatMap(id => {
      const text = resolveHelp(getZoneHelp(meta, id, 'form').help, language)
      if (!text) return []
      const label = meta[`form-${id}`]?.label?.text || meta[id]?.label?.text
        || modelFields.find(f => f.id === id)?.display_name || modelFields.find(f => f.id === id)?.db_column_name || id
      return [{ id, label, text }]
    })
    const screen = resolveHelp(lc.screen_help, language)
    if (!screen && fields.length === 0) continue
    out.push({ id: v.id, slug: v.slug, name: v.name || v.slug, screen, fields })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

/** Filtra a Central pela busca (nome da tela, campo ou texto da ajuda), sem diferenciar maiúsculas e acentos */
export function searchHelpCenter(entries: HelpCenterEntry[], query: string): HelpCenterEntry[] {
  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const q = norm(query.trim())
  if (!q) return entries
  const out: HelpCenterEntry[] = []
  for (const e of entries) {
    if (norm(e.name).includes(q) || norm(e.screen).includes(q)) { out.push(e); continue }
    const fields = e.fields.filter(f => norm(f.label).includes(q) || norm(f.text).includes(q))
    if (fields.length) out.push({ ...e, fields })
  }
  return out
}

/** Zonas (filtro, grid, formulário) em que o campo está colocado no `layout_config` */
export function zonesOfField(layoutConfig: any, fieldId: string): HelpZone[] {
  const ids = (list: any): string[] => (Array.isArray(list) ? list : []).map((f: any) => (typeof f === 'string' ? f : f?.id)).filter(Boolean)
  return HELP_ZONES.filter(z => ids(layoutConfig?.[`${z}_fields`]).includes(fieldId))
}
