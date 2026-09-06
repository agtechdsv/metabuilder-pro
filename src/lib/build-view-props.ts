import { SupabaseClient } from '@supabase/supabase-js'

/**
 * build-view-props.ts
 *
 * Utilitário centralizado que constrói todos os props necessários para renderizar
 * um ViewContainer a partir de um slug de view e um projectId.
 *
 * Esta é a ÚNICA fonte da verdade para construção de props de views.
 * Usada por:
 *   1. page.tsx (renderização server-side normal)
 *   2. /api/runtime/slot-props (para abas do Personalizado)
 *
 * Isso garante paridade 100% entre a view original e sua versão em aba.
 */

export interface BuiltViewProps {
  viewId: string
  viewName: string
  modelName: string
  modelId: string
  logicType: string
  displayFields: any[]
  formFields: any[]
  filterFields: any[]
  primaryKeyName: string
  displayType: 'list' | 'card' | 'both'
  defaultView: 'list' | 'card'
  buttonsConfig: any[]
  canAdd: boolean
  canExport: boolean
  kanbanGroupField?: string
  kanbanGroupDisplayField?: string
  kanbanCardFields?: string[]
  schedulerConfig?: any
  timelineConfig?: any
  galleryConfig?: any
  galleryClickBehavior?: string
  mapConfig?: any
  ganttConfig?: any
  blueprintConfig?: any
  mindmapCentralField?: string
  mindmapLevels?: any[]
  joins: any[]
  dictionary: Record<string, string>
  tableDictionary: Record<string, string>
  customActions: any[]
  projectRelations: any[]
  exportFormats?: string[]
  filterGridColumns?: string
  initialItemsPerPage?: number
  detailsDisplayMode?: Record<string, string>
  detailsInterfaceTypes?: Record<string, string>
  detailsInlineTypes?: Record<string, string>
  detailsItemTitles?: Record<string, string>
  hiddenDetails?: string[]
  actionInterfaceType?: string
  masterModelId?: string
  customSlots?: any[]
  masterUseCaseSlug?: string
}

