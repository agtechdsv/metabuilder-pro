import {
  AppAST,
  DbType,
  WorkspaceAST,
  WorkspaceProjectNode,
  ModelNode,
  RouteNode,
  ActionNode,
  FieldNode,
  ResolvedField,
  ResolvedFieldConfig,
  ViewButton,
  RelationTab,
  SubRelationDetail,
  NavigationItem,
  AuthConfig,
  ButtonStyle,
  ButtonActionType,
} from './ast'
import { getActionContexts } from '@/lib/customActionsHelper'

/**
 * parser.ts
 *
 * Converte o JSON exportado do MetaBuilder para a AST do CleanCodeGenerator.
 *
 * Replica FIELMENTE as 5 etapas que o Runtime Web executa em [view_slug]/page.tsx:
 *   Etapa 1 — Leitura completa de ui_views + ui_components + fields
 *   Etapa 2 — Resolução do logic_type 'personalizado' (herança do UC mestre)
 *   Etapa 3 — Separação e ordenação de campos por zona (grid / form / filter)
 *   Etapa 4 — Aplicação de fields_metadata (labels, cores, formatos por zona)
 *   Etapa 5 — Resolução de campos de JOIN entre tabelas (tabela.coluna)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function toPascalCase(str: string): string {
  return (str || '')
    .replace(/[^a-zA-Z0-9]+(.)/g, (_m, chr) => chr.toUpperCase())
    .replace(/^[a-z]/, (m) => m.toUpperCase())
}

function mapFieldType(dbType: string): FieldNode['type'] {
  const t = (dbType || '').toLowerCase()
  if (t.includes('int') || t.includes('numeric') || t.includes('float') || t.includes('double') || t.includes('decimal')) return 'number'
  if (t.includes('bool')) return 'boolean'
  if (t.includes('date') || t.includes('time')) return 'date'
  if (t.includes('uuid')) return 'uuid'
  if (t.includes('json')) return 'json'
  return 'string'
}

/**
 * Resolve se um campo pertence a uma tabela de JOIN (model_id diferente da view).
 * Retorna { dbColumn, sqlExpression } no mesmo formato que o Runtime usa.
 */
function resolveFieldJoin(
  field: any,
  viewModelId: string,
  allModels: any[]
): { dbColumn: string; sqlExpression: string } {
  const colName = field.db_column_name
  if (field.model_id && field.model_id !== viewModelId) {
    const joinedTable = allModels.find((m: any) => m.id === field.model_id)?.db_table_name
    if (joinedTable) {
      return {
        dbColumn: `${joinedTable}.${colName}`,
        sqlExpression: `${joinedTable}.${colName} AS "${joinedTable}.${colName}"`,
      }
    }
  }
  return { dbColumn: colName, sqlExpression: colName }
}

/**
 * Aplica fields_metadata de uma view sobre uma lista de campos de uma zona.
 * Mesma lógica do Runtime: meta por zona sobrepõe meta global.
 */
function applyFieldsMeta(
  fieldId: string,
  zone: 'grid' | 'form' | 'filter',
  fieldsMetadata: Record<string, any>,
  baseFieldConfig: any,
  rawField?: any,
  modelName?: string
): ResolvedFieldConfig {
  const colName = (rawField?.db_column_name || '').toLowerCase()
  const tblName = (modelName || '').toLowerCase()
  const fullColName = tblName && colName ? `${tblName}.${colName}` : ''

  // Busca chaves candidatas no fieldsMetadata do Studio:
  // ex: form-d6cd21d2-..., clientes.nome_empresa, form-clientes.nome_empresa, nome_empresa
  const candidateKeys = [
    `${zone}-${fieldId}`,
    fieldId,
    fullColName ? `${zone}-${fullColName}` : null,
    fullColName || null,
    colName ? `${zone}-${colName}` : null,
    colName || null,
  ].filter(Boolean) as string[]

  let mergedMeta: Record<string, any> = {}
  for (const k of candidateKeys) {
    if (fieldsMetadata[k]) {
      mergedMeta = { ...mergedMeta, ...fieldsMetadata[k] }
    }
  }

  // Busca também por chaves case-insensitive no fieldsMetadata
  for (const [mk, mv] of Object.entries(fieldsMetadata)) {
    const mkLower = mk.toLowerCase()
    if (
      (colName && (mkLower === colName || mkLower === `${zone}-${colName}`)) ||
      (fullColName && (mkLower === fullColName || mkLower === `${zone}-${fullColName}`))
    ) {
      mergedMeta = { ...mergedMeta, ...mv }
    }
  }

  const merged = { ...baseFieldConfig, ...mergedMeta }

  let options =
    merged.options ||
    merged.component?.options ||
    merged.component?.fixed_options ||
    merged.fixed_options ||
    rawField?.options ||
    rawField?.enum_values ||
    rawField?.fixed_options ||
    baseFieldConfig?.options ||
    baseFieldConfig?.enum_values ||
    baseFieldConfig?.fixed_options

  if (typeof options === 'string') {
    try {
      const parsed = JSON.parse(options)
      if (Array.isArray(parsed)) options = parsed
    } catch (_) {}
    if (typeof options === 'string') {
      options = options.split(/[\n,]+/).map(s => s.trim()).filter(Boolean).map(s => ({ label: s, value: s }))
    }
  }

  if (Array.isArray(options)) {
    options = options.map((opt: any) => typeof opt === 'string' ? { label: opt, value: opt } : opt)
  }

  const dispName = (rawField?.display_name || '').toLowerCase()
  if ((colName === 'status' || dispName === 'status' || colName.endsWith('_status')) && (!options || options.length === 0)) {
    options = [
      { label: 'Novo', value: 'Novo' },
      { label: 'Contactado', value: 'Contactado' },
      { label: 'Em Negociação', value: 'Em Negociação' },
      { label: 'Fechado Ganho', value: 'Fechado Ganho' },
      { label: 'Perdido', value: 'Perdido' }
    ]
  }

  const relation = merged.relation || rawField?.relation || baseFieldConfig?.relation

  // Extrai colunas de 1 a 12 de todas as possíveis propriedades do Studio
  const rawCols =
    merged.component?.gridSpan ??
    merged.component?.modalGridSpan ??
    merged.gridSpan ??
    merged.modalGridSpan ??
    merged.component?.columns ??
    merged.component?.col_span ??
    merged.component?.colspan ??
    merged.component?.layout_padrao?.colunas ??
    merged.component?.layout_padrao?.ocupar_colunas ??
    merged.layout_padrao?.colunas ??
    merged.layout_padrao?.ocupar_colunas ??
    merged.layout?.columns ??
    merged.layout?.col_span ??
    merged.columns ??
    merged.col_span ??
    merged.colSpan ??
    merged.ocupar_colunas

  let columns: number | undefined
  if (rawCols !== undefined && rawCols !== null && rawCols !== '') {
    if (typeof rawCols === 'number') {
      columns = rawCols
    } else if (typeof rawCols === 'string') {
      const m = rawCols.match(/\d+/)
      if (m) columns = parseInt(m[0], 10)
    }
  }

  return {
    label: merged.label,
    width: merged.width,
    gridSpan: columns || merged.gridSpan || merged.component?.gridSpan,
    modalGridSpan: merged.component?.modalGridSpan || merged.modalGridSpan,
    columns: columns || merged.columns || merged.col_span,
    format: merged.format,
    options,
    relation,
    readOnly: merged.readOnly || merged.read_only || merged.content?.readonly,
    required: merged.required || merged.is_required || merged.content?.required,
    placeholder: merged.placeholder || merged.content?.placeholder,
    multiline: merged.multiline || merged.is_multiline,
    rows: merged.rows || merged.component?.rows,
    ...merged,
    ...(columns ? { columns, gridSpan: columns } : {}),
    ...(options ? { options } : {}),
  }
}

