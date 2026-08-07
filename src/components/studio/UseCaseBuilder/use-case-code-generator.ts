// ─── Use Case Code Generator ─────────────────────────────────────────────────
// Converte um WizardConfig em código TypeScript legível e comentado para
// exibição no Code Mode do MetaBuilder.

import type { WizardConfig, Model } from './types'

/**
 * Retorna o display_name ou db_column_name de um field dado seu ID.
 */
function getFieldLabel(fieldId: string, models: Model[]): string {
  for (const model of models) {
    const field = model.fields?.find(f => f.id === fieldId)
    if (field) return field.display_name || field.db_column_name || fieldId
  }
  return fieldId
}

/**
 * Serializa um array de field IDs em linhas formatadas com comentários inline
 * mostrando o nome legível do campo.
 */
function serializeFieldArray(
  fieldIds: string[],
  models: Model[],
  indent: string
): string {
  if (!fieldIds || fieldIds.length === 0) return '[]'

  const lines = fieldIds.map(id => {
    const label = getFieldLabel(id, models)
    const comment = label !== id ? ` // ${label}` : ''
    return `${indent}  ${JSON.stringify(id)},${comment}`
  })

  return `[\n${lines.join('\n')}\n${indent}]`
}

/**
 * Serializa fields_metadata de forma compacta — apenas os campos com dados
 * relevantes (label personalizado ou configurações não-padrão).
 */
function serializeFieldsMeta(
  meta: Record<string, any>,
  indent: string
): string {
  if (!meta || Object.keys(meta).length === 0) return '{}'

  const entries = Object.entries(meta)
    .filter(([, v]) => v && typeof v === 'object')
    .map(([key, val]) => {
      return `${indent}  ${JSON.stringify(key)}: ${JSON.stringify(val, null, 2).replace(/\n/g, `\n${indent}  `)},`
    })

  if (entries.length === 0) return '{}'
  return `{\n${entries.join('\n')}\n${indent}}`
}

/**
 * Serializa custom_actions de forma legível.
 */
function serializeCustomActions(actions: any[], indent: string): string {
  if (!actions || actions.length === 0) return '[]'

  const items = actions.map(action => {
    return `${indent}  ${JSON.stringify(action, null, 2).replace(/\n/g, `\n${indent}  `)},`
  })
  return `[\n${items.join('\n')}\n${indent}]`
}

/**
 * Gera o código TypeScript legível de um WizardConfig.
 * 
 * @param config - O WizardConfig atual do wizard
 * @param models - Lista de models do projeto (para comentar field IDs com nomes)
 * @returns String de código TypeScript formatada e comentada
 */
