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
  NavigationItem,
  AuthConfig,
  ButtonStyle,
  ButtonActionType,
} from './ast'

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
  baseFieldConfig: any
): ResolvedFieldConfig {
  const zoneMeta = fieldsMetadata[`${zone}-${fieldId}`] || {}
  const globalMeta = fieldsMetadata[fieldId] || {}
  const merged = { ...baseFieldConfig, ...globalMeta, ...zoneMeta }

  return {
    label: merged.label,
    width: merged.width,
    format: merged.format,
    options: merged.options,
    relation: merged.relation,
    readOnly: merged.readOnly || merged.read_only,
    required: merged.required || merged.is_required,
    placeholder: merged.placeholder,
    multiline: merged.multiline || merged.is_multiline,
    rows: merged.rows,
    ...merged, // pass-through de tudo não mapeado
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
  const { dbColumn, sqlExpression } = resolveFieldJoin(field, viewModelId, allModels)
  const config = applyFieldsMeta(field.id, zone, fieldsMetadata, field.config || {})
  const labelFromMeta = config.label?.text || config.label
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

  // Injeta campos virtuais/BYOC no form
  formFieldsOrder
    .filter((id: string) => id.startsWith('virt_') || id.startsWith('byoc_'))
    .forEach((id: string) => {
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
  return buttonsConfig.map((b: any, idx: number) => {
    const actionType = (b.action_type || b.type || 'custom') as ButtonActionType
    let placement = b.placement
    
    // Infer placement if missing or force standard placements to avoid duplicates
    if (['view', 'update', 'delete', 'edit'].includes(actionType)) {
      placement = 'row'
    } else if (['search', 'clear'].includes(actionType)) {
      placement = 'filter'
    } else if (['create', 'export'].includes(actionType)) {
      placement = 'header'
    } else if (!placement) {
      placement = 'header'
    }

    return {
      id: b.id || `btn_${idx}`,
      label: b.label || b.name || 'Ação',
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

  // Relações onde esta view é o "pai" (to_model_id = view.model_id)
  const parentRelations = rawRelations.filter(
    (r: any) => r.to_model_id === view.model_id
  )

  for (const rel of parentRelations) {
    const childModel = allModels.find((m: any) => m.id === rel.from_model_id)
    if (!childModel) continue

    const fkFieldRaw = allFields.find((f: any) => f.id === rel.from_field_id)
    const foreignKey = fkFieldRaw?.db_column_name || ''

    const childModelName = toPascalCase(childModel.db_table_name)

    // Tenta encontrar a view do modelo filho para usar seus gridFields
    const childView = allViews.find(
      (v: any) => v.model_id === rel.from_model_id && v.logic_type !== 'personalizado'
    )

    let childGridFields: ResolvedField[] = []
    if (childView) {
      const resolved = resolveViewZones(childView, allModels, allFields, byocMap)
      // Para aba de detalhe, usa os primeiros 5 campos do grid da view filha
      childGridFields = resolved.gridFields.slice(0, 5)
    } else {
      // Fallback: usa os primeiros 4 campos do modelo filho
      const childModelFields = allFields.filter((f: any) => f.model_id === rel.from_model_id)
      childGridFields = childModelFields.slice(0, 4).map((f: any): ResolvedField => ({
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
    }

    tabs.push({
      relatedModelId: rel.from_model_id,
      relatedTable: childModel.db_table_name,
      relatedModelName: childModelName,
      foreignKey,
      sourceKey: 'id',
      displayMode: rel.display_mode || 'tab',
      label: childModel.display_name || childModelName,
      gridFields: childGridFields,
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
  const navigation: NavigationItem[] = rawNav as NavigationItem[]

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

    // Buttons
    const buttons: ViewButton[] = parseButtons(resolvedView.buttons_config || [])

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
    const navIcon = findNavIcon(navigation, rv.slug)

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

  return {
    projectName: rawJson.project?.name || rawJson.name || 'MetabuilderExport',
    projectSlug: rawJson.project?.slug || rawJson.slug || 'app',
    projectIcon: rawJson.project?.icon,
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

function findNavIcon(navigation: NavigationItem[], slug: string): string | undefined {
  for (const item of navigation) {
    if (item.type === 'view' && (item.target === slug || item.target === `/${slug}`)) {
      return item.icon
    }
    if (item.type === 'folder' && item.children) {
      const found = findNavIcon(item.children, slug)
      if (found) return found
    }
  }
  return undefined
}