export async function buildViewProps(
  supabase: SupabaseClient,
  projectId: string,
  viewSlug: string
): Promise<BuiltViewProps | null> {

  const { data: views, error: viewError } = await supabase
    .from('ui_views')
    .select(`
      *,
      model:models (*, fields (*)),
      ui_components (
        label,
        order_index,
        is_visible,
        config,
        field:fields (*)
      )
    `)
    .eq('slug', viewSlug)
    .eq('project_id', projectId)
    .limit(1)

  if (viewError || !views || views.length === 0) return null

  const view = views[0]
  if (!view || view.layout_config?.is_active === false) return null

  const { data: allModels } = await supabase
    .from('models')
    .select('id, display_name, db_table_name, db_schema_name, fields(*)')
    .eq('project_id', projectId)

  const dictionary: Record<string, string> =
    allModels?.reduce((acc: any, m: any) => ({ ...acc, [m.id]: m.display_name }), {}) || {}
  const tableDictionary: Record<string, string> =
    allModels?.reduce((acc: any, m: any) => ({ ...acc, [m.id]: m.db_table_name }), {}) || {}

  const { data: byocData } = await supabase
    .from('ui_custom_components')
    .select('name, compiled_code')
    .eq('project_id', projectId)
  const byocMap: Record<string, string> =
    byocData?.reduce((acc: any, comp: any) => ({ ...acc, [comp.name]: comp.compiled_code }), {}) || {}

  const { data: rawProjectRelations } = await supabase
    .from('relations')
    .select('*')
    .eq('project_id', projectId)

  const projectRelations = (rawProjectRelations || []).map((r: any) => {
    const childModel = allModels?.find((m: any) => m.id === r.from_model_id)
    const fkField = childModel?.fields?.find((f: any) => f.id === r.from_field_id)
    return {
      ...r,
      master_model_id: r.to_model_id,
      detail_model_id: r.from_model_id,
      foreign_key: fkField?.db_column_name || ''
    }
  })

  const resolveSqlExpression = (field: any) => {
    const dbColName = field.db_column_name
    if (field.model_id && field.model_id !== view.model_id) {
      const joinedTable = allModels?.find((m: any) => m.id === field.model_id)?.db_table_name
      if (joinedTable) {
        return `${joinedTable}.${dbColName} AS "${joinedTable}.${dbColName}"`
      }
    }
    return dbColName
  }

  const resolveResultKey = (field: any) => {
    const dbColName = field.db_column_name
    if (field.model_id && field.model_id !== view.model_id) {
      const joinedTable = allModels?.find((m: any) => m.id === field.model_id)?.db_table_name
      if (joinedTable) {
        return `${joinedTable}.${dbColName}`
      }
    }
    return dbColName
  }

  const modelName = tableDictionary[view.model_id] || view.model?.db_table_name || ''
  const allComponents = view.ui_components || []
  const gridFieldsOrder: string[] = view.layout_config?.grid_fields || []
  const formFieldsOrder: string[] = view.layout_config?.form_fields || []
  const filterFieldsOrder: string[] = view.layout_config?.filter_fields || []

  const displayFields: any[] = allComponents
    .filter((c: any) =>
      c.is_visible !== false &&
      (c.config?.zones?.includes('grid') || !c.config?.zones) &&
      c.field?.is_visible_in_list !== false
    )
    .sort((a: any, b: any) => {
      const idxA = gridFieldsOrder.indexOf(a.field.id)
      const idxB = gridFieldsOrder.indexOf(b.field.id)
      if (idxA === -1 && idxB === -1) return a.order_index - b.order_index
      if (idxA === -1) return 1
      if (idxB === -1) return -1
      return idxA - idxB
    })
    .map((c: any) => ({
      id: c.field.id,
      model_id: c.field.model_id,
      model_name: tableDictionary[c.field.model_id],
      display_name: c.label || c.field.display_name || c.field.db_column_name,
      db_column_name: resolveResultKey(c.field),
      sql_expression: resolveSqlExpression(c.field),
      is_primary_key: c.field.is_primary_key,
      data_type: c.field.data_type,
      is_sortable: c.field.is_sortable,
      config: Object.keys(c.config || {}).length > 0
        ? { ...(c.field.config || {}), ...(c.config || {}) }
        : c.field.config
    }))

  gridFieldsOrder
    .filter((id: string) => id.startsWith('virt_') || id.startsWith('byoc_'))
    .forEach((id: string) => {
      const gridMeta = view.layout_config?.fields_metadata?.[`grid-${id}`] || {}
      const baseMeta = view.layout_config?.fields_metadata?.[id] || {}
      const meta = { ...baseMeta, ...gridMeta }
      const isByoc = id.startsWith('byoc_')
      const byocName = isByoc ? id.split('_').slice(2).join('_') : ''
      displayFields.push({
        id,
        model_id: null,
        model_name: '',
        display_name: meta.label?.text || (isByoc ? `[BYOC] ${byocName}` : 'Campo Calculado'),
        db_column_name: id,
        sql_expression: `NULL AS "${id}"`,
        is_primary_key: false,
        data_type: isByoc ? 'byoc' : 'virtual',
        is_sortable: false,
        config: isByoc ? { ...meta, compiled_code: byocMap[byocName] } : meta,
        is_virtual: !isByoc
      })
    })

  if (view.logic_type === 'galeria' && view.layout_config?.gallery_config?.card_fields) {
    const galleryFields = view.layout_config.gallery_config.card_fields as string[]
    galleryFields.forEach((gf: string) => {
      const alreadyExists = displayFields.some((df: any) => df.db_column_name === gf)
      if (!alreadyExists) {
        let foundField: any = null
        if (gf.includes('.')) {
          const [tName, cName] = gf.split('.')
          const joinedModel = allModels?.find((m: any) => m.db_table_name === tName)
          if (joinedModel) foundField = joinedModel.fields?.find((f: any) => f.db_column_name === cName)
        } else {
          const rootModel = allModels?.find((m: any) => m.id === view.model_id)
          if (rootModel) foundField = rootModel.fields?.find((f: any) => f.db_column_name === gf)
        }
        if (foundField) {
          displayFields.push({
            id: foundField.id,
            model_id: foundField.model_id,
            model_name: tableDictionary[foundField.model_id] || '',
            display_name: foundField.display_name || foundField.db_column_name,
            db_column_name: resolveResultKey({ ...foundField, model_id: foundField.model_id }),
            sql_expression: resolveSqlExpression({ ...foundField, model_id: foundField.model_id }),
            data_type: foundField.data_type,
            is_primary_key: foundField.is_primary_key,
            is_sortable: foundField.is_sortable,
            config: {},
            hidden: true
          })
        }
      }
    })
  }

  displayFields.sort((a: any, b: any) => {
    const idxA = gridFieldsOrder.indexOf(a.id)
    const idxB = gridFieldsOrder.indexOf(b.id)
    if (idxA === -1 && idxB === -1) return 0
    if (idxA === -1) return 1
    if (idxB === -1) return -1
    return idxA - idxB
  })

  // Fallback para UC do tipo 'personalizado' sem displayFields próprios:
  // A lista principal (ViewContainer) ficaria com linhas vazias sem isso.
  // Busca displayFields de um UC irmão do mesmo model com grid_fields configurados.
  if (view.logic_type === 'personalizado' && displayFields.length === 0) {
    const { data: siblings } = await supabase
      .from('ui_views')
      .select(`*, ui_components(label, order_index, is_visible, config, field:fields(*))`)
      .eq('project_id', projectId)
      .eq('model_id', view.model_id)
      .neq('logic_type', 'personalizado')
      .neq('id', view.id)

    const withGridFields = (siblings || []).filter((v: any) => (v.layout_config?.grid_fields?.length || 0) > 0)
    const siblingView = withGridFields.length > 0
      ? withGridFields.sort((a: any, b: any) => (b.layout_config?.grid_fields?.length || 0) - (a.layout_config?.grid_fields?.length || 0))[0]
      : (siblings || [])[0]

    if (siblingView) {
      const siblingGridOrder: string[] = siblingView.layout_config?.grid_fields || []
      const siblingComponents = siblingView.ui_components || []
      const siblingDisplayFields = siblingComponents
        .filter((c: any) => c.is_visible !== false && (c.config?.zones?.includes('grid') || !c.config?.zones) && c.field?.is_visible_in_list !== false)
        .sort((a: any, b: any) => {
          const idxA = siblingGridOrder.indexOf(a.field.id)
          const idxB = siblingGridOrder.indexOf(b.field.id)
          if (idxA === -1 && idxB === -1) return a.order_index - b.order_index
          if (idxA === -1) return 1
          if (idxB === -1) return -1
          return idxA - idxB
        })
        .map((c: any) => ({
          id: c.field.id,
          model_id: c.field.model_id,
          model_name: tableDictionary[c.field.model_id],
          display_name: c.label || c.field.display_name || c.field.db_column_name,
          db_column_name: resolveResultKey(c.field),
          sql_expression: resolveSqlExpression(c.field),
          is_primary_key: c.field.is_primary_key,
          data_type: c.field.data_type,
          is_sortable: c.field.is_sortable,
          config: Object.keys(c.config || {}).length > 0
            ? { ...(c.field.config || {}), ...(c.config || {}) }
            : c.field.config
        }))

      if (siblingDisplayFields.length > 0) {
        displayFields.push(...siblingDisplayFields)
        console.log(`[buildViewProps] Personalizado "${viewSlug}" sem displayFields — usando ${siblingDisplayFields.length} campos do UC "${siblingView.slug}" (${siblingView.logic_type})`)
      }
    }
  }

  const formFields: any[] = allComponents
    .filter((c: any) =>
      c.is_visible !== false &&
      c.config?.zones?.includes('form') &&
      c.field?.is_visible_in_form !== false
    )
    .sort((a: any, b: any) => {
      const idxA = formFieldsOrder.indexOf(a.field.id)
      const idxB = formFieldsOrder.indexOf(b.field.id)
      if (idxA === -1 && idxB === -1) return a.order_index - b.order_index
      if (idxA === -1) return 1
      if (idxB === -1) return -1
      return idxA - idxB
    })
    .map((c: any) => ({
      id: c.field.id,
      model_id: c.field.model_id,
      model_name: tableDictionary[c.field.model_id],
      display_name: c.label || c.field.display_name || c.field.db_column_name,
      db_column_name: resolveResultKey(c.field),
      sql_expression: resolveSqlExpression(c.field),
      data_type: c.field.data_type,
      is_primary_key: c.field.is_primary_key,
      config: Object.keys(c.config || {}).length > 0
        ? { ...(c.field.config || {}), ...(c.config || {}) }
        : c.field.config,
      zone: 3
    }))

  formFieldsOrder
    .filter((id: string) => id.startsWith('virt_') || id.startsWith('byoc_'))
    .forEach((id: string) => {
      const formMeta = view.layout_config?.fields_metadata?.[`form-${id}`] || {}
      const baseMeta = view.layout_config?.fields_metadata?.[id] || {}
      const meta = { ...baseMeta, ...formMeta }
      const virtualModelId = meta.virtual_model_id || null
      let virtualModelName = ''
      if (virtualModelId) {
        const foundModel = allModels?.find((m: any) => m.id === virtualModelId)
        if (foundModel) virtualModelName = foundModel.db_table_name
      }
      const isByoc = id.startsWith('byoc_')
      const byocName = isByoc ? id.split('_').slice(2).join('_') : ''
      formFields.push({
        id,
        model_id: virtualModelId,
        model_name: virtualModelName,
        display_name: meta.label?.text || (isByoc ? `[BYOC] ${byocName}` : 'Campo Calculado'),
        db_column_name: id,
        sql_expression: `NULL AS "${id}"`,
        data_type: isByoc ? 'byoc' : 'virtual',
        is_primary_key: false,
        config: isByoc ? { ...meta, compiled_code: byocMap[byocName] } : meta,
        zone: 3,
        is_virtual: !isByoc
      })
    })

  formFields.sort((a: any, b: any) => {
    const idxA = formFieldsOrder.indexOf(a.id)
    const idxB = formFieldsOrder.indexOf(b.id)
    if (idxA === -1 && idxB === -1) return 0
    if (idxA === -1) return 1
    if (idxB === -1) return -1
    return idxA - idxB
  })

  const filterFields: any[] = allComponents
    .filter((c: any) =>
      c.is_visible !== false &&
      c.config?.zones?.includes('filter') &&
      c.field?.is_searchable !== false
    )
    .sort((a: any, b: any) => {
      const idxA = filterFieldsOrder.indexOf(a.field.id)
      const idxB = filterFieldsOrder.indexOf(b.field.id)
      if (idxA === -1 && idxB === -1) return a.order_index - b.order_index
      if (idxA === -1) return 1
      if (idxB === -1) return -1
      return idxA - idxB
    })
    .map((c: any) => {
      const fId = c.field.id
      const fCol = c.field.db_column_name
      const baseMeta = view.layout_config?.fields_metadata?.[fId] || view.layout_config?.fields_metadata?.[fCol] || {}
      const specificMeta = view.layout_config?.fields_metadata?.[`filter-${fId}`] || view.layout_config?.fields_metadata?.[`filter-${fCol}`] || {}
      const rawCompConfig = Object.keys(c.config || {}).length > 0
        ? { ...(c.field.config || {}), ...(c.config || {}) }
        : (c.field.config || {})
      const mergedConfig = { ...rawCompConfig, ...baseMeta, ...specificMeta }
      if (baseMeta.component || specificMeta.component) {
        mergedConfig.component = {
          ...(rawCompConfig.component || {}),
          ...(baseMeta.component || {}),
          ...(specificMeta.component || {})
        }
      }
      return {
        id: c.field.id,
        model_id: c.field.model_id,
        model_name: tableDictionary[c.field.model_id],
        display_name: specificMeta.label?.text || baseMeta.label?.text || c.label || c.field.display_name || c.field.db_column_name,
        db_column_name: resolveResultKey(c.field),
        sql_expression: resolveSqlExpression(c.field),
        data_type: c.field.data_type,
        config: mergedConfig
      }
    })

  const primaryKeyField = allComponents.find((c: any) => c.field?.is_primary_key)?.field
  const primaryKeyName = primaryKeyField?.db_column_name || 'id'

  const ensureFieldInDisplay = async (fieldId: string) => {
    if (!fieldId || displayFields.find((f: any) => f.id === fieldId)) return
    let fieldData: any = allComponents.find((c: any) => c.field?.id === fieldId)?.field
    if (!fieldData && view.model?.fields) {
      fieldData = view.model.fields.find((f: any) => f.id === fieldId)
    }
    if (!fieldData) {
      for (const m of (allModels || [])) {
        const found = m.fields?.find((f: any) => f.id === fieldId)
        if (found) { fieldData = found; break }
      }
    }
    if (!fieldData) {
      const { data: remoteField } = await supabase
        .from('fields').select('*').eq('id', fieldId).single()
      if (remoteField) fieldData = remoteField
    }
    if (fieldData) {
      displayFields.push({
        id: fieldData.id,
        display_name: fieldData.display_name || fieldData.db_column_name,
        db_column_name: resolveResultKey(fieldData),
        sql_expression: resolveSqlExpression(fieldData),
        data_type: fieldData.data_type,
        config: {},
        hidden: true
      })
    }
  }

  if (view.logic_type === 'kanban' && view.layout_config?.kanban_group_field) {
    await ensureFieldInDisplay(view.layout_config.kanban_group_field)
  }
  if (view.logic_type === 'scheduler' && view.layout_config?.scheduler_config) {
    const sc = view.layout_config.scheduler_config
    for (const fId of [sc.title_field, sc.start_date_field, sc.end_date_field, sc.color_field].filter(Boolean)) {
      await ensureFieldInDisplay(fId)
    }
  }
  if (view.logic_type === 'timeline' && view.layout_config?.timeline_config) {
    const tl = view.layout_config.timeline_config
    for (const fId of [tl.date_field, tl.title_field, tl.desc_field, tl.icon_field].filter(Boolean)) {
      await ensureFieldInDisplay(fId)
    }
  }
  if (view.logic_type === 'map' && view.layout_config?.map_config) {
    const mc = view.layout_config.map_config
    for (const fId of [mc.lat_field, mc.lng_field, mc.title_field, mc.desc_field].filter(Boolean)) {
      await ensureFieldInDisplay(fId)
    }
  }
  if (view.logic_type === 'gantt' && view.layout_config?.gantt_config) {
    const gc = view.layout_config.gantt_config
    for (const fId of [gc.title_field, gc.start_date_field, gc.end_date_field, gc.progress_field].filter(Boolean)) {
      await ensureFieldInDisplay(fId)
    }
  }
  if (view.logic_type === 'blueprint' && view.layout_config?.blueprint_config) {
    const bc = view.layout_config.blueprint_config
    for (const fId of [bc.title_field, bc.desc_field, bc.status_field, bc.predecessor_field].filter(Boolean)) {
      await ensureFieldInDisplay(fId)
    }
  }

  const buttonsConfig = view.buttons_config || []
  const canAdd = buttonsConfig.find((b: any) => b.id === 'add')?.visible !== false
  const canExport = buttonsConfig.find((b: any) => b.id === 'export')?.visible !== false

  // Fallback para UC do tipo 'personalizado' sem formFields próprios:
  // Busca os formFields do UC filho definido em masterUseCaseSlug (se diferente do próprio slug)
  // OU procura qualquer outro UC do mesmo model com formFields configurados.
  // Isso ocorre quando o slot da 1ª aba aponta para o próprio personalizado (padrão Oracle)
  if (view.logic_type === 'personalizado' && formFields.length === 0) {
    const masterSlug = view.layout_config?.master_use_case_slug
    let masterView: any = null

    // Tenta primeiro o masterUseCaseSlug (se diferente do próprio slug para evitar loop)
    if (masterSlug && masterSlug !== viewSlug) {
      const { data: masterViews } = await supabase
        .from('ui_views')
        .select(`*, ui_components(label, order_index, is_visible, config, field:fields(*))`)
        .eq('slug', masterSlug)
        .eq('project_id', projectId)
        .limit(1)
      masterView = masterViews?.[0]
    }

    // Fallback: qualquer UC não-personalizado do mesmo model que tenha formFields
    if (!masterView || !masterView.layout_config?.form_fields?.length) {
      const { data: siblings } = await supabase
        .from('ui_views')
        .select(`*, ui_components(label, order_index, is_visible, config, field:fields(*))`)
        .eq('project_id', projectId)
        .eq('model_id', view.model_id)
        .neq('logic_type', 'personalizado')
        .neq('id', view.id)
      
      // Preferir o que tem mais form_fields configurados
      const withFormFields = (siblings || []).filter((v: any) => (v.layout_config?.form_fields?.length || 0) > 0)
      if (withFormFields.length > 0) {
        masterView = withFormFields.sort((a: any, b: any) => (b.layout_config?.form_fields?.length || 0) - (a.layout_config?.form_fields?.length || 0))[0]
      } else if ((siblings || []).length > 0) {
        // Último fallback: qualquer UC do mesmo model
        masterView = siblings![0]
      }
    }

    if (masterView) {
      const masterFormFieldsOrder: string[] = masterView.layout_config?.form_fields || []
      const masterComponents = masterView.ui_components || []
      const masterFormFields = masterComponents
        .filter((c: any) => c.is_visible !== false && c.config?.zones?.includes('form') && c.field?.is_visible_in_form !== false)
        .sort((a: any, b: any) => {
          const idxA = masterFormFieldsOrder.indexOf(a.field.id)
          const idxB = masterFormFieldsOrder.indexOf(b.field.id)
          if (idxA === -1 && idxB === -1) return a.order_index - b.order_index
          if (idxA === -1) return 1
          if (idxB === -1) return -1
          return idxA - idxB
        })
        .map((c: any) => ({
          id: c.field.id,
          model_id: c.field.model_id,
          model_name: tableDictionary[c.field.model_id],
          display_name: c.label || c.field.display_name || c.field.db_column_name,
          db_column_name: resolveResultKey(c.field),
          sql_expression: resolveSqlExpression(c.field),
          data_type: c.field.data_type,
          is_primary_key: c.field.is_primary_key,
          config: Object.keys(c.config || {}).length > 0
            ? { ...(c.field.config || {}), ...(c.config || {}) }
            : c.field.config,
          zone: 3
        }))
      
      if (masterFormFields.length > 0) {
        formFields.push(...masterFormFields)
        console.log(`[buildViewProps] Personalizado "${viewSlug}" sem formFields — usando ${masterFormFields.length} campos do UC "${masterView.slug}" (${masterView.logic_type})`)
      }
    }
  }

  return {
    viewId: view.id,
    viewName: view.name,
    modelName,
    modelId: view.model_id,
    logicType: view.logic_type,
    displayFields,
    formFields,
    filterFields,
    primaryKeyName,
    displayType: view.layout_config?.display_type || 'list',
    defaultView: view.layout_config?.default_view || 'list',
    buttonsConfig,
    canAdd,
    canExport,
    kanbanGroupField: view.layout_config?.kanban_group_field,
    kanbanGroupDisplayField: view.layout_config?.kanban_group_display_field,
    kanbanCardFields: view.layout_config?.kanban_card_fields || view.layout_config?.kanban_cards_fields,
    schedulerConfig: view.layout_config?.scheduler_config,
    timelineConfig: view.layout_config?.timeline_config,
    galleryConfig: view.layout_config?.gallery_config,
    galleryClickBehavior: view.layout_config?.gallery_click_behavior,
    mapConfig: view.layout_config?.map_config,
    ganttConfig: view.layout_config?.gantt_config,
    blueprintConfig: view.layout_config?.blueprint_config,
    mindmapCentralField: view.layout_config?.mindmap_central_field,
    mindmapLevels: view.layout_config?.mindmap_levels,
    joins: view.layout_config?.joins || [],
    dictionary,
    tableDictionary,
    customActions: view.layout_config?.custom_actions || [],
    projectRelations,
    exportFormats: view.layout_config?.export_formats,
    filterGridColumns: view.layout_config?.filter_grid_columns,
    initialItemsPerPage: view.layout_config?.items_per_page,
    detailsDisplayMode: view.layout_config?.details_display_mode,
    detailsInterfaceTypes: view.layout_config?.details_interface_types,
    detailsInlineTypes: view.layout_config?.details_inline_types,
    detailsItemTitles: view.layout_config?.details_item_titles,
    hiddenDetails: view.layout_config?.hidden_details,
    actionInterfaceType: view.layout_config?.action_interface_type || view.layout_config?.mindmap_levels?.[0]?.edit_usecase_open_mode || (view.logic_type === 'mapa_mental' ? 'modal' : undefined),
    masterModelId: view.layout_config?.master_model_id || view.model_id,
    customSlots: view.layout_config?.custom_slots,
    masterUseCaseSlug: view.layout_config?.master_use_case_slug,
  }
}