export function generateUseCaseCode(config: WizardConfig, models: Model[]): string {
  const now = new Date()
  const dateStr = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  const lc = config.layout_config || {}

  const gridFields   = serializeFieldArray(lc.grid_fields   || [], models, '    ')
  const formFields   = serializeFieldArray(lc.form_fields   || [], models, '    ')
  const filterFields = serializeFieldArray(lc.filter_fields || [], models, '    ')
  const fieldsMeta   = serializeFieldsMeta(lc.fields_metadata || {}, '    ')
  const customActions = serializeCustomActions(lc.custom_actions || [], '    ')

  // Outros campos opcionais do layout_config
  const optionalLayoutFields: string[] = []

  if (lc.display_type && lc.display_type !== 'list') {
    optionalLayoutFields.push(`    display_type: ${JSON.stringify(lc.display_type)},`)
  }
  if (lc.default_view && lc.default_view !== 'list') {
    optionalLayoutFields.push(`    default_view: ${JSON.stringify(lc.default_view)},`)
  }
  if (lc.kanban_group_field) {
    optionalLayoutFields.push(`    kanban_group_field: ${JSON.stringify(lc.kanban_group_field)},`)
  }
  if (lc.action_interface_type && lc.action_interface_type !== 'modal') {
    optionalLayoutFields.push(`    action_interface_type: ${JSON.stringify(lc.action_interface_type)},`)
  }
  if (lc.items_per_page !== undefined) {
    optionalLayoutFields.push(`    items_per_page: ${lc.items_per_page},`)
  }
  if (lc.export_formats && lc.export_formats.length > 0) {
    optionalLayoutFields.push(`    export_formats: ${JSON.stringify(lc.export_formats)},`)
  }
  if (lc.scheduler_config?.title_field) {
    optionalLayoutFields.push(`    scheduler_config: ${JSON.stringify(lc.scheduler_config, null, 2).replace(/\n/g, '\n    ')},`)
  }
  if (lc.timeline_config?.date_field) {
    optionalLayoutFields.push(`    timeline_config: ${JSON.stringify(lc.timeline_config, null, 2).replace(/\n/g, '\n    ')},`)
  }
  if (lc.map_config?.lat_field) {
    optionalLayoutFields.push(`    map_config: ${JSON.stringify(lc.map_config, null, 2).replace(/\n/g, '\n    ')},`)
  }
  if (lc.gantt_config?.title_field) {
    optionalLayoutFields.push(`    gantt_config: ${JSON.stringify(lc.gantt_config, null, 2).replace(/\n/g, '\n    ')},`)
  }
  if (lc.blueprint_config?.title_field) {
    optionalLayoutFields.push(`    blueprint_config: ${JSON.stringify(lc.blueprint_config, null, 2).replace(/\n/g, '\n    ')},`)
  }
  if (lc.gallery_config?.image_field) {
    optionalLayoutFields.push(`    gallery_config: ${JSON.stringify(lc.gallery_config, null, 2).replace(/\n/g, '\n    ')},`)
  }
  if (lc.joins && lc.joins.length > 0) {
    optionalLayoutFields.push(`    joins: ${JSON.stringify(lc.joins, null, 2).replace(/\n/g, '\n    ')},`)
  }
  if (lc.custom_slots && lc.custom_slots.length > 0) {
    optionalLayoutFields.push(`    custom_slots: ${JSON.stringify(lc.custom_slots, null, 2).replace(/\n/g, '\n    ')},`)
  }
  if (lc.master_use_case_slug) {
    optionalLayoutFields.push(`    master_use_case_slug: ${JSON.stringify(lc.master_use_case_slug)},`)
  }
  if (lc.master_model_id) {
    optionalLayoutFields.push(`    master_model_id: ${JSON.stringify(lc.master_model_id)},`)
  }
  if (lc.mindmap_levels && lc.mindmap_levels.length > 0) {
    optionalLayoutFields.push(`    mindmap_central_field: ${JSON.stringify(lc.mindmap_central_field)},`)
    optionalLayoutFields.push(`    mindmap_levels: ${JSON.stringify(lc.mindmap_levels, null, 2).replace(/\n/g, '\n    ')},`)
  }

  const optionalLayoutSection = optionalLayoutFields.length > 0
    ? `\n${optionalLayoutFields.join('\n')}`
    : ''

  const buttonsConfig = config.buttons_config && config.buttons_config.length > 0
    ? JSON.stringify(config.buttons_config, null, 2).replace(/\n/g, '\n  ')
    : '[]'

  return `/**
 * MetaBuilder Pro — Code Mode
 * ────────────────────────────────────────────────
 * Caso de Uso : ${config.name || '(sem nome)'}
 * Slug        : ${config.slug || '(sem slug)'}
 * Gerado em   : ${dateStr}
 * ────────────────────────────────────────────────
 *
 * Edite livremente e clique em "Salvar" para aplicar.
 * IntelliSense disponível: hover sobre os campos para ver os tipos.
 *
 * ⚠️  Atenção:
 *   - Os IDs de campos (grid_fields, form_fields, etc.) devem corresponder
 *     aos IDs reais da sua model. Consulte o painel "Campos" à direita.
 *   - Não altere "slug" se o caso de uso já está publicado no menu,
 *     pois isso quebrará os links de navegação.
 */

const config: WizardConfig = {
  // ── Identificação ─────────────────────────────────────────────────────────
  name: ${JSON.stringify(config.name || '')},
  slug: ${JSON.stringify(config.slug || '')},

  // ── Tipo de Lógica ────────────────────────────────────────────────────────
  // "pesquisa" | "cadastro" | "pesquisa_cadastro" | "kanban" | "analytics"
  // "timeline" | "map" | "gantt" | "blueprint" | "scheduler"
  // "master_detail" | "personalizado"
  logic_type: ${JSON.stringify(config.logic_type || 'pesquisa_cadastro')},

  // ── Configuração geral ────────────────────────────────────────────────────
  has_arguments: ${!!config.has_arguments},
  query_type: ${JSON.stringify(config.query_type || 'auto')},
  ${config.custom_query ? `custom_query: ${JSON.stringify(config.custom_query)},` : `// custom_query: "SELECT * FROM minha_tabela WHERE ...",`}

  // IDs das models selecionadas (primeira é a model principal)
  selected_models: ${JSON.stringify(config.selected_models || [])},
  tables_config: ${JSON.stringify(config.tables_config || [])},

  // ── Layout & Campos ───────────────────────────────────────────────────────
  layout_config: {
    // Campos exibidos na grade/lista
    grid_fields: ${gridFields},

    // Campos do formulário de cadastro/edição
    form_fields: ${formFields},

    // Campos usados como filtro/pesquisa
    filter_fields: ${filterFields},

    display_type: ${JSON.stringify(lc.display_type || 'list')},
    default_view: ${JSON.stringify(lc.default_view || 'list')},
    grouping_type: ${JSON.stringify(lc.grouping_type || 'none')},
    action_interface_type: ${JSON.stringify(lc.action_interface_type || 'modal')},
${optionalLayoutSection}
    // Ações customizadas (botões adicionais por linha/formulário)
    custom_actions: ${customActions},

    // Metadados de campos (labels, estilos, componentes de formulário)
    fields_metadata: ${fieldsMeta},
  },

  // ── Configuração de Botões da Toolbar ─────────────────────────────────────
  buttons_config: ${buttonsConfig},
}
`
}