/**
 * Converte um componente de ui + field + metadata em um ResolvedField.
 * Replica o .map() que o Runtime usa para montar displayFields e formFields.
 */
function buildResolvedField(
  component: any,
  field: any,
  zone: 'grid' | 'form' | 'filter',
  viewModelId: string,
  allModels: any[],
  fieldsMetadata: Record<string, any>
): ResolvedField {
  const model = allModels.find(m => m.id === field.model_id || m.id === viewModelId)
  const modelTableName = model?.db_table_name || ''
  const { dbColumn, sqlExpression } = resolveFieldJoin(field, viewModelId, allModels)
  const zoneConfig =
    zone === 'filter'
      ? { ...(field.config?.filter_config || {}), ...(component.config?.filter_config || {}) }
      : zone === 'grid'
      ? { ...(field.config?.grid_config || {}), ...(component.config?.grid_config || {}) }
      : { ...(field.config?.form_config || {}), ...(component.config?.form_config || {}) }
  const baseConfig = { ...(field.config || {}), ...(component.config || {}), ...zoneConfig }
  const config = applyFieldsMeta(field.id, zone, fieldsMetadata, baseConfig, field, modelTableName)
  const labelFromMeta =
    config.label?.text ||
    (typeof config.label === 'string' ? config.label : null) ||
    config.texto_exibicao ||
    config.display_text
  const label =
    typeof labelFromMeta === 'string' && labelFromMeta.trim()
      ? labelFromMeta
      : component.label || field.display_name || field.db_column_name

  return {
    id: field.id,
    dbColumn,
    sqlExpression,
    label,
    dataType: field.data_type || 'varchar',
    isPrimaryKey: field.is_primary_key || false,
    isSortable: field.is_sortable || false,
    isVirtual: false,
    isByoc: false,
    config,
  }
}

/**
 * Constrói um ResolvedField para campos virtuais (virt_*) ou BYOC (byoc_*).
 * Replica o inject de campos virtuais que o Runtime faz após o sort.
 */
