// ─── Use Case Code Parser ────────────────────────────────────────────────────
// Parser reverso: converte o código TypeScript editado pelo dev de volta
// para um WizardConfig estruturado. Não usa eval() — é seguro.

import type { WizardConfig } from './types'

export type ParseResult =
  | { success: true; config: WizardConfig }
  | { success: false; error: string; line?: number }

/**
 * Remove comentários de linha única (// ...) de uma string de código,
 * preservando as quebras de linha para manter a contagem de linhas correta.
 */
function stripLineComments(code: string): string {
  return code.replace(/\/\/[^\n]*/g, '')
}

/**
 * Remove comentários de bloco (/* ... *\/) de uma string de código.
 */
function stripBlockComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '')
}

/**
 * Remove trailing commas antes de } ou ] — JSON.parse não aceita.
 * Ex: { a: 1, } → { a: 1 }
 */
function removeTrailingCommas(code: string): string {
  return code.replace(/,(\s*[}\]])/g, '$1')
}

/**
 * Extrai o conteúdo do objeto `config = { ... }` do código TypeScript.
 * Busca pela primeira atribuição `= {` após "config" e encontra o
 * fechamento balanceado.
 */
function extractConfigObject(code: string): string | null {
  // Procura por "const config" ou "let config" ou "var config" ou apenas "config"
  const assignIdx = code.search(/\bconfig\s*[:=]\s*\{/)
  if (assignIdx === -1) return null

  // Avança até o primeiro '{'
  const braceStart = code.indexOf('{', assignIdx)
  if (braceStart === -1) return null

  let depth = 0
  let i = braceStart
  while (i < code.length) {
    if (code[i] === '{') depth++
    else if (code[i] === '}') {
      depth--
      if (depth === 0) {
        return code.slice(braceStart, i + 1)
      }
    }
    i++
  }

  return null // não encontrou fechamento balanceado
}

/**
 * Converte um objeto literal TypeScript em JSON válido.
 * Handles: chaves sem aspas, aspas simples, trailing commas, comentários.
 */
function tsObjectToJson(tsObj: string): string {
  let json = tsObj

  // 1. Remove comentários
  json = stripBlockComments(json)
  json = stripLineComments(json)

  // 2. Remove trailing commas
  json = removeTrailingCommas(json)

  // 3. Converte chaves sem aspas → com aspas
  // Matches: palavra seguida de ":" que não esteja já entre aspas
  json = json.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*:)/g, '$1"$2"$3')

  // 4. Converte aspas simples → duplas (cuidado com escapamentos)
  json = json.replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, '"$1"')

  // 5. Remove vírgulas órfãs que possam ter sobrado
  json = removeTrailingCommas(json)

  return json
}

/**
 * Valida que o objeto parseado tem os campos mínimos obrigatórios.
 */
function validateConfig(obj: any): string | null {
  if (!obj || typeof obj !== 'object') return 'O objeto config não foi encontrado ou é inválido.'
  if (!obj.name || typeof obj.name !== 'string') return 'O campo "name" é obrigatório e deve ser uma string.'
  if (!obj.slug || typeof obj.slug !== 'string') return 'O campo "slug" é obrigatório e deve ser uma string.'
  if (!obj.logic_type || typeof obj.logic_type !== 'string') return 'O campo "logic_type" é obrigatório e deve ser uma string.'

  const validLogicTypes = [
    'pesquisa', 'cadastro', 'pesquisa_cadastro', 'kanban', 'analytics',
    'timeline', 'map', 'gantt', 'blueprint', 'scheduler', 'master_detail', 'personalizado'
  ]
  if (!validLogicTypes.includes(obj.logic_type)) {
    return `O "logic_type" "${obj.logic_type}" não é válido. Valores aceitos: ${validLogicTypes.join(', ')}.`
  }

  return null
}

/**
 * Garante que o objeto parseado tem a estrutura esperada pelo WizardConfig,
 * preenchendo campos ausentes com defaults seguros.
 */
