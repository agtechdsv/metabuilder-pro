/**
 * Gravar só a ajuda de um caso de uso, sem publicar o resto.
 *
 * A aba "Central de Ajuda" do Studio edita a ajuda de um caso de uso já publicado. Para isso a alteração precisa chegar a três lugares,
 * e só nas propriedades de ajuda (o que mais estiver em rascunho não é publicado por tabela):
 *   1. `layout_config` publicado  → Central de Ajuda do app e novas ejeções;
 *   2. `layout_config` do rascunho → publicar depois não desfaz a edição;
 *   3. `ui_components.config`      → é o que o app em execução lê nos campos (`<zona>_config.label.help`).
 */

const FIELD_HELP_PROPS = ['help', 'help_custom', 'help_hidden'] as const
const ZONES = ['filter', 'grid', 'form'] as const

function copyLabelHelp(from: any, into: any): any {
  const label = { ...(into?.label || {}) }
  for (const p of FIELD_HELP_PROPS) {
    if (from?.label?.[p] === undefined) delete label[p]
    else label[p] = from.label[p]
  }
  return { ...(into || {}), label }
}

/** Copia a ajuda de `edited` para `target` (tela e campos), sem tocar em nenhuma outra configuração. Não altera os originais. */
export function mergeHelpIntoLayout(target: any, edited: any): any {
  const out: any = { ...(target || {}) }
  for (const key of ['screen_help', 'screen_help_hidden', 'interactive_help']) {
    if (edited?.[key] === undefined) delete out[key]
    else out[key] = edited[key]
  }
  const editedMeta: Record<string, any> = edited?.fields_metadata || {}
  const meta: Record<string, any> = { ...(out.fields_metadata || {}) }
  for (const [key, entry] of Object.entries(editedMeta)) {
    meta[key] = meta[key] ? copyLabelHelp(entry, meta[key]) : entry
  }
  // chaves que só o destino tem (ex.: campo novo só no rascunho) ficam como estão; apagar um texto na edição mantém a chave, sem o `help`
  out.fields_metadata = meta
  return out
}

/** Camada de layout de um rascunho (o do Studio guarda em `layout_config`; o gerado por IA é o próprio rascunho) */
export function draftLayoutOf(draft: any): any {
  if (!draft) return null
  return draft.layout_config ?? (draft.generated_by_ai === true ? draft : null)
}

/**
 * Atualiza a ajuda de uma linha de `ui_components` a partir do `fields_metadata` já mesclado:
 * cada zona do campo lê a chave `<zona>-<id>` (ou a base). Devolve o mesmo objeto se nada mudou.
 */
export function patchComponentHelp(config: any, fieldsMetadata: Record<string, any> | undefined, fieldId: string): any {
  if (!config || typeof config !== 'object') return config
  const meta = fieldsMetadata || {}
  const zones: string[] = Array.isArray(config.zones) ? config.zones : ZONES.filter(z => config[`${z}_config`])
  let next = config
  let first = true
  for (const zone of zones) {
    const source = meta[`${zone}-${fieldId}`] ?? meta[fieldId]
    if (!source) continue
    const key = `${zone}_config`
    next = { ...next, [key]: copyLabelHelp(source, next[key]) }
    // o nível de cima do componente espelha a primeira zona
    if (first) { next = { ...next, ...copyLabelHelp(source, next) }; first = false }
  }
  return JSON.stringify(next) === JSON.stringify(config) ? config : next
}