function buildVirtualField(
  id: string,
  zone: 'grid' | 'form',
  fieldsMetadata: Record<string, any>,
  byocMap: Record<string, string>
): ResolvedField {
  const zoneMeta = fieldsMetadata[`${zone}-${id}`] || {}
  const globalMeta = fieldsMetadata[id] || {}
  const meta = { ...globalMeta, ...zoneMeta }

  const isByoc = id.startsWith('byoc_')
  const byocName = isByoc ? id.split('_').slice(2).join('_') : ''
  const labelText = meta.label?.text || (isByoc ? `[BYOC] ${byocName}` : 'Campo Calculado')

  const config: ResolvedFieldConfig = {
    ...meta,
    ...(isByoc ? { compiledCode: byocMap[byocName] } : {}),
  }

  return {
    id,
    dbColumn: id,
    sqlExpression: `NULL AS "${id}"`,
    label: labelText,
    dataType: isByoc ? 'byoc' : 'virtual',
    isPrimaryKey: false,
    isSortable: false,
    isVirtual: !isByoc,
    isByoc,
    config,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Etapa 3 + 4 + 5 — Resolve campos de uma view para as 3 zonas
// ─────────────────────────────────────────────────────────────────────────────

interface ZoneResolutionResult {
  gridFields: ResolvedField[]
  formFields: ResolvedField[]
  filterFields: ResolvedField[]
  primaryKey: string
}

function resolveViewZones(
  view: any,
  allModels: any[],
  allFields: any[],
  byocMap: Record<string, string>
): ZoneResolutionResult {
  const layoutConfig = view.layout_config || {}
  const fieldsMetadata: Record<string, any> = layoutConfig.fields_metadata || {}

  // Arrays de IDs na ordem exata configurada pelo dev no Studio
  const gridFieldsOrder: string[] = layoutConfig.grid_fields || []
  const formFieldsOrder: string[] = layoutConfig.form_fields || []
  const filterFieldsOrder: string[] = layoutConfig.filter_fields || []

  const components: any[] = view.ui_components || []
  const viewModelId: string = view.model_id

  // ── Grid Fields ──
  // Componentes que têm zones=['grid'] OU não têm zones (legado = grid)
  const gridComponents = components
    .filter((c: any) => {
      if (c.is_visible === false) return false
      const zones: string[] = c.config?.zones || []
      const field = allFields.find((f: any) => f.id === c.field_id)
      if (!field || field.is_visible_in_list === false) return false
      return zones.includes('grid') || zones.length === 0
    })
    .sort((a: any, b: any) => {
      const fIdA = allFields.find((f: any) => f.id === a.field_id)?.id
      const fIdB = allFields.find((f: any) => f.id === b.field_id)?.id
      const idxA = fIdA ? gridFieldsOrder.indexOf(fIdA) : -1
      const idxB = fIdB ? gridFieldsOrder.indexOf(fIdB) : -1
      if (idxA === -1 && idxB === -1) return (a.order_index || 0) - (b.order_index || 0)
      if (idxA === -1) return 1
      if (idxB === -1) return -1
      return idxA - idxB
    })

  let gridFields: ResolvedField[] = gridComponents.flatMap((c: any) => {
    const field = allFields.find((f: any) => f.id === c.field_id)
    if (!field) return []
    return [buildResolvedField(c, field, 'grid', viewModelId, allModels, fieldsMetadata)]
  })

  // Injeta campos virtuais/BYOC no grid
  gridFieldsOrder
    .filter((id: string) => id.startsWith('virt_') || id.startsWith('byoc_'))
    .forEach((id: string) => {
      if (!gridFields.find((f) => f.id === id)) {
        gridFields.push(buildVirtualField(id, 'grid', fieldsMetadata, byocMap))
      }
    })

  // Re-sort incluindo virtuais
  gridFields.sort((a, b) => {
    const idxA = gridFieldsOrder.indexOf(a.id)
    const idxB = gridFieldsOrder.indexOf(b.id)
    if (idxA === -1 && idxB === -1) return 0
    if (idxA === -1) return 1
    if (idxB === -1) return -1
    return idxA - idxB
  })

  // ── Form Fields ──
  const formComponents = components
    .filter((c: any) => {
      if (c.is_visible === false) return false
      const zones: string[] = c.config?.zones || []
      if (!zones.includes('form')) return false
      const field = allFields.find((f: any) => f.id === c.field_id)
      if (!field || field.is_visible_in_form === false) return false
      // Garante que o form do mestre contenha apenas campos do modelo mestre
      if (field.model_id && field.model_id !== viewModelId) return false
      return true
    })
    .sort((a: any, b: any) => {
      const fIdA = allFields.find((f: any) => f.id === a.field_id)?.id
      const fIdB = allFields.find((f: any) => f.id === b.field_id)?.id
      const idxA = fIdA ? formFieldsOrder.indexOf(fIdA) : -1
      const idxB = fIdB ? formFieldsOrder.indexOf(fIdB) : -1
      if (idxA === -1 && idxB === -1) return (a.order_index || 0) - (b.order_index || 0)
      if (idxA === -1) return 1
      if (idxB === -1) return -1
      return idxA - idxB
    })

  let formFields: ResolvedField[] = formComponents.flatMap((c: any) => {
    const field = allFields.find((f: any) => f.id === c.field_id)
    if (!field) return []
    return [buildResolvedField(c, field, 'form', viewModelId, allModels, fieldsMetadata)]
  })

  // Injeta campos virtuais/BYOC no form (apenas BYOCs ou campos com configuração explícita de form)
  formFieldsOrder
    .filter((id: string) => id.startsWith('virt_') || id.startsWith('byoc_'))
    .forEach((id: string) => {
      const isByoc = id.startsWith('byoc_')
      const hasFormMeta = !!(fieldsMetadata[`form-${id}`] || fieldsMetadata[id]?.zone === 3 || fieldsMetadata[id]?.component)
      if (isByoc || hasFormMeta) {
        if (!formFields.find((f) => f.id === id)) {
          formFields.push(buildVirtualField(id, 'form', fieldsMetadata, byocMap))
        }
      }
    })

  formFields.sort((a, b) => {
    const idxA = formFieldsOrder.indexOf(a.id)
    const idxB = formFieldsOrder.indexOf(b.id)
    if (idxA === -1 && idxB === -1) return 0
    if (idxA === -1) return 1
    if (idxB === -1) return -1
    return idxA - idxB
  })

  // ── Filter Fields ──
  const filterComponents = components
    .filter((c: any) => {
      if (c.is_visible === false) return false
      const zones: string[] = c.config?.zones || []
      if (!zones.includes('filter')) return false
      const field = allFields.find((f: any) => f.id === c.field_id)
      if (!field || field.is_searchable === false) return false
      return true
    })
    .sort((a: any, b: any) => {
      const fIdA = allFields.find((f: any) => f.id === a.field_id)?.id
      const fIdB = allFields.find((f: any) => f.id === b.field_id)?.id
      const idxA = fIdA ? filterFieldsOrder.indexOf(fIdA) : -1
      const idxB = fIdB ? filterFieldsOrder.indexOf(fIdB) : -1
      if (idxA === -1 && idxB === -1) return (a.order_index || 0) - (b.order_index || 0)
      if (idxA === -1) return 1
      if (idxB === -1) return -1
      return idxA - idxB
    })

  const filterFields: ResolvedField[] = filterComponents.flatMap((c: any) => {
    const field = allFields.find((f: any) => f.id === c.field_id)
    if (!field) return []
    return [buildResolvedField(c, field, 'filter', viewModelId, allModels, fieldsMetadata)]
  })

  // ── Primary Key ──
  const pkComponent = components.find((c: any) => {
    const field = allFields.find((f: any) => f.id === c.field_id)
    return field?.is_primary_key === true
  })
  const pkField = allFields.find((f: any) => f.id === pkComponent?.field_id)
  const primaryKey = pkField?.db_column_name || 'id'

  return { gridFields, formFields, filterFields, primaryKey }
}

// ─────────────────────────────────────────────────────────────────────────────
// Etapa 2 — Resolução do 'personalizado' (herança do UC mestre)
// ─────────────────────────────────────────────────────────────────────────────

function resolvePersonalizadoView(view: any, allViews: any[]): any {
  const masterSlug: string | undefined = view.layout_config?.master_use_case_slug
  let resolvedMasterView: any = null

  // Tenta pelo slug configurado (evita auto-referência)
  if (masterSlug && masterSlug !== view.slug) {
    const mv = allViews.find((v: any) => v.slug === masterSlug && v.logic_type !== 'personalizado')
    if (
      mv &&
      ((mv.layout_config?.grid_fields?.length || 0) > 0 ||
        (mv.layout_config?.form_fields?.length || 0) > 0)
    ) {
      resolvedMasterView = mv
    }
  }

  // Fallback: UC irmão do mesmo model com mais campos configurados
  if (!resolvedMasterView) {
    const siblings = allViews.filter(
      (v: any) =>
        v.model_id === view.model_id &&
        v.logic_type !== 'personalizado' &&
        v.id !== view.id
    )
    const ranked = siblings
      .filter(
        (v: any) =>
          (v.layout_config?.grid_fields?.length || 0) > 0 ||
          (v.layout_config?.form_fields?.length || 0) > 0
      )
      .sort(
        (a: any, b: any) =>
          (b.layout_config?.form_fields?.length || 0) +
          (b.layout_config?.grid_fields?.length || 0) -
          ((a.layout_config?.form_fields?.length || 0) +
            (a.layout_config?.grid_fields?.length || 0))
      )
    resolvedMasterView = ranked[0] || siblings[0] || null
  }

  if (!resolvedMasterView) return view

  // Herda campos e configurações do mestre (mesma lógica do Runtime)
  return {
    ...view,
    ui_components: resolvedMasterView.ui_components,
    layout_config: {
      ...view.layout_config,
      grid_fields: resolvedMasterView.layout_config?.grid_fields,
      filter_fields: resolvedMasterView.layout_config?.filter_fields,
      form_fields: resolvedMasterView.layout_config?.form_fields,
      fields_metadata: {
        ...(view.layout_config?.fields_metadata || {}),
        ...(resolvedMasterView.layout_config?.fields_metadata || {}),
      },
    },
    buttons_config: resolvedMasterView.buttons_config,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Buttons — converte buttons_config bruto em ViewButton[]
// ─────────────────────────────────────────────────────────────────────────────

function parseButtons(buttonsConfig: any[]): ViewButton[] {
  if (!Array.isArray(buttonsConfig)) return []

  const ROW_IDS = new Set(['view', 'edit', 'delete'])
  const FILTER_IDS = new Set(['search', 'clear'])
  const HEADER_IDS = new Set(['add', 'create', 'export'])

  const ROW_LABELS = new Set(['visualizar', 'view', 'editar', 'edit', 'excluir', 'delete', 'deletar', 'remover', 'apagar'])
  const FILTER_LABELS = new Set(['pesquisar', 'search', 'buscar', 'limpar', 'clear', 'filtrar', 'filtro', 'limpa'])
  const HEADER_LABELS = new Set(['novo registro', 'novo', 'adicionar', 'add', 'create', 'exportar', 'exportar dados', 'export'])

  return buttonsConfig
    .filter((b: any) => b && b.visible !== false)
    .map((b: any, idx: number): ViewButton => {
      const id = String(b.id || '').toLowerCase().trim()
      const rawAction = String(b.action_key || b.action_type || b.action || b.type || '').toLowerCase().trim()
      const label = String(b.custom_label || b.label || b.name || '').toLowerCase().trim()

      let actionType: ButtonActionType = 'custom'
      let placement: 'header' | 'row' | 'form' | 'filter' = 'header'

      if (id === 'add' || rawAction === 'create') {
        actionType = 'create'
        placement = 'header'
      } else if (id === 'export' || rawAction === 'export') {
        actionType = 'export'
        placement = 'header'
      } else if (id === 'view' || rawAction === 'view') {
        actionType = 'view'
        placement = 'row'
      } else if (id === 'edit' || rawAction === 'update' || rawAction === 'edit' || rawAction === 'pencil') {
        actionType = 'edit'
        placement = 'row'
      } else if (id === 'delete' || rawAction === 'delete') {
        actionType = 'delete'
        placement = 'row'
      } else if (id === 'search' || rawAction === 'search') {
        actionType = 'search'
        placement = 'filter'
      } else if (id === 'clear' || rawAction === 'clear') {
        actionType = 'clear'
        placement = 'filter'
      } else {
        actionType = (b.action_type || 'custom') as ButtonActionType
        if (ROW_IDS.has(id) || ROW_LABELS.has(label)) {
          placement = 'row'
        } else if (FILTER_IDS.has(id) || FILTER_LABELS.has(label)) {
          placement = 'filter'
        } else if (HEADER_IDS.has(id) || HEADER_LABELS.has(label)) {
          placement = 'header'
        } else if (b.placement === 'row' || b.placement === 'form' || b.placement === 'header' || b.placement === 'filter') {
          placement = b.placement
        } else {
          placement = 'row'
        }
      }

      return {
        id: b.id || `btn_${idx}`,
        label: b.custom_label || b.label || b.name || 'Ação',
        icon: b.icon,
        style: (b.style || b.variant || 'primary') as ButtonStyle,
        actionType,
        placement,
        confirmationMessage: b.confirmation_message,
        customLogic: b.custom_logic || b.logic,
        linkTarget: b.link_target || b.url,
      }
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom Actions — converte layout_config.custom_actions em ViewButton[]
// Respeita os contextos de exibição configurados pelo dev (row, global_top, master)
// ─────────────────────────────────────────────────────────────────────────────

function parseCustomActions(customActions: any[], allViews: any[] = []): ViewButton[] {
  if (!Array.isArray(customActions)) return []
  const buttons: ViewButton[] = []

  for (const act of customActions) {
    if (!act || act.enabled === false) continue

    const label = act.label || act.name || 'Ação Customizada'
    const icon = act.icon || act.custom_icon || 'Receipt'

    // Resolve URL / caso de uso de destino se o trigger for use_case
    let linkTarget = act.linkTarget || act.url || act.target_url
    if (!linkTarget && act.target_use_case) {
      const targetView = allViews.find(
        (v: any) => v.slug === act.target_use_case || v.id === act.target_use_case || v.name?.toLowerCase() === String(act.target_use_case).toLowerCase()
      )
      const targetSlug = targetView?.slug || act.target_use_case
      linkTarget = `/${targetSlug}`
    }

    const searchContexts = getActionContexts(act, 'search')
    const masterContexts = getActionContexts(act, 'master')

    // 1. Linha do Grid de Pesquisa
    if (searchContexts.includes('row')) {
      buttons.push({
        id: act.id || `custom_act_${label.toLowerCase().replace(/\s+/g, '_')}`,
        label,
        icon,
        style: (act.style || 'primary') as ButtonStyle,
        actionType: 'custom',
        placement: 'row',
        confirmationMessage: act.confirmation_message,
        customLogic: act.custom_logic || act.logic || act.trigger_type,
        linkTarget,
      })
    }

    // 2. Cabeçalho / Topo Global da Pesquisa
    if (searchContexts.includes('global_top')) {
      buttons.push({
        id: act.id || `custom_act_${label.toLowerCase().replace(/\s+/g, '_')}_top`,
        label,
        icon,
        style: (act.style || 'primary') as ButtonStyle,
        actionType: 'custom',
        placement: 'header',
        confirmationMessage: act.confirmation_message,
        customLogic: act.custom_logic || act.logic || act.trigger_type,
        linkTarget,
      })
    }

    // 3. Topo do Formulário Mestre
    if (masterContexts.includes('global_top') || masterContexts.includes('field_group')) {
      buttons.push({
        id: act.id || `custom_act_${label.toLowerCase().replace(/\s+/g, '_')}_form`,
        label,
        icon,
        style: (act.style || 'primary') as ButtonStyle,
        actionType: 'custom',
        placement: 'form',
        confirmationMessage: act.confirmation_message,
        customLogic: act.custom_logic || act.logic || act.trigger_type,
        linkTarget,
      })
    }
  }

  return buttons
}


// ─────────────────────────────────────────────────────────────────────────────
// Relation Tabs — resolve abas de detalhe (relações 1:N)
// ─────────────────────────────────────────────────────────────────────────────

function resolveRelationTabs(
  view: any,
  allViews: any[],
  rawRelations: any[],
  allModels: any[],
  allFields: any[],
  byocMap: Record<string, string>
): RelationTab[] {
  const tabs: RelationTab[] = []
  const layoutConfig = view.layout_config || {}
  const joins: any[] = layoutConfig.joins || []
  const detailsDisplayMode: Record<string, string> = layoutConfig.details_display_mode || {}
  const hiddenDetails: string[] = layoutConfig.hidden_details || []
  const tablesConfig: string[] = view.tables_config || []

  // Relações onde esta view é o "pai" (to_model_id = view.model_id)
  const parentRelations = rawRelations.filter(
    (r: any) => r.to_model_id === view.model_id
  )

  for (const rel of parentRelations) {
    const childModel = allModels.find((m: any) => m.id === rel.from_model_id)
    if (!childModel) continue

    // Se o childModel está explicitamente oculto ou não faz parte dos joins/detalhes configurados:
    if (hiddenDetails.includes(childModel.id)) continue
    if (detailsDisplayMode[childModel.id] === 'hidden') continue

    // Se a view tem joins ou tables_config configurados, só inclui os modelos participantes
    const isJoined = joins.some((j: any) => j.table === childModel.db_table_name || j.model_id === childModel.id)
    const isConfiguredTable = tablesConfig.includes(childModel.db_table_name) || tablesConfig.includes(childModel.id)
    const isExplicitTab = detailsDisplayMode[childModel.id] === 'tabs' || detailsDisplayMode[childModel.id] === 'sections'

    // Se o dev configurou joins ou tables_config, respeita a seleção dele:
    if ((joins.length > 0 || tablesConfig.length > 0) && !isJoined && !isConfiguredTable && !isExplicitTab) {
      continue
    }

    const fkFieldRaw = allFields.find((f: any) => f.id === rel.from_field_id)
    const foreignKey = fkFieldRaw?.db_column_name || ''

    const childModelName = toPascalCase(childModel.db_table_name)

    // Tenta encontrar a view do modelo filho para usar seus gridFields
    const childView = allViews.find(
      (v: any) => v.model_id === rel.from_model_id && v.logic_type !== 'personalizado'
    )

    const childModelColumnNames = new Set(
      allFields.filter((f: any) => f.model_id === childModel.id).map((f: any) => f.db_column_name)
    )

    let childGridFields: ResolvedField[] = []
    let childFormFields: ResolvedField[] = []
    if (childView) {
      const resolved = resolveViewZones(childView, allModels, allFields, byocMap)
      // Para aba de detalhe, inclui apenas colunas que realmente pertencem ao modelo filho
      childGridFields = resolved.gridFields
        .filter(f => {
          const colName = f.dbColumn.includes('.') ? f.dbColumn.split('.').pop()! : f.dbColumn
          return childModelColumnNames.size === 0 || childModelColumnNames.has(colName)
        })
        .slice(0, 6)
      childFormFields = resolved.formFields
        .filter(f => {
          const colName = f.dbColumn.includes('.') ? f.dbColumn.split('.').pop()! : f.dbColumn
          return childModelColumnNames.size === 0 || childModelColumnNames.has(colName)
        })
      if (childFormFields.length === 0) {
        childFormFields = childGridFields
      }
    } else {
      // Fallback: usa os campos do modelo filho
      const childModelFields = allFields.filter((f: any) => f.model_id === rel.from_model_id)
      childGridFields = childModelFields.slice(0, 5).map((f: any): ResolvedField => ({
        id: f.id,
        dbColumn: f.db_column_name,
        sqlExpression: f.db_column_name,
        label: f.display_name || f.db_column_name,
        dataType: f.data_type || 'varchar',
        isPrimaryKey: f.is_primary_key || false,
        isSortable: f.is_sortable || false,
        isVirtual: false,
        isByoc: false,
        config: {},
      }))
      childFormFields = childGridFields
    }

    // Enriquece campos de FK/Lookup com a relação para a tabela destino (ex: funcionario -> funcionarios)
    const enrichRelationFields = (fieldsList: ResolvedField[]) => {
      return fieldsList.map(f => {
        const colOnly = f.dbColumn.includes('.') ? f.dbColumn.split('.').pop()! : f.dbColumn
        const fkRel = rawRelations.find((r: any) =>
          r.from_model_id === childModel.id && (r.from_field_id === f.id || r.from_column === colOnly)
        )
        let targetModel = fkRel ? allModels.find((m: any) => m.id === fkRel.to_model_id) : null
        if (!targetModel) {
          targetModel = allModels.find((m: any) =>
            m.id !== childModel.id &&
            (colOnly === m.db_table_name ||
             colOnly === m.db_table_name.slice(0, -1) ||
             colOnly.startsWith(m.db_table_name.slice(0, -1)) ||
             colOnly === `${m.db_table_name}_id` ||
             colOnly === `id_${m.db_table_name}` ||
             colOnly === `id_${m.db_table_name.slice(0, -1)}`)
          )
        }
        if (targetModel) {
          return {
            ...f,
            config: {
              ...f.config,
              relation: {
                targetTable: targetModel.db_table_name,
                targetModel: toPascalCase(targetModel.db_table_name),
                displayColumn: 'nome',
                valueColumn: 'id',
              }
            }
          }
        }
        return f
      })
    }

    childGridFields = enrichRelationFields(childGridFields)
    childFormFields = enrichRelationFields(childFormFields)

    const tabLabel = layoutConfig.details_tab_titles?.[childModel.id] || childModel.display_name || childModelName

    // Identifica sub-detalhes (relações 1:N filhas deste modelo, ex: pedidos -> itens_pedido)
    const subRelations = rawRelations.filter((r: any) => r.to_model_id === childModel.id)
    const subDetails: SubRelationDetail[] = subRelations.map((sr: any) => {
      const subModel = allModels.find((m: any) => m.id === sr.from_model_id)
      if (!subModel) return null
      const subFkField = allFields.find((f: any) => f.id === sr.from_field_id)
      const subFkCol = subFkField?.db_column_name || `${childModel.db_table_name}_id`
      const subModelName = toPascalCase(subModel.db_table_name)
      const subView = allViews.find(
        (v: any) => v.model_id === subModel.id && v.logic_type !== 'personalizado'
      )

      const subModelColumnNames = new Set(
        allFields.filter((f: any) => f.model_id === subModel.id).map((f: any) => f.db_column_name)
      )

      let subGridFields: ResolvedField[] = []
      let subFormFields: ResolvedField[] = []
      if (subView) {
        const resolved = resolveViewZones(subView, allModels, allFields, byocMap)
        subGridFields = resolved.gridFields.filter(f => {
          const colName = f.dbColumn.includes('.') ? f.dbColumn.split('.').pop()! : f.dbColumn
          return subModelColumnNames.size === 0 || subModelColumnNames.has(colName)
        })
        subFormFields = resolved.formFields.filter(f => {
          const colName = f.dbColumn.includes('.') ? f.dbColumn.split('.').pop()! : f.dbColumn
          return subModelColumnNames.size === 0 || subModelColumnNames.has(colName)
        })
        if (subFormFields.length === 0) subFormFields = subGridFields
      } else {
        const auditColumns = new Set(['criado_em', 'atualizado_em', 'created_at', 'updated_at', 'deleted_at'])
        const subFields = allFields.filter((f: any) =>
          f.model_id === subModel.id &&
          !f.is_primary_key &&
          f.db_column_name !== subFkCol &&
          !auditColumns.has(f.db_column_name.toLowerCase())
        )
        subGridFields = subFields.map((f: any): ResolvedField => {
          let label = f.display_name
          if (!label || label === f.db_column_name || label.toUpperCase() === f.db_column_name.toUpperCase()) {
            const map: Record<string, string> = {
              'produto_id': 'Produto',
              'produto': 'Produto',
              'quantidade': 'Quantidade',
              'qtd': 'Quantidade',
              'preco_unitario': 'Preço Unitário',
              'valor_unitario': 'Preço Unitário',
              'preco': 'Preço Unitário',
              'total_rs': 'Total R$',
              'total': 'Total R$',
              'subtotal': 'Total R$',
              'motorista_id': 'Motorista',
              'data_estimada': 'Data Estimada',
              'lat_atual': 'Lat Atual',
              'lng_atual': 'Lng Atual',
              'status': 'Status',
            }
            label = map[f.db_column_name.toLowerCase()] || f.db_column_name
              .replace(/_/g, ' ')
              .replace(/\b\w/g, (c: string) => c.toUpperCase())
          }
          return {
            id: f.id,
            dbColumn: f.db_column_name,
            sqlExpression: f.db_column_name,
            label,
            dataType: f.data_type || 'varchar',
            isPrimaryKey: f.is_primary_key || false,
            isSortable: f.is_sortable || false,
            isVirtual: false,
            isByoc: false,
            config: f.config || {},
          }
        })
        if (subModel.db_table_name === 'itens_pedido' && !subGridFields.some(f => f.dbColumn.includes('total'))) {
          subGridFields.push({
            id: 'virt_total_rs',
            dbColumn: 'total_rs',
            sqlExpression: 'total_rs',
            label: 'Total R$',
            dataType: 'numeric',
            isPrimaryKey: false,
            isSortable: false,
            isVirtual: true,
            isByoc: false,
            config: { readOnly: true, width: '25%', columns: 3 },
          })
        }
        subFormFields = subGridFields
      }

      const enrichSubFields = (fieldsList: ResolvedField[]) => {
        return fieldsList.map(f => {
          const colOnly = f.dbColumn.includes('.') ? f.dbColumn.split('.').pop()! : f.dbColumn
          const fkRel = rawRelations.find((r: any) =>
            r.from_model_id === subModel.id && (r.from_field_id === f.id || r.from_column === colOnly)
          )
          let targetModel = fkRel ? allModels.find((m: any) => m.id === fkRel.to_model_id) : null
          if (!targetModel) {
            targetModel = allModels.find((m: any) =>
              m.id !== subModel.id &&
              (colOnly === m.db_table_name ||
               colOnly === m.db_table_name.slice(0, -1) ||
               colOnly.startsWith(m.db_table_name.slice(0, -1)) ||
               colOnly === `${m.db_table_name}_id` ||
               colOnly === `id_${m.db_table_name}` ||
               colOnly === `id_${m.db_table_name.slice(0, -1)}`)
            )
          }
          if (targetModel) {
            return {
              ...f,
              config: {
                ...f.config,
                relation: {
                  targetTable: targetModel.db_table_name,
                  targetModel: toPascalCase(targetModel.db_table_name),
                  displayColumn: 'nome',
                  valueColumn: 'id',
                }
              }
            }
          }
          return f
        })
      }

      subGridFields = enrichSubFields(subGridFields)
      subFormFields = enrichSubFields(subFormFields)

      return {
        relatedModelId: subModel.id,
        relatedTable: subModel.db_table_name,
        relatedModelName: subModelName,
        foreignKey: subFkCol,
        label: subModel.display_name || subModelName,
        gridFields: subGridFields,
        formFields: subFormFields,
      }
    }).filter(Boolean) as SubRelationDetail[]

    tabs.push({
      relatedModelId: rel.from_model_id,
      relatedTable: childModel.db_table_name,
      relatedModelName: childModelName,
      foreignKey,
      sourceKey: 'id',
      displayMode: rel.display_mode || 'tab',
      label: tabLabel,
      gridFields: childGridFields,
      formFields: childFormFields,
      subDetails,
    })
  }

  return tabs
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Parser
// ─────────────────────────────────────────────────────────────────────────────

export function parseMetaBuilderJSON(
  rawJson: any,
  dbStack: DbType,
  options?: { dbConnectionString?: string; supabaseUrl?: string; supabaseAnonKey?: string }
): AppAST {
  const rawModels: any[] = rawJson.models || []
  const rawViews: any[] = rawJson.views || rawJson.ui_views || []
  const rawFields: any[] = rawJson.fields || rawModels.flatMap((m: any) => m.fields || [])
  const rawRelations: any[] = rawJson.relations || []

  // Garante que components de dentro das views sejam incluídos
  // (o JSON pode vir com ui_components já dentro de cada view)
  const rawComponents: any[] = rawJson.components || rawJson.ui_components || []
  rawViews.forEach((v: any) => {
    if (v.ui_components && Array.isArray(v.ui_components)) {
      v.ui_components.forEach((c: any) => {
        if (!rawComponents.find((rc: any) => rc.id === c.id)) {
          rawComponents.push({ ...c, view_id: c.view_id || v.id })
        }
      })
    }
    // Garante que cada componente tenha view_id
    if (Array.isArray(v.ui_components)) {
      v.ui_components = v.ui_components.map((c: any) => ({
        ...c,
        view_id: c.view_id || v.id,
      }))
    }
  })

  // BYOC map (nome do componente → código compilado)
  const byocMap: Record<string, string> = {}

  // ── Etapa 1: Constrói Models & Fields ──
  const models: ModelNode[] = rawModels.map((rm: any) => {
    const mFields = rawFields.filter((f: any) => f.model_id === rm.id)
    const fields: FieldNode[] = mFields.map((f: any): FieldNode => ({
      id: f.id,
      name: f.display_name || f.db_column_name,
      dbColumn: f.db_column_name,
      type: mapFieldType(f.data_type),
      dataType: f.data_type || 'varchar',
      isPrimary: f.is_primary_key || false,
      isRequired: f.is_required || false,
      isVisibleInList: f.is_visible_in_list !== false,
      isVisibleInForm: f.is_visible_in_form !== false,
      isSearchable: f.is_searchable !== false,
      isSortable: f.is_sortable !== false,
      config: f.config || {},
      relation: f.is_foreign_key
        ? { targetModel: f.foreign_key_target_model, foreignKey: f.foreign_key_column }
        : undefined,
    }))

    return {
      id: rm.id,
      name: toPascalCase(rm.display_name || rm.db_table_name),
      dbTable: rm.db_table_name,
      dbSchema: rm.db_schema_name || 'public',
      fields,
    }
  })

  // ── Navigation ──
  const rawNav = rawJson.project?.navigation || rawJson.navigation || []
  const navigation: NavigationItem[] = (rawNav as NavigationItem[]).map((item: any) => {
    let icon = item.icon
    if (!icon) {
      const matchView = rawViews.find((v: any) =>
        v.id === item.view_id ||
        v.id === item.id ||
        v.slug === item.target?.replace(/^\//, '') ||
        (v.name && item.label && v.name.toLowerCase() === item.label.toLowerCase())
      )
      if (matchView) {
        icon = findNavIcon([], matchView)
      }
    }
    return {
      ...item,
      icon: icon || 'Layout'
    }
  })

  // ── Etapa 1→5: Constrói Routes a partir das Views ──
  const routes: RouteNode[] = []

  for (const rv of rawViews) {
    // Garante que os ui_components estejam dentro da view (normalização)
    if (!rv.ui_components || rv.ui_components.length === 0) {
      rv.ui_components = rawComponents.filter((c: any) => c.view_id === rv.id)
    }

    // Etapa 2: Resolve 'personalizado'
    const resolvedView =
      rv.logic_type === 'personalizado' ? resolvePersonalizadoView(rv, rawViews) : rv

    const model = models.find((m) => m.id === resolvedView.model_id)
    if (!model) continue

    // Etapas 3, 4 e 5: resolve campos por zona
    const { gridFields, formFields, filterFields, primaryKey } = resolveViewZones(
      resolvedView,
      rawModels,
      rawFields,
      byocMap
    )

    // Buttons (padrão de interface + custom_actions configuradas pelo dev)
    const stdButtons: ViewButton[] = parseButtons(resolvedView.buttons_config || [])
    const customButtons: ViewButton[] = parseCustomActions(resolvedView.layout_config?.custom_actions || [], rawViews)
    const buttons: ViewButton[] = [...stdButtons, ...customButtons]

    // Relation Tabs
    const relationTabs: RelationTab[] = resolveRelationTabs(
      resolvedView,
      rawViews,
      rawRelations,
      rawModels,
      rawFields,
      byocMap
    )

    // Encontra ícone do nav item correspondente
    const navIcon = findNavIcon(navigation, resolvedView)

    routes.push({
      path: `/${rv.slug || rv.name?.toLowerCase() || model.dbTable}`,
      viewSlug: rv.slug || '',
      logicType: resolvedView.logic_type || 'pesquisa_cadastro',
      modelId: model.id,
      modelTable: model.dbTable,
      modelName: model.name,
      title: rv.name || model.name,
      icon: navIcon,
      primaryKey,
      gridFields,
      formFields,
      filterFields,
      displayType: resolvedView.layout_config?.display_type || 'list',
      buttons,
      relationTabs,
      rawLayoutConfig: resolvedView.layout_config,
    })
  }

  // ── Actions (CRUD padrão para cada modelo) ──
  const actions: ActionNode[] = []
  for (const m of models) {
    actions.push({ id: `create_${m.id}`, name: `create${m.name}`, modelId: m.id, type: 'insert', params: ['data'] })
    actions.push({ id: `update_${m.id}`, name: `update${m.name}`, modelId: m.id, type: 'update', params: ['id', 'data'] })
    actions.push({ id: `delete_${m.id}`, name: `delete${m.name}`, modelId: m.id, type: 'delete', params: ['id'] })
    actions.push({ id: `list_${m.id}`, name: `get${m.name}List`, modelId: m.id, type: 'custom', params: [] })
    actions.push({ id: `byid_${m.id}`, name: `get${m.name}ById`, modelId: m.id, type: 'custom', params: ['id'] })
    actions.push({ id: `byfield_${m.id}`, name: `get${m.name}ByField`, modelId: m.id, type: 'custom', params: ['field', 'value'] })
  }

  // ── Auth Config ──
  let authConfig: AuthConfig | undefined
  if (rawJson.auth_config) {
    const ac = rawJson.auth_config
    authConfig = {
      authType: ac.auth_type ?? 'database',
      tableName: ac.table_name || ac.db_table_name,
      emailColumn: ac.email_column || ac.db_email_column || 'email',
      passwordColumn: ac.password_column || ac.db_password_column || 'hash_senha',
      hashFormat: ac.hash_format || ac.db_password_hash_type || 'bcrypt',
    }
  }

  const projectDesc =
    rawJson.project?.description ||
    rawJson.description ||
    rawJson.project?.subtitle ||
    'CRM COMPLETO'

  return {
    projectName: rawJson.project?.name || rawJson.name || 'CRM',
    projectSlug: rawJson.project?.slug || rawJson.slug || 'app',
    projectDescription: projectDesc,
    projectIcon: rawJson.project?.icon || rawJson.icon || 'Layers',
    dbStack,
    dbConnectionString: options?.dbConnectionString,
    supabaseUrl: options?.supabaseUrl,
    supabaseAnonKey: options?.supabaseAnonKey,
    authConfig,
    navigation,
    models,
    routes,
    actions,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Workspace Parser
// ─────────────────────────────────────────────────────────────────────────────

export function parseWorkspaceJSON(
  rawWorkspace: any,
  rawProjects: any[],
  dbStack: DbType,
  options?: { dbConnectionString?: string; supabaseUrl?: string; supabaseAnonKey?: string }
): WorkspaceAST {
  const projects: WorkspaceProjectNode[] = rawProjects.map((p) => ({
    slug: p.slug || p.id,
    name: p.display_name || p.name || p.slug,
    description: p.description || '',
    app: parseMetaBuilderJSON(p, dbStack, options),
  }))

  return {
    workspaceName: rawWorkspace.name || rawWorkspace.slug,
    workspaceSlug: rawWorkspace.slug,
    dbStack,
    dbConnectionString: options?.dbConnectionString,
    supabaseUrl: options?.supabaseUrl,
    supabaseAnonKey: options?.supabaseAnonKey,
    projects,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper — encontra ícone de um nav item pelo slug
// ─────────────────────────────────────────────────────────────────────────────

function findNavIcon(navigation: NavigationItem[], view: any): string | undefined {
  if (!view) return 'Layout'
  const slug = (typeof view === 'string' ? view : (view.slug || '')).toLowerCase().replace(/^\//, '')
  const viewId = typeof view === 'object' ? view.id : null
  const viewName = typeof view === 'object' ? (view.name || '').toLowerCase() : ''

  function search(items: NavigationItem[]): string | undefined {
    for (const item of items) {
      const target = (item.target || '').toLowerCase().replace(/^\//, '')
      const isMatch =
        (slug && target === slug) ||
        (viewId && item.view_id === viewId) ||
        (viewId && item.id === viewId) ||
        (viewName && item.label && item.label.toLowerCase() === viewName)

      if (isMatch && item.icon) {
        return item.icon
      }
      if (item.type === 'folder' && item.children) {
        const found = search(item.children)
        if (found) return found
      }
    }
    return undefined
  }

  const fromNav = search(navigation)
  if (fromNav) return fromNav

  if (typeof view === 'object') {
    if (view.icon) return view.icon
    if (view.layout_config?.icon) return view.layout_config.icon
  }

  // Fallbacks inteligentes por semântica do caso de uso
  if (slug.includes('cliente') || viewName.includes('cliente')) return 'Users'
  if (slug.includes('pedido') || viewName.includes('pedido')) return 'ShoppingCart'
  if (slug.includes('produto') || viewName.includes('produto')) return 'Package'
  if (slug.includes('empresa') || viewName.includes('empresa')) return 'Building2'
  if (slug.includes('entrega') || viewName.includes('entrega')) return 'Truck'
  if (slug.includes('projeto') || viewName.includes('projeto')) return 'FolderKanban'
  if (slug.includes('download') || viewName.includes('download')) return 'Download'
  if (slug.includes('funciona') || viewName.includes('funciona')) return 'UserCheck'
  if (slug.includes('task') || viewName.includes('task')) return 'CheckSquare'
  if (slug.includes('dash') || viewName.includes('dash')) return 'BarChart3'

  return 'Layout'
}