function normalizeConfig(obj: any): WizardConfig {
  const lc = obj.layout_config || {}

  return {
    name: obj.name || '',
    slug: obj.slug || '',
    logic_type: obj.logic_type || 'pesquisa_cadastro',
    has_arguments: !!obj.has_arguments,
    selected_models: Array.isArray(obj.selected_models) ? obj.selected_models : (Array.isArray(obj.tables_config) ? obj.tables_config : []),
    tables_config: Array.isArray(obj.tables_config) ? obj.tables_config : (Array.isArray(obj.selected_models) ? obj.selected_models : []),
    query_type: obj.query_type || 'auto',
    custom_query: obj.custom_query || '',
    layout_config: {
      grid_fields:   Array.isArray(lc.grid_fields)   ? lc.grid_fields   : [],
      form_fields:   Array.isArray(lc.form_fields)   ? lc.form_fields   : [],
      filter_fields: Array.isArray(lc.filter_fields) ? lc.filter_fields : [],
      display_type:  lc.display_type  || 'list',
      default_view:  lc.default_view  || 'list',
      grouping_type: lc.grouping_type || 'none',
      action_interface_type: lc.action_interface_type || 'modal',
      joins:         Array.isArray(lc.joins)          ? lc.joins          : [],
      custom_actions: Array.isArray(lc.custom_actions) ? lc.custom_actions : [],
      custom_slots:  Array.isArray(lc.custom_slots)   ? lc.custom_slots   : [],
      fields_metadata: lc.fields_metadata && typeof lc.fields_metadata === 'object' ? lc.fields_metadata : {},
      analytics_config: lc.analytics_config || { widgets: [], allow_runtime_edit: false },
      details_display_mode:   lc.details_display_mode   || {},
      details_interface_types: lc.details_interface_types || {},
      details_inline_types:   lc.details_inline_types   || {},
      details_modal_sizes:    lc.details_modal_sizes    || {},
      details_modal_widths:   lc.details_modal_widths   || {},
      details_modal_heights:  lc.details_modal_heights  || {},
      details_tab_titles:     lc.details_tab_titles     || {},
      details_item_titles:    lc.details_item_titles    || {},
      master_tab_title:       lc.master_tab_title       || '',
      export_formats:         Array.isArray(lc.export_formats) ? lc.export_formats : [],
      gallery_config:         lc.gallery_config || {},
      gallery_click_behavior: lc.gallery_click_behavior || '',
      items_per_page:         lc.items_per_page,
      form_header_title:      lc.form_header_title || '',
      form_header_subtitle_field: lc.form_header_subtitle_field || '',
      kanban_group_field:     lc.kanban_group_field || '',
      master_model_id:        lc.master_model_id   || '',
      detail_display_mode:    lc.detail_display_mode || '',
      mindmap_central_field:  lc.mindmap_central_field || '',
      mindmap_levels:         Array.isArray(lc.mindmap_levels) ? lc.mindmap_levels : [],
      max_relation_depth:     lc.max_relation_depth || 2,
      scheduler_config:       lc.scheduler_config || { title_field: '', start_date_field: '', end_date_field: '', color_field: '' },
      timeline_config:        lc.timeline_config  || { date_field: '', title_field: '', desc_field: '', icon_field: '' },
      map_config:             lc.map_config        || { lat_field: '', lng_field: '', title_field: '', desc_field: '' },
      gantt_config:           lc.gantt_config      || { title_field: '', start_date_field: '', end_date_field: '', progress_field: '', predecessor_field: '' },
      blueprint_config:       lc.blueprint_config  || { title_field: '', desc_field: '', status_field: '', predecessor_field: '' },
      master_use_case_slug:   lc.master_use_case_slug || undefined,
    },
    buttons_config: Array.isArray(obj.buttons_config) ? obj.buttons_config : [],
  }
}

/**
 * Parseia o código TypeScript editado pelo dev e retorna um WizardConfig.
 * 
 * Estratégia segura (sem eval):
 * 1. Extrai o objeto literal `config = { ... }`
 * 2. Converte de TS object literal para JSON válido (strip comments, fix keys)
 * 3. JSON.parse
 * 4. Valida campos obrigatórios
 * 5. Normaliza e retorna WizardConfig completo
 * 
 * @param code - String de código TypeScript do editor
 * @returns ParseResult com sucesso ou erro descritivo
 */
export function parseUseCaseCode(code: string): ParseResult {
  try {
    // Passo 1: Extrair o objeto config
    const rawObject = extractConfigObject(code)
    if (!rawObject) {
      return {
        success: false,
        error: 'Não foi possível encontrar a declaração "const config = { ... }" no código. Verifique se a estrutura está correta.'
      }
    }

    // Passo 2: Converter para JSON válido
    const jsonStr = tsObjectToJson(rawObject)

    // Passo 3: Parse JSON
    let parsed: any
    try {
      parsed = JSON.parse(jsonStr)
    } catch (jsonErr: any) {
      // Tenta dar uma mensagem de erro mais útil
      const match = jsonErr.message.match(/position (\d+)/)
      if (match) {
        const pos = parseInt(match[1])
        const snippet = jsonStr.slice(Math.max(0, pos - 30), pos + 30)
        return {
          success: false,
          error: `Erro de sintaxe no JSON gerado. Verifique a sintaxe próximo de: "...${snippet}..."\n\nDetalhe: ${jsonErr.message}`
        }
      }
      return {
        success: false,
        error: `Erro de sintaxe: ${jsonErr.message}. Verifique se há vírgulas ou aspas incorretas.`
      }
    }

    // Passo 4: Validar campos obrigatórios
    const validationError = validateConfig(parsed)
    if (validationError) {
      return { success: false, error: validationError }
    }

    // Passo 5: Normalizar e retornar
    const normalized = normalizeConfig(parsed)
    return { success: true, config: normalized }

  } catch (err: any) {
    return {
      success: false,
      error: `Erro inesperado ao processar o código: ${err.message}`
    }
  }
}
