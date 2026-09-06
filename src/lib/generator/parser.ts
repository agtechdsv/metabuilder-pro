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
  TimelineConfig,
  AnalyticsConfig,
  AnalyticsWidget,
  SchedulerConfig,
  GalleryConfig,
  GanttConfig,
  MapConfig,
  BlueprintConfig,
  MindmapConfig,
  MindmapLevel,
} from './ast'
import { getActionContexts } from '@/lib/customActionsHelper'
import { resolveRelations, resolveAllJoins } from '@/lib/relationPathFinder'

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

function findDisplayColumn(fields: any[]): string {
  if (!fields || fields.length === 0) return ''
  const strField = fields.find((f: any) => !f.is_primary_key && !f.isPrimary && ['varchar', 'text', 'string'].includes(String(f.data_type || f.type || '').toLowerCase()))
  if (strField) return strField.db_column_name || strField.dbColumn || ''
  const pkField = fields.find((f: any) => f.is_primary_key || f.isPrimary)
  if (pkField) return pkField.db_column_name || pkField.dbColumn || ''
  return fields[0]?.db_column_name || fields[0]?.dbColumn || ''
}

function enrichFieldsWithRelations(
  fieldsList: ResolvedField[],
  model: { id: string; dbTable: string },
  rawRelations: any[],
  rawModels: any[],
  rawFields: any[]
): ResolvedField[] {
  return fieldsList.map(f => {
    if (f.config?.component?.options_type === 'enumeration' || f.config?.options_type === 'enumeration') {
      return f
    }
    if (f.config?.relation?.targetTable && f.config?.relation?.displayColumn) {
      return f
    }
    const configuredTarget = f.config?.component?.rel_table || f.config?.rel_table || f.config?.relation?.targetTable
    const configuredDisplay = f.config?.component?.rel_label || f.config?.rel_label || f.config?.relation?.displayColumn
    const configuredValue = f.config?.component?.rel_value || f.config?.rel_value || f.config?.relation?.valueColumn

    const colOnly = f.dbColumn.includes('.') ? f.dbColumn.split('.').pop()! : f.dbColumn
    const fkRel = rawRelations.find((r: any) =>
      r.from_model_id === model.id && (r.from_field_id === f.id || r.from_column === colOnly)
    )
    let targetModel = configuredTarget
      ? rawModels.find((m: any) => m.db_table_name === configuredTarget)
      : (fkRel ? rawModels.find((m: any) => m.id === fkRel.to_model_id) : null)

    if (targetModel) {
      const targetFields = rawFields.filter((rf: any) => rf.model_id === targetModel.id)
      const pkCol = configuredValue || targetFields.find((rf: any) => rf.is_primary_key)?.db_column_name || targetFields[0]?.db_column_name || ''
      const dispCol = configuredDisplay || findDisplayColumn(targetFields) || pkCol
      return {
        ...f,
        config: {
          ...f.config,
          relation: {
            targetTable: targetModel.db_table_name,
            targetModel: toPascalCase(targetModel.db_table_name),
            displayColumn: dispCol,
            valueColumn: pkCol,
          }
        }
      }
    }
    return f
  })
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
  modelName?: string,
  enumsMap: Record<string, Array<{ label: string; value: string }>> = {}
): ResolvedFieldConfig {
  const colName = (rawField?.db_column_name || '').toLowerCase()
  const rawId = (rawField?.id || fieldId || '').toLowerCase()
  const tblName = (modelName || '').toLowerCase()
  const fullColName = tblName && colName ? `${tblName}.${colName}` : ''

  // Busca chaves candidatas no fieldsMetadata do Studio com prioridade crescente:
  // As chaves específicas com prefixo da zona vêm por último para prevalecerem sobre chaves genéricas.
  const candidateKeys = [
    rawId || null,
    fieldId,
    colName || null,
    fullColName || null,
    colName ? `${zone}-${colName}` : null,
    fullColName ? `${zone}-${fullColName}` : null,
    rawId ? `${zone}-${rawId}` : null,
    `${zone}-${fieldId}`,
  ].filter(Boolean) as string[]

  let mergedMeta: Record<string, any> = {}
  for (const k of candidateKeys) {
    if (fieldsMetadata[k]) {
      mergedMeta = { ...mergedMeta, ...fieldsMetadata[k] }
    }
  }

  // Busca também por chaves case-insensitive e correspondência parcial no fieldsMetadata
  for (const [mk, mv] of Object.entries(fieldsMetadata)) {
    const mkLower = mk.toLowerCase()
    // IMPORTANTE: Nunca permita que metadados explicitamente prefixados com outra zona sobrescrevam a zona atual!
    const otherZones = ['grid', 'form', 'filter'].filter(z => z !== zone)
    if (otherZones.some(oz => mkLower.startsWith(`${oz}-`))) {
      continue
    }

    if (
      (colName && (mkLower === colName || mkLower === `${zone}-${colName}` || mkLower.endsWith(`.${colName}`))) ||
      (rawId && (mkLower === rawId || mkLower === `${zone}-${rawId}` || mkLower.endsWith(rawId))) ||
      (fullColName && (mkLower === fullColName || mkLower === `${zone}-${fullColName}`))
    ) {
      mergedMeta = { ...mergedMeta, ...mv }
    }
  }

  const merged = { ...baseFieldConfig, ...mergedMeta }

  let options =
    mergedMeta.options ||
    mergedMeta.component?.options ||
    mergedMeta.component?.fixed_options ||
    mergedMeta.fixed_options ||
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

  const comp = mergedMeta.component || merged.component || baseFieldConfig?.component
  const compType = String(comp?.type || '').toLowerCase()
  if (comp && comp.options_type === 'enumeration' && comp.rel_table && !['text', 'number', 'textarea'].includes(compType)) {
    const enumOpts = enumsMap[comp.rel_table] || enumsMap[comp.rel_table.toLowerCase()]
    if (enumOpts && enumOpts.length > 0) {
      options = enumOpts
    }
  }

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


  if (options && Array.isArray(options) && options.length > 0) {
    merged.options = options
    if (merged.component) {
      merged.component = { ...(merged.component || {}), options }
    }
  }

  const relation = mergedMeta.relation || merged.relation || rawField?.relation || baseFieldConfig?.relation

  // Extrai colunas de 1 a 12 com prioridade ABSOLUTA para a metadata da zona configurada no Studio
  const rawCols =
    mergedMeta.component?.gridSpan ??
    mergedMeta.component?.modalGridSpan ??
    mergedMeta.gridSpan ??
    mergedMeta.modalGridSpan ??
    mergedMeta.component?.columns ??
    mergedMeta.component?.col_span ??
    mergedMeta.component?.colspan ??
    mergedMeta.component?.layout_padrao?.colunas ??
    mergedMeta.component?.layout_padrao?.ocupar_colunas ??
    mergedMeta.layout_padrao?.colunas ??
    mergedMeta.layout_padrao?.ocupar_colunas ??
    mergedMeta.layout?.columns ??
    mergedMeta.layout?.col_span ??
    mergedMeta.columns ??
    mergedMeta.col_span ??
    mergedMeta.colSpan ??
    mergedMeta.ocupar_colunas ??
    baseFieldConfig?.component?.gridSpan ??
    baseFieldConfig?.gridSpan ??
    baseFieldConfig?.columns ??
    baseFieldConfig?.col_span

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
    label: mergedMeta.label || merged.label,
    width: mergedMeta.width || mergedMeta.component?.width || merged.width,
    gridSpan: columns || mergedMeta.gridSpan || mergedMeta.component?.gridSpan || merged.gridSpan || merged.component?.gridSpan,
    modalGridSpan: mergedMeta.component?.modalGridSpan || mergedMeta.modalGridSpan || merged.component?.modalGridSpan || merged.modalGridSpan,
    columns: columns || mergedMeta.columns || mergedMeta.col_span || merged.columns || merged.col_span,
    format: mergedMeta.format || merged.format,
    options,
    relation,
    readOnly: mergedMeta.readOnly || mergedMeta.read_only || mergedMeta.content?.readonly || merged.readOnly || merged.read_only || merged.content?.readonly,
    required: mergedMeta.required || mergedMeta.is_required || mergedMeta.content?.required || merged.required || merged.is_required || merged.content?.required,
    placeholder: mergedMeta.placeholder || mergedMeta.content?.placeholder || merged.placeholder || merged.content?.placeholder,
    multiline: mergedMeta.multiline || mergedMeta.is_multiline || merged.multiline || merged.is_multiline,
    rows: mergedMeta.rows || mergedMeta.component?.rows || merged.rows || merged.component?.rows,
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
  fieldsMetadata: Record<string, any>,
  enumsMap: Record<string, Array<{ label: string; value: string }>> = {}
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
  const config = applyFieldsMeta(field.id, zone, fieldsMetadata, baseConfig, field, modelTableName, enumsMap)
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
  byocMap: Record<string, string>,
  enumsMap: Record<string, Array<{ label: string; value: string }>> = {}
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
    return [buildResolvedField(c, field, 'grid', viewModelId, allModels, fieldsMetadata, enumsMap)]
  })

  // Injeta campos virtuais/BYOC no grid pertencentes a este modelo
  gridFieldsOrder
    .filter((id: string) => id.startsWith('virt_') || id.startsWith('byoc_'))
    .forEach((id: string) => {
      const meta = fieldsMetadata[id] || fieldsMetadata[`grid-${id}`] || {}
      const assignedModelId = id.startsWith('byoc_') ? meta.byoc_model_id : meta.virtual_model_id
      if (assignedModelId && assignedModelId !== viewModelId) {
        return
      }
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
    return [buildResolvedField(c, field, 'form', viewModelId, allModels, fieldsMetadata, enumsMap)]
  })

  // Injeta componentes BYOC e virtuais no form pertencentes a este modelo
  formFieldsOrder
    .filter((id: string) => id.startsWith('byoc_') || id.startsWith('virt_'))
    .forEach((id: string) => {
      const meta = fieldsMetadata[id] || fieldsMetadata[`form-${id}`] || {}
      const assignedModelId = id.startsWith('byoc_') ? meta.byoc_model_id : meta.virtual_model_id
      if (assignedModelId && assignedModelId !== viewModelId) {
        return
      }
      if (!formFields.find((f) => f.id === id)) {
        formFields.push(buildVirtualField(id, 'form', fieldsMetadata, byocMap))
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
      const isExplicitFilterZone = zones.includes('filter')
      const isExplicitFilterOrder = filterFieldsOrder.includes(c.field_id) || filterFieldsOrder.includes(c.id)
      if (!isExplicitFilterZone && !isExplicitFilterOrder) return false
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
    return [buildResolvedField(c, field, 'filter', viewModelId, allModels, fieldsMetadata, enumsMap)]
  })

  // Se algum campo em filterFieldsOrder não estava em filterComponents, adiciona diretamente
  filterFieldsOrder.forEach((id: string) => {
    if (!filterFields.find((f) => f.id === id)) {
      const field = allFields.find((f: any) => f.id === id)
      if (field) {
        const dummyComp = { id: `filter_${id}`, field_id: id, config: fieldsMetadata[id] || {} }
        filterFields.push(buildResolvedField(dummyComp, field, 'filter', viewModelId, allModels, fieldsMetadata, enumsMap))
      }
    }
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
    const targetUseCaseSlug = act.usecase_slug || act.target_use_case
    let linkTarget = act.linkTarget || act.url || act.target_url
    if (!linkTarget && targetUseCaseSlug) {
      const targetView = allViews.find(
        (v: any) => v.slug === targetUseCaseSlug || v.id === targetUseCaseSlug || v.name?.toLowerCase() === String(targetUseCaseSlug).toLowerCase()
      )
      const targetSlug = targetView?.slug || targetUseCaseSlug
      linkTarget = `/${targetSlug}`
    }

    const triggerType = act.trigger_type || (targetUseCaseSlug ? 'usecase' : 'custom')
    const usecaseSlug = targetUseCaseSlug
    const usecaseOpenMode = act.usecase_open_mode || 'modal'
    const usecaseModalSize = act.usecase_modal_size || 'full'
    const usecaseModalWidth = act.usecase_modal_width
    const usecaseModalHeight = act.usecase_modal_height
    const usecaseSelectedFields = act.usecase_selected_fields || []
    const usecaseParams = act.usecase_params || ''

    const searchContexts = getActionContexts(act, 'search')
    const masterContexts = getActionContexts(act, 'master')

    const baseButton: Partial<ViewButton> = {
      label,
      icon,
      style: (act.style || 'primary') as ButtonStyle,
      actionType: 'custom',
      confirmationMessage: act.confirmation_message,
      customLogic: act.custom_logic || act.logic || act.trigger_type,
      linkTarget,
      triggerType,
      usecaseSlug,
      usecaseOpenMode,
      usecaseModalSize,
      usecaseModalWidth,
      usecaseModalHeight,
      usecaseSelectedFields,
      usecaseParams,
    }

    // 1. Linha do Grid de Pesquisa
    if (searchContexts.includes('row')) {
      buttons.push({
        ...baseButton,
        id: act.id || `custom_act_${label.toLowerCase().replace(/\s+/g, '_')}`,
        placement: 'row',
      } as ViewButton)
    }

    // 2. Cabeçalho / Topo Global da Pesquisa
    if (searchContexts.includes('global_top')) {
      buttons.push({
        ...baseButton,
        id: act.id || `custom_act_${label.toLowerCase().replace(/\s+/g, '_')}_top`,
        placement: 'header',
      } as ViewButton)
    }

    // 3. Topo do Formulário Mestre
    if (masterContexts.includes('global_top') || masterContexts.includes('field_group')) {
      buttons.push({
        ...baseButton,
        id: act.id || `custom_act_${label.toLowerCase().replace(/\s+/g, '_')}_form`,
        placement: 'form',
      } as ViewButton)
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

  const parentModel = allModels.find((m: any) => m.id === view.model_id)
  const parentTableName = (parentModel?.db_table_name || '').toLowerCase()
  const parentTableSingular = parentTableName.endsWith('s') ? parentTableName.slice(0, -1) : parentTableName

  // Relações onde esta view é o "pai" (to_model_id = view.model_id ou master_model_id = view.model_id)
  const parentRelations: any[] = rawRelations.filter(
    (r: any) => (r.to_model_id && r.to_model_id === view.model_id) || (r.master_model_id && r.master_model_id === view.model_id)
  )

  // Fallback via Heurística: Modelos filhos que possuem chave estrangeira para o pai
  for (const childModel of allModels) {
    if (childModel.id === view.model_id) continue
    const already = parentRelations.some((r: any) => (r.from_model_id || r.detail_model_id) === childModel.id)
    if (already) continue

    const childFields = allFields.filter((f: any) => f.model_id === childModel.id)
    const fkField = childFields.find((f: any) => {
      const col = (f.db_column_name || '').toLowerCase()
      const fkt = (f.foreign_key_table || '').toLowerCase()
      return (
        (fkt && fkt === parentTableName) ||
        col === `${parentTableName}_id` ||
        col === `${parentTableSingular}_id` ||
        (f.config?.relation?.targetTable && f.config.relation.targetTable.toLowerCase() === parentTableName)
      )
    })

    if (fkField) {
      parentRelations.push({
        from_model_id: childModel.id,
        to_model_id: view.model_id,
        from_field_id: fkField.id,
        to_field_id: parentModel?.fields?.find((f: any) => f.is_primary_key || f.db_column_name === 'id')?.id,
      })
    }
  }

  for (const rel of parentRelations) {
    const fromId = rel.from_model_id || rel.detail_model_id
    const childModel = allModels.find((m: any) => m.id === fromId)
    if (!childModel) continue

    // Auto-relacionamentos (ex: tarefa_antecessora -> tarefas) nunca são abas de detalhe
    if (childModel.id === view.model_id) continue

    // Se o childModel está explicitamente oculto ou não faz parte dos joins/detalhes configurados:
    if (hiddenDetails.includes(childModel.id)) continue
    if (detailsDisplayMode[childModel.id] === 'hidden') continue

    // Se a view tem joins configurados (e não é mapa_mental), só inclui os modelos participantes
    const isJoined = joins.some((j: any) => j.table === childModel.db_table_name || j.model_id === childModel.id)
    const isExplicitTab = detailsDisplayMode[childModel.id] === 'tabs' || detailsDisplayMode[childModel.id] === 'sections'

    if (joins.length > 0 && !isJoined && !isExplicitTab && view.logic_type !== 'mapa_mental') {
      continue
    }

    const fkFieldId = rel.from_field_id || rel.foreign_column_id
    let fkFieldRaw = allFields.find((f: any) => f.id === fkFieldId)
    if (!fkFieldRaw) {
      const childFields = allFields.filter((f: any) => f.model_id === childModel.id)
      fkFieldRaw = childFields.find((f: any) => {
        const col = (f.db_column_name || '').toLowerCase()
        const fkt = (f.foreign_key_table || '').toLowerCase()
        return (fkt && fkt === parentTableName) || col === `${parentTableName}_id` || col === `${parentTableSingular}_id`
      })
    }
    const foreignKey = fkFieldRaw?.db_column_name || `${parentTableName}_id`

    const childModelName = toPascalCase(childModel.db_table_name)

    const parentViewFieldsMetadata = layoutConfig.fields_metadata || {}
    const parentViewFormFieldsOrder: string[] = layoutConfig.form_fields || []
    const childModelFields = allFields.filter((f: any) => f.model_id === childModel.id)
    const childModelFieldIds = new Set(childModelFields.map((f: any) => f.id))
    const childView = allViews.find(
      (v: any) => (v.model_id === fromId || v.model_id === childModel.id) && v.logic_type !== 'personalizado'
    )

    // 1. Prioridade Máxima: Campos configurados diretamente no Use Case atual (layout_config da view pai no Studio)
    const configuredChildFieldIds = parentViewFormFieldsOrder.filter(fid => {
      if (childModelFieldIds.has(fid)) return true
      if (fid.startsWith('virt_') || fid.startsWith('byoc_')) {
        const meta = parentViewFieldsMetadata[fid] || {}
        return meta.virtual_model_id === childModel.id || meta.byoc_model_id === childModel.id
      }
      return false
    })

    let childGridFields: ResolvedField[] = []
    let childFormFields: ResolvedField[] = []

    if (configuredChildFieldIds.length > 0) {
      const formComponents = (view.ui_components || []).filter((c: any) => {
        const field = allFields.find((f: any) => f.id === c.field_id)
        return field && childModelFieldIds.has(field.id)
      })
      childFormFields = configuredChildFieldIds.map(fid => {
        if (fid.startsWith('virt_') || fid.startsWith('byoc_')) {
          return buildVirtualField(fid, 'form', parentViewFieldsMetadata, byocMap)
        }
        const field = allFields.find((f: any) => f.id === fid)
        const comp = formComponents.find((c: any) => c.field_id === fid) || { field_id: fid, config: {} }
        return buildResolvedField(comp, field, 'form', childModel.id, allModels, parentViewFieldsMetadata)
      })
      childGridFields = childFormFields.slice(0, 6)
    } else if (childView) {
      const resolved = resolveViewZones(childView, allModels, allFields, byocMap)
      childGridFields = resolved.gridFields
        .filter(f => {
          const colName = f.dbColumn.includes('.') ? f.dbColumn.split('.').pop()! : f.dbColumn
          return f.isVirtual || childModelFieldIds.size === 0 || childModelFields.some(mf => mf.db_column_name === colName)
        })
        .slice(0, 6)
      childFormFields = resolved.formFields
        .filter(f => {
          const colName = f.dbColumn.includes('.') ? f.dbColumn.split('.').pop()! : f.dbColumn
          return f.isVirtual || childModelFieldIds.size === 0 || childModelFields.some(mf => mf.db_column_name === colName)
        })
      if (childFormFields.length === 0) {
        childFormFields = childGridFields
      }
    } else {
      // Fallback: usa os campos do modelo filho
      childGridFields = childModelFields.slice(0, 5).map((f: any): ResolvedField => {
        const dt = (f.data_type || '').toLowerCase()
        const isDate = dt === 'date' || dt.includes('time') || f.db_column_name.includes('data')
        const isLookup = Boolean(f.foreign_key_table || f.is_foreign_key || f.db_column_name.endsWith('_id') || f.db_column_name.startsWith('id_') || f.config?.relation)
        const cols = isDate ? 3 : isLookup ? 9 : 6
        const width = isDate ? '25%' : isLookup ? '75%' : '50%'

        return {
          id: f.id,
          dbColumn: f.db_column_name,
          sqlExpression: f.db_column_name,
          label: f.display_name || f.db_column_name,
          dataType: f.data_type || 'varchar',
          isPrimaryKey: f.is_primary_key || false,
          isSortable: f.is_sortable || false,
          isVirtual: false,
          isByoc: false,
          config: { columns: cols, width, gridSpan: cols, modalGridSpan: cols, modalWidth: width },
        }
      })
      childFormFields = childGridFields
    }

    // Enriquece campos de FK/Lookup com a relação para a tabela destino respeitando as configs do Studio e dicionário do banco
    const enrichRelationFields = (fieldsList: ResolvedField[]) => {
      return fieldsList.map(f => {
        const configuredTarget = f.config?.component?.rel_table || f.config?.rel_table || f.config?.relation?.targetTable
        const configuredDisplay = f.config?.component?.rel_label || f.config?.rel_label || f.config?.relation?.displayColumn
        const configuredValue = f.config?.component?.rel_value || f.config?.rel_value || f.config?.relation?.valueColumn

        const colOnly = f.dbColumn.includes('.') ? f.dbColumn.split('.').pop()! : f.dbColumn
        const fkRel = rawRelations.find((r: any) =>
          r.from_model_id === childModel.id && (r.from_field_id === f.id || r.from_column === colOnly)
        )
        let targetModel = configuredTarget
          ? allModels.find((m: any) => m.db_table_name === configuredTarget)
          : (fkRel ? allModels.find((m: any) => m.id === fkRel.to_model_id) : null)

        if (targetModel) {
          const targetFields = allFields.filter((tf: any) => tf.model_id === targetModel.id)
          const pkCol = configuredValue || targetFields.find((tf: any) => tf.is_primary_key)?.db_column_name || targetFields[0]?.db_column_name || ''
          const dispCol = configuredDisplay || findDisplayColumn(targetFields) || pkCol

          return {
            ...f,
            config: {
              ...f.config,
              relation: {
                targetTable: targetModel.db_table_name,
                targetModel: toPascalCase(targetModel.db_table_name),
                displayColumn: dispCol,
                valueColumn: pkCol,
              }
            }
          }
        }
        return f
      })
    }

    const uniqueByDbCol = (list: ResolvedField[]) => {
      const seen = new Set<string>()
      return list.filter(f => {
        const colOnly = f.dbColumn.includes('.') ? f.dbColumn.split('.').pop()! : f.dbColumn
        const key = (colOnly || f.id).toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    }

    childGridFields = uniqueByDbCol(enrichRelationFields(childGridFields))
    childFormFields = uniqueByDbCol(enrichRelationFields(childFormFields))

    const tabLabel = layoutConfig.details_tab_titles?.[childModel.id] || childModel.display_name || childModelName

    // Identifica sub-detalhes (relações 1:N filhas deste modelo)
    // Apenas considera se houver campos do sub-modelo explicitamente configurados na tela pelo Studio
    const subRelations = rawRelations.filter((r: any) => {
      if (r.to_model_id !== childModel.id || r.from_model_id === view.model_id) return false
      const subModel = allModels.find((m: any) => m.id === r.from_model_id)
      if (!subModel) return false

      const subModelFields = allFields.filter((f: any) => f.model_id === subModel.id)
      const subModelFieldIds = new Set(subModelFields.map((f: any) => f.id))
      const hasConfiguredFields = parentViewFormFieldsOrder.some(fid => {
        if (subModelFieldIds.has(fid)) return true
        if (fid.startsWith('virt_') || fid.startsWith('byoc_')) {
          const meta = parentViewFieldsMetadata[fid] || {}
          return meta.virtual_model_id === subModel.id || meta.byoc_model_id === subModel.id
        }
        return false
      })
      return hasConfiguredFields
    })
    const subDetails: SubRelationDetail[] = subRelations.map((sr: any) => {
      const subModel = allModels.find((m: any) => m.id === sr.from_model_id)
      if (!subModel) return null
      const subFkField = allFields.find((f: any) => f.id === sr.from_field_id)
      const subFkCol = subFkField?.db_column_name || `${childModel.db_table_name}_id`
      const subModelName = toPascalCase(subModel.db_table_name)
      const subView = allViews.find(
        (v: any) => v.model_id === subModel.id && v.logic_type !== 'personalizado'
      )

      const subModelFields = allFields.filter((f: any) => f.model_id === subModel.id)
      const subModelFieldIds = new Set(subModelFields.map((f: any) => f.id))

      const configuredSubFieldIds = parentViewFormFieldsOrder.filter(fid => {
        if (subModelFieldIds.has(fid)) return true
        if (fid.startsWith('virt_') || fid.startsWith('byoc_')) {
          const meta = parentViewFieldsMetadata[fid] || {}
          return meta.virtual_model_id === subModel.id || meta.byoc_model_id === subModel.id
        }
        return false
      })

      let subGridFields: ResolvedField[] = []
      let subFormFields: ResolvedField[] = []

      if (configuredSubFieldIds.length > 0) {
        const subComponents = (view.ui_components || []).filter((c: any) => {
          const field = allFields.find((f: any) => f.id === c.field_id)
          return field && subModelFieldIds.has(field.id)
        })
        subFormFields = configuredSubFieldIds.map(fid => {
          if (fid.startsWith('virt_') || fid.startsWith('byoc_')) {
            return buildVirtualField(fid, 'form', parentViewFieldsMetadata, byocMap)
          }
          const field = allFields.find((f: any) => f.id === fid)
          const comp = subComponents.find((c: any) => c.field_id === fid) || { field_id: fid, config: {} }
          return buildResolvedField(comp, field, 'form', subModel.id, allModels, parentViewFieldsMetadata)
        })
        subGridFields = subFormFields
      } else if (subView) {
        const resolved = resolveViewZones(subView, allModels, allFields, byocMap)
        subGridFields = resolved.gridFields.filter(f => {
          const colName = f.dbColumn.includes('.') ? f.dbColumn.split('.').pop()! : f.dbColumn
          return f.isVirtual || subModelFieldIds.size === 0 || subModelFields.some(mf => mf.db_column_name === colName)
        })
        subFormFields = resolved.formFields.filter(f => {
          const colName = f.dbColumn.includes('.') ? f.dbColumn.split('.').pop()! : f.dbColumn
          return f.isVirtual || subModelFieldIds.size === 0 || subModelFields.some(mf => mf.db_column_name === colName)
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
          const label = f.display_name || f.db_column_name
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (c: string) => c.toUpperCase())
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
        subFormFields = subGridFields
      }

      const enrichSubFields = (fieldsList: ResolvedField[]) => {
        return fieldsList.map(f => {
          const configuredTarget = f.config?.component?.rel_table || f.config?.rel_table || f.config?.relation?.targetTable
          const configuredDisplay = f.config?.component?.rel_label || f.config?.rel_label || f.config?.relation?.displayColumn
          const configuredValue = f.config?.component?.rel_value || f.config?.rel_value || f.config?.relation?.valueColumn

          const colOnly = f.dbColumn.includes('.') ? f.dbColumn.split('.').pop()! : f.dbColumn
          const fkRel = rawRelations.find((r: any) =>
            r.from_model_id === subModel.id && (r.from_field_id === f.id || r.from_column === colOnly)
          )
          let targetModel = configuredTarget
            ? allModels.find((m: any) => m.db_table_name === configuredTarget)
            : (fkRel ? allModels.find((m: any) => m.id === fkRel.to_model_id) : null)

          if (targetModel) {
            const targetFields = allFields.filter((tf: any) => tf.model_id === targetModel.id)
            const pkCol = configuredValue || targetFields.find((tf: any) => tf.is_primary_key)?.db_column_name || targetFields[0]?.db_column_name || ''
            const dispCol = configuredDisplay || findDisplayColumn(targetFields) || pkCol

            return {
              ...f,
              config: {
                ...f.config,
                relation: {
                  targetTable: targetModel.db_table_name,
                  targetModel: toPascalCase(targetModel.db_table_name),
                  displayColumn: dispCol,
                  valueColumn: pkCol,
                }
              }
            }
          }
          return f
        })
      }

      subGridFields = uniqueByDbCol(enrichSubFields(subGridFields))
      subFormFields = uniqueByDbCol(enrichSubFields(subFormFields))

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
  rawComponents.forEach((c: any) => {
    const name = c.name || c.component_name || c.id
    const code = c.code || c.compiled_code || c.source_code || c.component_code
    if (name && code) {
      byocMap[name] = code
      byocMap[toPascalCase(name)] = code
    }
  })

  // Enumerations map para lookup de options de enums
  const rawEnums: any[] = rawJson.enumerations || rawJson.project_enumerations || []
  const enumsMap: Record<string, Array<{ label: string; value: string }>> = {}
  rawEnums.forEach((e: any) => {
    const formatted = (e.values || []).map((v: any) => {
      if (typeof v === 'string') return { label: v, value: v }
      return {
        label: v.description || v.label || v.value || '',
        value: v.value !== undefined ? String(v.value) : String(v.description || '')
      }
    })
    if (e.id) enumsMap[e.id] = formatted
    if (e.name) {
      enumsMap[e.name] = formatted
      enumsMap[e.name.toLowerCase()] = formatted
    }
  })

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

    const targetModelId = resolvedView.model_id || resolvedView.layout_config?.master_model_id || resolvedView.layout_config?.model_id
    if (!resolvedView.model_id && targetModelId) {
      resolvedView.model_id = targetModelId
    }
    const model = models.find((m) => m.id === targetModelId)
    if (!model) continue

    // Etapas 3, 4 e 5: resolve campos por zona
    const { gridFields: rawGridFields, formFields: rawFormFields, filterFields: rawFilterFields, primaryKey } = resolveViewZones(
      resolvedView,
      rawModels,
      rawFields,
      byocMap,
      enumsMap
    )

    // Enriquece campos relacionais nas 3 zonas usando catálogo dinâmico de relações
    const gridFields = enrichFieldsWithRelations(rawGridFields, model, rawRelations, rawModels, rawFields)
    const formFields = enrichFieldsWithRelations(rawFormFields, model, rawRelations, rawModels, rawFields)
    const filterFields = enrichFieldsWithRelations(rawFilterFields, model, rawRelations, rawModels, rawFields)

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

    // Configurações específicas de Kanban
    let kanbanGroupField: string | undefined = undefined
    const rawKanbanGroup = resolvedView.layout_config?.kanban_group_field
    if (rawKanbanGroup) {
      if (typeof rawKanbanGroup === 'string') {
        const foundField = rawFields.find((f: any) => f.id === rawKanbanGroup || f.db_column_name === rawKanbanGroup)
        kanbanGroupField = foundField ? foundField.db_column_name : rawKanbanGroup
      } else if (typeof rawKanbanGroup === 'object') {
        const targetId = rawKanbanGroup.target_field_id || (rawKanbanGroup.relation_path?.[0]?.foreign_column_id)
        const foundField = rawFields.find((f: any) => f.id === targetId)
        kanbanGroupField = foundField ? foundField.db_column_name : undefined
      }
    }
    if (!kanbanGroupField && resolvedView.logic_type === 'kanban') {
      const statusField = rawFields.find((f: any) => f.model_id === model.id && (f.db_column_name === 'status' || f.db_column_name.toLowerCase().includes('status')))
      kanbanGroupField = statusField ? statusField.db_column_name : 'status'
    }

    const kanbanGroupDisplayField = resolvedView.layout_config?.kanban_group_display_field || undefined

    const rawCardFields = resolvedView.layout_config?.kanban_card_fields || resolvedView.layout_config?.kanban_cards_fields
    let kanbanCardFields: string[] | undefined = undefined
    if (Array.isArray(rawCardFields) && rawCardFields.length > 0) {
      kanbanCardFields = rawCardFields.map((cf: any) => {
        if (typeof cf === 'string') {
          const f = rawFields.find((rf: any) => rf.id === cf || rf.db_column_name === cf)
          return f ? f.dbColumn || f.db_column_name : cf
        } else if (cf && typeof cf === 'object') {
          const f = rawFields.find((rf: any) => rf.id === cf.target_field_id || rf.id === cf.id)
          return f ? f.dbColumn || f.db_column_name : null
        }
        return null
      }).filter(Boolean)
    }

    let timelineConfig: TimelineConfig | undefined = undefined
    if (resolvedView.logic_type === 'timeline' && resolvedView.layout_config?.timeline_config) {
      const tc = resolvedView.layout_config.timeline_config
      const resolveColumnName = (fieldIdOrName?: string): string => {
        if (!fieldIdOrName) return ''
        const found = rawFields.find((f: any) => f.id === fieldIdOrName || f.db_column_name === fieldIdOrName || f.display_name === fieldIdOrName)
        if (!found) return fieldIdOrName

        // Se o campo pertence diretamente à tabela da view (ex: pedidos), usa sua própria coluna
        if (!found.model_id || found.model_id === model.id) {
          return found.db_column_name || found.dbColumn || fieldIdOrName
        }

        // Se pertence a uma tabela relacionada (ex: clientes, funcionarios),
        // busca qual campo FK no modelo atual aponta para essa tabela relacionada
        const foundTargetTable = (found.model_table || '').toLowerCase()
        const fkField = rawFields.find((f: any) =>
          f.model_id === model.id && (
            f.foreign_key_target_model === found.model_id ||
            f.config?.relation?.targetModel === found.model_id ||
            (foundTargetTable && f.config?.relation?.targetTable?.toLowerCase() === foundTargetTable) ||
            (foundTargetTable && f.config?.component?.rel_table?.toLowerCase() === foundTargetTable) ||
            (f.db_column_name && foundTargetTable && f.db_column_name.toLowerCase().startsWith(foundTargetTable))
          )
        )
        if (fkField) {
          return fkField.db_column_name || fkField.dbColumn
        }

        // Fallback por convenção de nome de FK (ex: tabela clientes -> cliente_id, funcionarios -> funcionario_id)
        const targetModel = models.find((m: any) => m.id === found.model_id)
        if (targetModel) {
          const table = targetModel.dbTable.toLowerCase()
          const singular = table.endsWith('s') ? table.slice(0, -1) : table
          const candidateFk = rawFields.find((f: any) =>
            f.model_id === model.id && (
              f.db_column_name === `${singular}_id` ||
              f.db_column_name === `${table}_id`
            )
          )
          if (candidateFk) {
            return candidateFk.db_column_name || candidateFk.dbColumn
          }
        }

        return found.db_column_name || found.dbColumn || fieldIdOrName
      }

      const dateField = resolveColumnName(tc.date_field)
      const titleField = resolveColumnName(tc.title_field)
      const descField = tc.desc_field ? resolveColumnName(tc.desc_field) : undefined
      const iconField = tc.icon_field ? resolveColumnName(tc.icon_field) : undefined

      timelineConfig = {
        dateField: dateField || 'created_at',
        titleField: titleField || 'id',
        descField: descField || undefined,
        iconField: iconField || undefined,
        layoutStyle: tc.layout_style || 'infographic',
        layoutDirection: tc.layout_direction || 'horizontal',
        layoutMode: tc.layout_mode || 'alternating',
        timelineOrderHorizontal: tc.timeline_order_horizontal || 'asc',
        timelineOrderVertical: tc.timeline_order_vertical || 'asc',
        animated: tc.animated !== false,
        cardScale: typeof tc.card_scale === 'number' ? tc.card_scale : 1.0,
      }
    }

    // ─────────────────────────────────────────────────
    // Configurações específicas de Scheduler / Agenda
    // ─────────────────────────────────────────────────
    let schedulerConfig: SchedulerConfig | undefined = undefined
    if (resolvedView.logic_type === 'scheduler' && resolvedView.layout_config?.scheduler_config) {
      const sc = resolvedView.layout_config.scheduler_config

      const resolveSchedulerColumn = (fieldIdOrName?: string): string => {
        if (!fieldIdOrName) return ''
        const found = rawFields.find(
          (f: any) => f.id === fieldIdOrName
                   || f.db_column_name === fieldIdOrName
                   || f.display_name === fieldIdOrName
        )
        if (!found) return fieldIdOrName
        if (!found.model_id || found.model_id === model.id) {
          return found.db_column_name || found.dbColumn || fieldIdOrName
        }
        const foundTargetTable = (found.model_table || '').toLowerCase()
        const fkField = rawFields.find((f: any) =>
          f.model_id === model.id && (
            f.foreign_key_target_model === found.model_id ||
            (foundTargetTable && f.config?.relation?.targetTable?.toLowerCase() === foundTargetTable) ||
            (foundTargetTable && f.config?.component?.rel_table?.toLowerCase() === foundTargetTable) ||
            (f.db_column_name && foundTargetTable && f.db_column_name.toLowerCase().startsWith(foundTargetTable))
          )
        )
        if (fkField) return fkField.db_column_name || fkField.dbColumn
        return found.db_column_name || found.dbColumn || fieldIdOrName
      }

      schedulerConfig = {
        titleField:     resolveSchedulerColumn(sc.title_field)      || 'id',
        startDateField: resolveSchedulerColumn(sc.start_date_field) || 'created_at',
        endDateField:   sc.end_date_field ? resolveSchedulerColumn(sc.end_date_field) : undefined,
        colorField:     sc.color_field    ? resolveSchedulerColumn(sc.color_field)    : undefined,
      }
    }

    // ─────────────────────────────────────────────────
    // Configurações específicas de Galeria / Vitrine
    // ─────────────────────────────────────────────────
    let galleryConfig: GalleryConfig | undefined = undefined
    if (resolvedView.logic_type === 'galeria') {
      const gc = resolvedView.layout_config?.gallery_config || {}

      const resolveGalleryColumn = (fieldIdOrName?: string): string => {
        if (!fieldIdOrName) return ''
        const found = rawFields.find(
          (f: any) => f.id === fieldIdOrName
                   || f.db_column_name === fieldIdOrName
                   || f.display_name === fieldIdOrName
                   || f.name === fieldIdOrName
        )
        if (!found) return fieldIdOrName
        if (!found.model_id || found.model_id === model.id) {
          return found.db_column_name || found.dbColumn || fieldIdOrName
        }
        const foundTargetTable = (found.model_table || '').toLowerCase()
        const fkField = rawFields.find((f: any) =>
          f.model_id === model.id && (
            f.foreign_key_target_model === found.model_id ||
            (foundTargetTable && f.config?.relation?.targetTable?.toLowerCase() === foundTargetTable) ||
            (foundTargetTable && f.config?.component?.rel_table?.toLowerCase() === foundTargetTable) ||
            (f.db_column_name && foundTargetTable && f.db_column_name.toLowerCase().startsWith(foundTargetTable))
          )
        )
        if (fkField) return fkField.db_column_name || fkField.dbColumn
        return found.db_column_name || found.dbColumn || fieldIdOrName
      }

      // Auto-detecção de campo de imagem se não configurado
      let autoImageField = gc.image_field ? resolveGalleryColumn(gc.image_field) : undefined
      if (!autoImageField) {
        const candidateImg = gridFields.find(f =>
          f.dataType === 'image' ||
          f.dataType === 'file' ||
          f.dbColumn.toLowerCase().includes('foto') ||
          f.dbColumn.toLowerCase().includes('imagem') ||
          f.dbColumn.toLowerCase().includes('image') ||
          f.dbColumn.toLowerCase().includes('avatar') ||
          f.dbColumn.toLowerCase().includes('capa') ||
          f.dbColumn.toLowerCase().includes('thumb') ||
          f.dbColumn.toLowerCase().includes('url')
        )
        if (candidateImg) autoImageField = candidateImg.dbColumn
      }

      // Auto-detecção de campo de título se não configurado
      let autoTitleField = gc.title_field ? resolveGalleryColumn(gc.title_field) : undefined
      if (!autoTitleField) {
        const candidateTitle = gridFields.find(f =>
          !f.isPrimaryKey &&
          (f.dbColumn.toLowerCase().includes('nome') ||
           f.dbColumn.toLowerCase().includes('name') ||
           f.dbColumn.toLowerCase().includes('titulo') ||
           f.dbColumn.toLowerCase().includes('title') ||
           f.dbColumn.toLowerCase().includes('descricao') ||
           f.dbColumn.toLowerCase().includes('description') ||
           f.dataType === 'string')
        )
        if (candidateTitle) autoTitleField = candidateTitle.dbColumn
        else autoTitleField = primaryKey
      }

      const rawCardFields: string[] = Array.isArray(gc.card_fields) ? gc.card_fields : []
      const resolvedCardFields = rawCardFields.map((cf: string) => {
        const found = rawFields.find((f: any) => f.id === cf || f.db_column_name === cf || f.name === cf)
        return found ? (found.db_column_name || cf) : cf
      }).filter(Boolean)

      galleryConfig = {
        imageField:       autoImageField,
        titleField:       autoTitleField,
        cardFields:       resolvedCardFields.length > 0 ? resolvedCardFields : undefined,
        cardFieldsLabels: gc.card_fields_labels || undefined,
        clickBehavior:    resolvedView.layout_config?.gallery_click_behavior || gc.gallery_click_behavior || 'fullscreen',
      }
    }

    // ─────────────────────────────────────────────────
    // Configurações específicas de Gantt / Cronograma
    // ─────────────────────────────────────────────────
    let ganttConfig: GanttConfig | undefined = undefined
    if (resolvedView.logic_type === 'gantt') {
      const gc = resolvedView.layout_config?.gantt_config || {}

      const resolveGanttColumn = (fieldIdOrName?: string): string => {
        if (!fieldIdOrName) return ''
        const found = rawFields.find(
          (f: any) => f.id === fieldIdOrName
                   || f.db_column_name === fieldIdOrName
                   || f.display_name === fieldIdOrName
                   || f.name === fieldIdOrName
        )
        if (!found) return fieldIdOrName
        if (!found.model_id || found.model_id === model.id) {
          return found.db_column_name || found.dbColumn || fieldIdOrName
        }
        const foundTargetTable = (found.model_table || '').toLowerCase()
        const fkField = rawFields.find((f: any) =>
          f.model_id === model.id && (
            f.foreign_key_target_model === found.model_id ||
            (foundTargetTable && f.config?.relation?.targetTable?.toLowerCase() === foundTargetTable) ||
            (foundTargetTable && f.config?.component?.rel_table?.toLowerCase() === foundTargetTable) ||
            (f.db_column_name && foundTargetTable && f.db_column_name.toLowerCase().startsWith(foundTargetTable))
          )
        )
        if (fkField) return fkField.db_column_name || fkField.dbColumn
        return found.db_column_name || found.dbColumn || fieldIdOrName
      }

      // Auto-detecção de campo de título se não configurado
      let autoTitleField = gc.title_field ? resolveGanttColumn(gc.title_field) : undefined
      if (!autoTitleField) {
        const candidateTitle = gridFields.find(f =>
          !f.isPrimaryKey &&
          (f.dbColumn.toLowerCase().includes('titulo') ||
           f.dbColumn.toLowerCase().includes('title') ||
           f.dbColumn.toLowerCase().includes('nome') ||
           f.dbColumn.toLowerCase().includes('name') ||
           f.dbColumn.toLowerCase().includes('descricao') ||
           f.dbColumn.toLowerCase().includes('description') ||
           f.dataType === 'string')
        )
        autoTitleField = candidateTitle ? candidateTitle.dbColumn : primaryKey
      }

      // Auto-detecção de data de início
      let autoStartDateField = gc.start_date_field ? resolveGanttColumn(gc.start_date_field) : undefined
      if (!autoStartDateField) {
        const candidateStart = gridFields.find(f =>
          f.dbColumn.toLowerCase().includes('inicio') ||
          f.dbColumn.toLowerCase().includes('start') ||
          f.dbColumn.toLowerCase().includes('abertura') ||
          f.dataType === 'date' ||
          f.dataType === 'timestamp'
        )
        autoStartDateField = candidateStart ? candidateStart.dbColumn : 'created_at'
      }

      // Auto-detecção de data de término
      let autoEndDateField = gc.end_date_field ? resolveGanttColumn(gc.end_date_field) : undefined
      if (!autoEndDateField) {
        const candidateEnd = gridFields.find(f =>
          f.dbColumn !== autoStartDateField &&
          (f.dbColumn.toLowerCase().includes('fim') ||
           f.dbColumn.toLowerCase().includes('end') ||
           f.dbColumn.toLowerCase().includes('termino') ||
           f.dbColumn.toLowerCase().includes('conclusao') ||
           f.dbColumn.toLowerCase().includes('limite') ||
           f.dataType === 'date' ||
           f.dataType === 'timestamp')
        )
        autoEndDateField = candidateEnd ? candidateEnd.dbColumn : autoStartDateField
      }

      // Auto-detecção de campo de progresso (opcional)
      let autoProgressField = gc.progress_field ? resolveGanttColumn(gc.progress_field) : undefined
      if (!autoProgressField) {
        const candidateProg = gridFields.find(f =>
          f.dbColumn.toLowerCase().includes('progresso') ||
          f.dbColumn.toLowerCase().includes('progress') ||
          f.dbColumn.toLowerCase().includes('porcentagem') ||
          f.dbColumn.toLowerCase().includes('percentual') ||
          f.dbColumn.toLowerCase().includes('percent')
        )
        if (candidateProg) autoProgressField = candidateProg.dbColumn
      }

      ganttConfig = {
        titleField:     autoTitleField,
        startDateField: autoStartDateField,
        endDateField:   autoEndDateField,
        progressField:  autoProgressField,
      }
    }

    // ─────────────────────────────────────────────────
    // Configurações específicas de Mapa / Visão Geoespacial
    // ─────────────────────────────────────────────────
    let mapConfig: MapConfig | undefined = undefined
    if (resolvedView.logic_type === 'map' || resolvedView.logic_type === 'mapa' || resolvedView.layout_config?.map_config) {
      const mc = resolvedView.layout_config?.map_config || {}

      const resolveMapColumn = (fieldIdOrName?: string): string => {
        if (!fieldIdOrName) return ''
        const found = rawFields.find(
          (f: any) => f.id === fieldIdOrName
                   || f.db_column_name === fieldIdOrName
                   || f.display_name === fieldIdOrName
                   || f.name === fieldIdOrName
        )
        if (!found) return fieldIdOrName
        if (!found.model_id || found.model_id === model.id) {
          return found.db_column_name || found.dbColumn || fieldIdOrName
        }
        const foundTargetTable = (found.model_table || '').toLowerCase()
        const fkField = rawFields.find((f: any) =>
          f.model_id === model.id && (
            f.foreign_key_target_model === found.model_id ||
            (foundTargetTable && f.config?.relation?.targetTable?.toLowerCase() === foundTargetTable) ||
            (foundTargetTable && f.config?.component?.rel_table?.toLowerCase() === foundTargetTable) ||
            (f.db_column_name && foundTargetTable && f.db_column_name.toLowerCase().startsWith(foundTargetTable))
          )
        )
        if (fkField) return fkField.db_column_name || fkField.dbColumn
        return found.db_column_name || found.dbColumn || fieldIdOrName
      }

      // Auto-detecção de Latitude
      let autoLatField = mc.lat_field ? resolveMapColumn(mc.lat_field) : undefined
      if (!autoLatField) {
        const candidateLat = gridFields.find(f => {
          const col = f.dbColumn.toLowerCase()
          return col === 'latitude' || col === 'lat' || col === 'lat_atual' || col.startsWith('lat_') || col.endsWith('_lat') || col.includes('latitude')
        })
        autoLatField = candidateLat ? candidateLat.dbColumn : 'latitude'
      }

      // Auto-detecção de Longitude
      let autoLngField = mc.lng_field ? resolveMapColumn(mc.lng_field) : undefined
      if (!autoLngField) {
        const candidateLng = gridFields.find(f => {
          const col = f.dbColumn.toLowerCase()
          return col === 'longitude' || col === 'lng' || col === 'lon' || col === 'long' || col === 'lng_atual' || col.startsWith('lng_') || col.endsWith('_lng') || col.includes('longitude')
        })
        autoLngField = candidateLng ? candidateLng.dbColumn : 'longitude'
      }

      // Auto-detecção de Título
      let autoTitleField = mc.title_field ? resolveMapColumn(mc.title_field) : undefined
      if (!autoTitleField) {
        const candidateTitle = gridFields.find(f =>
          !f.isPrimaryKey &&
          (f.dbColumn.toLowerCase().includes('nome') ||
           f.dbColumn.toLowerCase().includes('name') ||
           f.dbColumn.toLowerCase().includes('titulo') ||
           f.dbColumn.toLowerCase().includes('title') ||
           f.dbColumn.toLowerCase().includes('descricao') ||
           f.dbColumn.toLowerCase().includes('razao_social') ||
           f.dataType === 'string')
        )
        autoTitleField = candidateTitle ? candidateTitle.dbColumn : primaryKey
      }

      // Auto-detecção de Descrição (opcional)
      let autoDescField = mc.desc_field ? resolveMapColumn(mc.desc_field) : undefined
      if (!autoDescField) {
        const candidateDesc = gridFields.find(f =>
          f.dbColumn !== autoTitleField &&
          (f.dbColumn.toLowerCase().includes('endereco') ||
           f.dbColumn.toLowerCase().includes('address') ||
           f.dbColumn.toLowerCase().includes('cidade') ||
           f.dbColumn.toLowerCase().includes('city') ||
           f.dbColumn.toLowerCase().includes('bairro') ||
           f.dbColumn.toLowerCase().includes('rua') ||
           f.dbColumn.toLowerCase().includes('descricao') ||
           f.dbColumn.toLowerCase().includes('status'))
        )
        if (candidateDesc) autoDescField = candidateDesc.dbColumn
      }

      mapConfig = {
        latField:   autoLatField,
        lngField:   autoLngField,
        titleField: autoTitleField,
        descField:  autoDescField,
        zoom:       typeof mc.zoom === 'number' ? mc.zoom : 13,
      }
    }

    // ─────────────────────────────────────────────────
    // Configurações específicas de Blueprint / Fluxograma
    // ─────────────────────────────────────────────────
    let blueprintConfig: BlueprintConfig | undefined = undefined
    if (resolvedView.logic_type === 'blueprint' || resolvedView.layout_config?.blueprint_config) {
      const bc = resolvedView.layout_config?.blueprint_config || {}

      const resolveBlueprintColumn = (fieldIdOrName?: string): string => {
        if (!fieldIdOrName) return ''
        const found = rawFields.find(
          (f: any) => f.id === fieldIdOrName
                   || f.db_column_name === fieldIdOrName
                   || f.display_name === fieldIdOrName
                   || f.name === fieldIdOrName
        )
        if (!found) return fieldIdOrName
        if (!found.model_id || found.model_id === model.id) {
          return found.db_column_name || found.dbColumn || fieldIdOrName
        }
        const foundTargetTable = (found.model_table || '').toLowerCase()
        const fkField = rawFields.find((f: any) =>
          f.model_id === model.id && (
            f.foreign_key_target_model === found.model_id ||
            (foundTargetTable && f.config?.relation?.targetTable?.toLowerCase() === foundTargetTable) ||
            (foundTargetTable && f.config?.component?.rel_table?.toLowerCase() === foundTargetTable) ||
            (f.db_column_name && foundTargetTable && f.db_column_name.toLowerCase().startsWith(foundTargetTable))
          )
        )
        if (fkField) return fkField.db_column_name || fkField.dbColumn
        return found.db_column_name || found.dbColumn || fieldIdOrName
      }

      // Auto-detecção de Título
      let autoTitleField = bc.title_field ? resolveBlueprintColumn(bc.title_field) : undefined
      if (!autoTitleField) {
        const candidateTitle = gridFields.find(f =>
          !f.isPrimaryKey &&
          (f.dbColumn.toLowerCase().includes('nome') ||
           f.dbColumn.toLowerCase().includes('name') ||
           f.dbColumn.toLowerCase().includes('titulo') ||
           f.dbColumn.toLowerCase().includes('title') ||
           f.dbColumn.toLowerCase().includes('etapa') ||
           f.dbColumn.toLowerCase().includes('tarefa') ||
           f.dbColumn.toLowerCase().includes('descricao') ||
           f.dataType === 'string')
        )
        autoTitleField = candidateTitle ? candidateTitle.dbColumn : primaryKey
      }

      // Auto-detecção de Predecessor / Nó Pai
      let autoPredField = bc.predecessor_field ? resolveBlueprintColumn(bc.predecessor_field) : undefined
      if (!autoPredField) {
        const candidatePred = gridFields.find(f => {
          const col = f.dbColumn.toLowerCase()
          return col.includes('predecessor') ||
                 col.includes('parent') ||
                 col.includes('pai') ||
                 col.includes('anterior') ||
                 col.includes('depende') ||
                 col.includes('origem') ||
                 col === 'prev_id' ||
                 col === 'source_id'
        })
        autoPredField = candidatePred ? candidatePred.dbColumn : 'predecessor_id'
      }

      // Auto-detecção de Descrição
      let autoDescField = bc.desc_field ? resolveBlueprintColumn(bc.desc_field) : undefined
      if (!autoDescField) {
        const candidateDesc = gridFields.find(f =>
          f.dbColumn !== autoTitleField &&
          f.dbColumn !== autoPredField &&
          (f.dbColumn.toLowerCase().includes('descricao') ||
           f.dbColumn.toLowerCase().includes('description') ||
           f.dbColumn.toLowerCase().includes('detalhe') ||
           f.dbColumn.toLowerCase().includes('obs') ||
           f.dbColumn.toLowerCase().includes('resumo'))
        )
        if (candidateDesc) autoDescField = candidateDesc.dbColumn
      }

      // Auto-detecção de Status
      let autoStatusField = bc.status_field ? resolveBlueprintColumn(bc.status_field) : undefined
      if (!autoStatusField) {
        const candidateStatus = gridFields.find(f => {
          const col = f.dbColumn.toLowerCase()
          return col.includes('status') || col.includes('situacao') || col.includes('estado') || col.includes('fase')
        })
        if (candidateStatus) autoStatusField = candidateStatus.dbColumn
      }

      blueprintConfig = {
        titleField:       autoTitleField,
        predecessorField: autoPredField,
        descField:        autoDescField,
        statusField:      autoStatusField,
        scale:            typeof bc.scale === 'number' ? bc.scale : 1,
        direction:        bc.direction || 'TB',
        animatedEdges:    bc.animated_edges !== false,
      }
    }

    // ─────────────────────────────────────────────────
    // Configurações específicas de Mapa Mental / Níveis
    // ─────────────────────────────────────────────────
    let mindmapConfig: MindmapConfig | undefined = undefined
    if (resolvedView.logic_type === 'mapa_mental' || resolvedView.layout_config?.mindmap_levels?.length) {
      const ml = resolvedView.layout_config?.mindmap_levels || []
      const levels: MindmapLevel[] = []

      for (const lvl of ml) {
        const lvlModel = models.find((m: any) => m.id === lvl.model_id)
        const lvlFields = rawFields.filter((f: any) => f.model_id === lvl.model_id)

        const resolveLvlCol = (val?: string): string => {
          if (!val) return ''
          const found = lvlFields.find((f: any) => f.id === val || f.db_column_name === val || f.name === val)
          return found?.db_column_name || val
        }

        let titleField = resolveLvlCol(lvl.title_field)
        if (!titleField) {
          titleField = findDisplayColumn(lvlFields) || lvlFields.find((f: any) => f.is_primary_key)?.db_column_name || lvlFields[0]?.db_column_name || ''
        }

        let foreignKey = lvl.foreign_key ? resolveLvlCol(lvl.foreign_key) : undefined
        if (!foreignKey && levels.length > 0 && lvl.relation_type !== 'multilevel' && lvl.relation_type !== 'indirect') {
          const prevLevel = levels[levels.length - 1]
          const prevModel = models.find((m: any) => m.id === prevLevel.modelId)
          const prevTable = (prevModel?.dbTable || prevModel?.name || '').toLowerCase()
          const prevTableSingular = prevTable.endsWith('s') ? prevTable.slice(0, -1) : prevTable
          const candFk = lvlFields.find((f: any) => {
            const col = (f.db_column_name || '').toLowerCase()
            return col === `${prevTable}_id` || col === `${prevTableSingular}_id` || f.foreign_key_target_model === prevLevel.modelId
          })
          if (candFk) foreignKey = candFk.db_column_name
        }

        const lvlPascal = toPascalCase(lvlModel?.name || lvlModel?.dbTable || '')
        levels.push({
          modelId: lvl.model_id,
          modelTable: (lvlModel?.dbTable || lvlModel?.name || '').toLowerCase(),
          modelName: lvlPascal,
          titleField,
          descField: lvl.desc_field ? resolveLvlCol(lvl.desc_field) : undefined,
          relationType: lvl.relation_type || 'direct',
          foreignKey,
          throughTable: lvl.through_table,
          throughLocalFk: lvl.through_local_fk,
          throughTargetFk: lvl.through_target_fk,
          relationPath: lvl.relation_path,
        })
      }

      if (levels.length === 0 && relationTabs && relationTabs.length > 0) {
        levels.push({
          modelId: model.id,
          modelTable: model.dbTable.toLowerCase(),
          modelName: model.name,
          titleField: findDisplayColumn(gridFields),
          relationType: 'direct',
        })
        relationTabs.forEach(tab => {
          levels.push({
            modelTable: tab.relatedTable.toLowerCase(),
            modelName: tab.relatedModelName,
            titleField: findDisplayColumn(tab.gridFields || tab.formFields || []),
            foreignKey: tab.foreignKey,
            relationType: 'direct',
          })
        })
      }

      // Hierarchy fields para modo pivot / agrupamento por campos
      const hierarchyFields = gridFields
        .filter(f => !f.isPrimaryKey && !f.isVirtual && !f.isByoc)
        .map(f => f.dbColumn)

      mindmapConfig = {
        centralFieldId: resolvedView.layout_config?.central_field_id,
        levels: levels.length > 0 ? levels : undefined,
        hierarchyFields: hierarchyFields.length > 0 ? hierarchyFields : [primaryKey],
      }
    }

    let analyticsConfig: AnalyticsConfig | undefined = undefined
    if (
      (resolvedView.logic_type === 'analytics' || resolvedView.logic_type === 'dashboard_bi' || resolvedView.layout_config?.analytics_config) &&
      resolvedView.layout_config?.analytics_config
    ) {
      const ac = resolvedView.layout_config.analytics_config
      const resolveWidgetColumn = (val?: string): string => {
        if (!val) return ''
        if (val.includes('.') || val.includes('*') || val.includes('+') || val.includes('/') || val.includes('-') || val.includes(' ')) {
          return val
        }
        const found = rawFields.find((f: any) => f.id === val || f.db_column_name === val || f.name === val)
        if (found) {
          const colName = found.db_column_name || found.dbColumn || val
          if (found.model_id && found.model_id !== model.id) {
            const refModel = rawModels.find((m: any) => m.id === found.model_id)
            if (refModel) {
              return `${refModel.db_table_name}.${colName}`
            }
          }
          return colName
        }
        return val
      }

      analyticsConfig = {
        widgets: (ac.widgets || []).map((w: any) => ({
          id: w.id || `widget_${Math.random().toString(36).substr(2, 9)}`,
          title: w.title || 'Widget',
          type: w.type || 'bar',
          modelId: w.model_id || resolvedView.model_id || model.id,
          field: resolveWidgetColumn(w.field),
          calc: (w.calc || 'COUNT').toUpperCase(),
          groupBy: resolveWidgetColumn(w.group_by),
          width: w.width || 'third',
          dateGranularity: w.date_granularity || '',
          sortBy: w.sort_by || 'value_desc',
          limitTopN: w.limit_top_n ? Number(w.limit_top_n) : undefined,
          gaugeMin: w.gauge_min !== undefined ? Number(w.gauge_min) : undefined,
          gaugeMax: w.gauge_max !== undefined ? Number(w.gauge_max) : undefined,
          gaugeTarget: w.gauge_target !== undefined ? Number(w.gauge_target) : undefined,
          gaugeStart: w.gauge_start !== undefined ? Number(w.gauge_start) : undefined,
          gaugeEnd: w.gauge_end !== undefined ? Number(w.gauge_end) : undefined,
          useFormula: !!w.use_formula,
          formulaTokens: w.formula_tokens || [],
          color: w.color || 'indigo',
        })),
        allowRuntimeEdit: ac.allow_runtime_edit !== false,
        // Pushdown: campo de data para filtro no banco (ex: 'data_pedido', 'created_at')
        dateFilterField: ac.date_filter_field || undefined,
      }
    }

    // Auto-descobre todos os joins necessários usando o resolvedor BFS do Santo Graal
    const referencedTableNames = new Set<string>()
    if (analyticsConfig?.widgets) {
      analyticsConfig.widgets.forEach(w => {
        if (w.modelId && w.modelId !== model.id) {
          const m = rawModels.find((rm: any) => rm.id === w.modelId)
          if (m) referencedTableNames.add(m.db_table_name.toLowerCase())
        }
        if (typeof w.field === 'string') {
          const matches = w.field.match(/[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+/g)
          if (matches) {
            matches.forEach(m => referencedTableNames.add(m.split('.')[0].toLowerCase()))
          } else if (w.field.includes('.')) {
            referencedTableNames.add(w.field.split('.')[0].toLowerCase())
          }
        }
        if (typeof w.groupBy === 'string') {
          if (w.groupBy.includes('.')) {
            referencedTableNames.add(w.groupBy.split('.')[0].toLowerCase())
          } else {
            const fld = rawFields.find((rf: any) => rf.model_id === model.id && (rf.db_column_name === w.groupBy || rf.id === w.groupBy))
            if (fld) {
              const rel = rawRelations.find((r: any) => r.from_model_id === model.id && (r.from_field_id === fld.id || r.from_column === fld.db_column_name))
              if (rel) {
                const targetModel = rawModels.find((m: any) => m.id === rel.to_model_id)
                if (targetModel) referencedTableNames.add(targetModel.db_table_name.toLowerCase())
              }
            }
          }
        }
      })
    }
    const getFieldRelTable = (f: ResolvedField): string | null => {
      if (f.config?.component?.options_type === 'enumeration' || f.config?.options_type === 'enumeration') {
        return null
      }
      const raw = f.config?.relation?.targetTable || f.config?.component?.rel_table || f.config?.rel_table
      if (raw) {
        const m = rawModels.find((rm: any) => rm.id === raw || rm.db_table_name.toLowerCase() === raw.toLowerCase())
        if (m) return m.db_table_name.toLowerCase()
        if (!raw.includes('-') && raw.length < 50) return raw.toLowerCase()
        return null
      }
      if (f.dbColumn.endsWith('_id') && !f.isPrimaryKey) {
        const base = f.dbColumn.slice(0, -3)
        const tbl = base.endsWith('s') ? base : `${base}s`
        return tbl.toLowerCase()
      }
      return null
    }

    gridFields.forEach(f => {
      const relTable = getFieldRelTable(f)
      if (relTable) referencedTableNames.add(relTable)
    })
    filterFields.forEach(f => {
      const relTable = getFieldRelTable(f)
      if (relTable) referencedTableNames.add(relTable)
    })

    const resolvedProjectRelations = resolveRelations(rawRelations, rawModels)
    const masterTbl = model.dbTable.toLowerCase()
    referencedTableNames.delete(masterTbl)

    const autoJoinSteps = resolveAllJoins(
      resolvedProjectRelations,
      masterTbl,
      Array.from(referencedTableNames)
    )

    const existingJoins: Array<{ from: string; localKey?: string; to: string; foreignKey?: string }> =
      resolvedView.layout_config?.joins || []

    const combinedJoins = [...existingJoins]
    for (const step of autoJoinSteps) {
      const exists = combinedJoins.some(
        j => j.from.toLowerCase() === step.fromTable.toLowerCase() &&
             j.to.toLowerCase() === step.toTable.toLowerCase() &&
             j.localKey === step.fromField &&
             j.foreignKey === step.toField
      )
      if (!exists) {
        combinedJoins.push({
          from: step.fromTable,
          localKey: step.fromField,
          to: step.toTable,
          foreignKey: step.toField,
        })
      }
    }
    resolvedView.layout_config = {
      ...(resolvedView.layout_config || {}),
      joins: combinedJoins,
    }

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
      kanbanGroupField,
      kanbanGroupDisplayField,
      kanbanCardFields,
      timelineConfig,
      schedulerConfig,
      galleryConfig,
      ganttConfig,
      mapConfig,
      blueprintConfig,
      mindmapConfig,
      analyticsConfig,
      buttons,
      relationTabs,
      actionInterfaceType: resolvedView.layout_config?.action_interface_type || resolvedView.layout_config?.mindmap_levels?.[0]?.edit_usecase_open_mode || (resolvedView.logic_type === 'mapa_mental' ? 'modal' : 'page'),
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
