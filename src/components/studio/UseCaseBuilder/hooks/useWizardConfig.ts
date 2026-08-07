'use client'

import { useState, useEffect, useMemo } from 'react'
import { useI18n } from '@/i18n/I18nContext'
import { buildDefaultButtonsConfig, mergeButtonsConfig } from '../utils'
import type { WizardConfig, UseCaseInitialData, Model, Relation } from '../types'

interface UseWizardConfigParams {
  initialData?: UseCaseInitialData
  models: Model[]
  relations: Relation[]
  currentStep: number
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface UseWizardConfigReturn {
  config: WizardConfig
  setConfig: React.Dispatch<React.SetStateAction<WizardConfig>>
  isInitialized: boolean
  orderedModels: Model[]
}

function buildInitialConfig(t: (key: string) => string): WizardConfig {
  return {
    name: '',
    slug: '',
    logic_type: '',
    has_arguments: true,
    selected_models: [],
    tables_config: [],
    query_type: 'dynamic',
    custom_query: '',
    layout_config: {
      filter_fields: [],
      grid_fields: [],
      form_fields: [],
      grouping_type: 'sections',
      display_type: 'list',
      default_view: 'list',
      kanban_group_field: '',
      master_model_id: '',
      detail_display_mode: 'tabs',
      mindmap_central_field: '',
      mindmap_levels: [],
      action_interface_type: 'page',
      joins: [],
      fields_metadata: {},
      analytics_config: { widgets: [], allow_runtime_edit: true },
      details_display_mode: {},
      details_interface_types: {},
      details_inline_types: {},
      details_modal_sizes: {},
      details_modal_widths: {},
      details_modal_heights: {},
      master_tab_title: '',
      details_tab_titles: {},
      details_item_titles: {},
      export_formats: ['xlsx', 'csv', 'json'],
      gallery_config: {},
      gallery_click_behavior: 'lightbox',
      items_per_page: 50,
      form_header_title: '',
      form_header_subtitle_field: '',
      scheduler_config: { title_field: '', start_date_field: '', end_date_field: '', color_field: '' },
      timeline_config: { date_field: '', title_field: '', desc_field: '', icon_field: '' },
      map_config: { lat_field: '', lng_field: '', title_field: '', desc_field: '' },
      blueprint_config: { title_field: '', desc_field: '', status_field: '', predecessor_field: '' },
      gantt_config: { title_field: '', start_date_field: '', end_date_field: '', progress_field: '', predecessor_field: '' },
      custom_actions: [],
      custom_slots: [],
      max_relation_depth: 2
    },
    buttons_config: buildDefaultButtonsConfig(t)
  }
}

/**
 * Manages the WizardConfig state:
 * - Initialises from `initialData` (edit mode) or from defaults (create mode)
 * - Applies automatic side-effects: button visibility suggestions, field
 *   cleanup on logic type change, analytics model auto-discovery, and
 *   auto-join suggestion when entering Step 3.
 */
export function useWizardConfig({
  initialData,
  models,
  relations,
  currentStep,
  toast
}: UseWizardConfigParams): UseWizardConfigReturn {
  const { t } = useI18n()
  const [config, setConfig] = useState<WizardConfig>(() => buildInitialConfig(t))
  const [isInitialized, setIsInitialized] = useState(false)

  // If creating a new use case, mark as initialized immediately
  useEffect(() => {
    if (!initialData) setIsInitialized(true)
  }, [initialData])

  // Populate config from initialData when editing
  useEffect(() => {
    if (initialData && !isInitialized) {
      const sourceData = (initialData.draft_config as any) || initialData
      const defaults = buildDefaultButtonsConfig(t)

      setConfig({
        name: sourceData.name || '',
        slug: sourceData.slug || '',
        logic_type: sourceData.logic_type || '',
        has_arguments: sourceData.has_arguments ?? true,
        selected_models: sourceData.tables_config || [],
        tables_config: sourceData.tables_config || [],
        query_type: sourceData.query_type || 'dynamic',
        custom_query: sourceData.custom_query || '',
        layout_config: {
          filter_fields: sourceData.layout_config?.filter_fields || [],
          grid_fields: sourceData.layout_config?.grid_fields || [],
          form_fields: sourceData.layout_config?.form_fields || [],
          grouping_type: sourceData.layout_config?.grouping_type || 'sections',
          display_type: sourceData.layout_config?.display_type || 'list',
          default_view: sourceData.layout_config?.default_view || 'list',
          kanban_group_field: sourceData.layout_config?.kanban_group_field || '',
          master_model_id: sourceData.layout_config?.master_model_id || '',
          detail_display_mode: sourceData.layout_config?.detail_display_mode || 'tabs',
          mindmap_central_field: sourceData.layout_config?.mindmap_central_field || '',
          mindmap_levels: sourceData.layout_config?.mindmap_levels || [],
          action_interface_type: sourceData.layout_config?.action_interface_type || 'page',
          joins: sourceData.layout_config?.joins || [],
          fields_metadata: sourceData.layout_config?.fields_metadata || {},
          analytics_config: sourceData.layout_config?.analytics_config || { widgets: [], allow_runtime_edit: true },
          details_display_mode: sourceData.layout_config?.details_display_mode || {},
          details_interface_types: sourceData.layout_config?.details_interface_types || {},
          details_inline_types: sourceData.layout_config?.details_inline_types || {},
          details_modal_sizes: sourceData.layout_config?.details_modal_sizes || {},
          details_modal_widths: sourceData.layout_config?.details_modal_widths || {},
          details_modal_heights: sourceData.layout_config?.details_modal_heights || {},
          master_tab_title: sourceData.layout_config?.master_tab_title || '',
          details_tab_titles: sourceData.layout_config?.details_tab_titles || {},
          details_item_titles: sourceData.layout_config?.details_item_titles || {},
          export_formats: sourceData.layout_config?.export_formats || ['xlsx', 'csv', 'json'],
          gallery_config: sourceData.layout_config?.gallery_config || {},
          gallery_click_behavior: sourceData.layout_config?.gallery_click_behavior || 'lightbox',
          items_per_page: sourceData.layout_config?.items_per_page || 50,
          form_header_title: sourceData.layout_config?.form_header_title || '',
          form_header_subtitle_field: sourceData.layout_config?.form_header_subtitle_field || '',
          scheduler_config: sourceData.layout_config?.scheduler_config || { title_field: '', start_date_field: '', end_date_field: '', color_field: '' },
          timeline_config: sourceData.layout_config?.timeline_config || { date_field: '', title_field: '', desc_field: '', icon_field: '' },
          map_config: sourceData.layout_config?.map_config || { lat_field: '', lng_field: '', title_field: '', desc_field: '' },
          gantt_config: sourceData.layout_config?.gantt_config || { title_field: '', start_date_field: '', end_date_field: '', progress_field: '', dependencies_field: '' },
          blueprint_config: sourceData.layout_config?.blueprint_config || { title_field: '', desc_field: '', status_field: '', predecessor_field: '' },
          custom_actions: sourceData.layout_config?.custom_actions || [],
          custom_slots: sourceData.layout_config?.custom_slots || [],
          max_relation_depth: sourceData.layout_config?.max_relation_depth ?? 2,
          master_use_case_slug: sourceData.layout_config?.master_use_case_slug || ''
        },
        buttons_config: mergeButtonsConfig(sourceData.buttons_config, defaults)
      })
      setIsInitialized(true)
    }
  }, [initialData, isInitialized]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-suggest button visibility based on selected logic type (create mode only)
  useEffect(() => {
    if (initialData) return
    if (currentStep >= 4) return

    const { logic_type, has_arguments } = config
    const isPesquisa = logic_type === 'pesquisa'
    const isCadastro = logic_type === 'cadastro'
    const isBoth = logic_type === 'pesquisa_cadastro'
    const isMasterDetail = logic_type === 'master_detail'

    let searchVis = false, viewVis = false, addVis = false, editVis = false, delVis = false

    if (isPesquisa) {
      searchVis = has_arguments
      viewVis = true
    } else if (isBoth || isMasterDetail) {
      searchVis = true; viewVis = true; addVis = true; editVis = true; delVis = true
    } else if (isCadastro) {
      addVis = true
    }

    setConfig(prev => ({
      ...prev,
      buttons_config: prev.buttons_config.map(btn => {
        if (btn.id === 'search') return { ...btn, visible: searchVis }
        if (btn.id === 'clear')  return { ...btn, visible: searchVis }
        if (btn.id === 'view')   return { ...btn, visible: viewVis }
        if (btn.id === 'add')    return { ...btn, visible: addVis }
        if (btn.id === 'edit')   return { ...btn, visible: editVis }
        if (btn.id === 'delete') return { ...btn, visible: delVis }
        return btn
      })
    }))
  }, [config.logic_type, config.has_arguments, currentStep, isInitialized, initialData]) // eslint-disable-line react-hooks/exhaustive-deps

  // Force disabled buttons according to model permissions
  useEffect(() => {
    const masterId = config.selected_models?.[0]
    if (!masterId) return
    const masterModel = models.find(m => m.id === masterId)
    if (!masterModel) return

    let changed = false
    const newButtonsConfig = config.buttons_config.map(b => {
      const shouldDisable =
        (b.id === 'add'    && masterModel.can_create === false) ||
        (b.id === 'edit'   && masterModel.can_update === false) ||
        (b.id === 'delete' && masterModel.can_delete === false)

      if (shouldDisable && b.visible) { changed = true; return { ...b, visible: false } }
      return b
    })

    if (changed) setConfig(prev => ({ ...prev, buttons_config: newButtonsConfig }))
  }, [config.selected_models, models]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-clear incompatible fields when logic type changes
  useEffect(() => {
    const isPesquisaOnly = config.logic_type === 'pesquisa'
    const isCadastroOnly = config.logic_type === 'cadastro'
    const noArgs = !config.has_arguments

    let updateNeeded = false
    const newLayout = { ...config.layout_config }

    if ((isCadastroOnly || noArgs) && newLayout.filter_fields.length > 0) {
      newLayout.filter_fields = []
      updateNeeded = true
    }
    if (isPesquisaOnly && newLayout.form_fields.length > 0) {
      newLayout.form_fields = []
      updateNeeded = true
    }
    if (updateNeeded) setConfig(prev => ({ ...prev, layout_config: newLayout }))
  }, [config.logic_type, config.has_arguments]) // eslint-disable-line react-hooks/exhaustive-deps

  // Analytics: auto-discover involved models from widgets + joins
  useEffect(() => {
    if (config.logic_type !== 'analytics') return

    const widgetModels = (config.layout_config.analytics_config?.widgets || []).map(w => w.model_id).filter(Boolean) as string[]
    const joinModels = (config.layout_config.joins || []).flatMap(j => {
      const fromModel = models.find(m => m.db_table_name === j.from)
      const toModel   = models.find(m => m.db_table_name === j.to)
      return [fromModel?.id, toModel?.id].filter(Boolean) as string[]
    })

    const masterModelId = config.layout_config?.master_model_id || config.selected_models?.[0]
    const allInvolved = Array.from(new Set([masterModelId, ...widgetModels, ...joinModels])).filter(Boolean) as string[]

    if (JSON.stringify([...allInvolved].sort()) !== JSON.stringify([...config.selected_models].sort())) {
      setConfig(prev => ({ ...prev, selected_models: allInvolved, tables_config: allInvolved }))
    }
  }, [config.layout_config.analytics_config?.widgets, config.layout_config.joins, config.logic_type, models, config.layout_config.master_model_id]) // eslint-disable-line react-hooks/exhaustive-deps

  // orderedModels: BFS from root model following the relations graph
  const orderedModels = useMemo((): Model[] => {
    if (config.logic_type === 'analytics') return models

    const rootId = config.layout_config.master_model_id || config.selected_models[0]
    const rootModel = models.find(m => m.id === rootId)
    if (!rootModel) return models.filter(m => config.selected_models.includes(m.id))

    // Build bidirectional adjacency map
    const adj: Record<string, string[]> = {}
    relations.forEach(r => {
      const a = r.from_model_id, b = r.to_model_id
      if (!a || !b) return
      if (!adj[a]) adj[a] = []
      if (!adj[b]) adj[b] = []
      if (!adj[a].includes(b)) adj[a].push(b)
      if (!adj[b].includes(a)) adj[b].push(a)
    })

    const maxDepth = config.layout_config?.max_relation_depth || 2
    const visited = new Set<string>([rootId])
    const queue: { id: string; depth: number }[] = [{ id: rootId, depth: 0 }]
    const result: Model[] = [rootModel]

    while (queue.length > 0) {
      const { id: current, depth } = queue.shift()!
      if (depth >= maxDepth) continue
      for (const neighbourId of adj[current] || []) {
        if (!visited.has(neighbourId)) {
          visited.add(neighbourId)
          queue.push({ id: neighbourId, depth: depth + 1 })
          const nbModel = models.find(m => m.id === neighbourId)
          if (nbModel) result.push(nbModel)
        }
      }
    }

    if (result.length <= 1 && config.selected_models.length > 1) {
      return models.filter(m => config.selected_models.includes(m.id))
    }
    return result
  }, [config.logic_type, config.layout_config.master_model_id, config.layout_config.max_relation_depth, config.selected_models, models, relations])

  // Auto-suggest joins on entering Step 3 (only if none configured yet)
  useEffect(() => {
    if (config.layout_config.joins.length > 0 || orderedModels.length <= 1) return
    if (currentStep !== 3) return

    const autoJoins: { from: string; localKey: string; to: string; foreignKey: string }[] = []
    const activeModelIds = orderedModels.map(m => m.id)

    if (relations.length > 0) {
      const relevantRelations = relations.filter(rel =>
        activeModelIds.includes(rel.foreign_table_id || '') &&
        activeModelIds.includes(rel.referenced_table_id || '')
      )
      relevantRelations.forEach(rel => {
        const fromModel = models.find(m => m.id === rel.foreign_table_id)
        const toModel   = models.find(m => m.id === rel.referenced_table_id)
        const fromField = fromModel?.fields.find(f => f.id === rel.foreign_column_id)
        const toField   = toModel?.fields.find(f => f.id === rel.referenced_column_id)

        if (fromModel && toModel && fromField && toField) {
          autoJoins.push({
            from: toModel.db_table_name,
            localKey: toField.db_column_name,
            to: fromModel.db_table_name,
            foreignKey: fromField.db_column_name
          })
        }
      })
    }

    // Heuristic fallback: look for FK columns by naming convention
    if (autoJoins.length === 0) {
      for (let i = 0; i < orderedModels.length; i++) {
        for (let j = 0; j < orderedModels.length; j++) {
          if (i === j) continue
          const modelA = orderedModels[i]
          const modelB = orderedModels[j]
          const parts = modelA.db_table_name.split('_')
          const expectedKeys = [
            `${modelA.db_table_name}_id`,
            `${modelA.db_table_name.replace(/s$/, '')}_id`,
            ...(parts.length > 1 ? [`${parts[0]}_id`, `${parts[0].replace(/s$/, '')}_id`] : [])
          ]
          const fkField = modelB.fields.find(f => expectedKeys.includes(f.db_column_name))
          const pkField = modelA.fields.find(f => f.db_column_name === 'id') || modelA.fields[0]
          if (fkField && pkField) {
            const alreadyExists = autoJoins.some(j =>
              (j.from === modelA.db_table_name && j.to === modelB.db_table_name) ||
              (j.from === modelB.db_table_name && j.to === modelA.db_table_name)
            )
            if (!alreadyExists) {
              autoJoins.push({ from: modelA.db_table_name, localKey: pkField.db_column_name, to: modelB.db_table_name, foreignKey: fkField.db_column_name })
            }
          }
        }
      }
    }

    if (autoJoins.length > 0) {
      setConfig(prev => ({ ...prev, layout_config: { ...prev.layout_config, joins: autoJoins } }))
      toast(`Sugerimos ${autoJoins.length} relacionamentos automaticamente!`, 'info')
    }
  }, [currentStep, relations, orderedModels]) // eslint-disable-line react-hooks/exhaustive-deps

  return { config, setConfig, isInitialized, orderedModels }
}
