'use client'

import { useEffect, useRef, useCallback } from 'react'
import { getFormattedFieldName } from '../utils'
import type { WizardConfig, Model } from '../types'

interface UseTelemetryDiffParams {
  config: WizardConfig
  models: Model[]
  currentStep: number
  isInitialized: boolean
  logAction: (category: string, detail: string) => void
  flush: (viewId?: string) => Promise<void>
}

interface TextChangeTracker {
  name?: string
  slug?: string
  custom_query?: string
  fields_metadata?: string | boolean
  master_tab_title?: boolean
  details_tab_titles?: boolean
}

/**
 * Watches the wizard config for changes and logs telemetry events.
 *
 * Uses a two-tier approach:
 * - **Immediate**: Structural changes (logic type, tables, layout options,
 *   buttons) are logged right away via `logAction`.
 * - **Debounced (1.5 s)**: Free-text inputs (name, slug, SQL query, field
 *   metadata properties) are batched to avoid flooding the log on every
 *   keystroke.
 *
 * Returns `flushTextChanges` so the caller can force-flush pending debounced
 * events before navigating to a new step or saving.
 */
export function useTelemetryDiff({
  config,
  models,
  currentStep,
  isInitialized,
  logAction,
  flush
}: UseTelemetryDiffParams) {
  const prevConfigRef = useRef<WizardConfig | null>(null)
  const textChangesRef = useRef<TextChangeTracker>({})
  const textTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const flushTextChanges = useCallback(() => {
    if (textTimeoutRef.current) {
      clearTimeout(textTimeoutRef.current)
      textTimeoutRef.current = null
    }
    const tc = textChangesRef.current
    if (tc.name)             logAction('CONFIG_CHANGE', `Renomeou o caso de uso para "${tc.name}"`)
    if (tc.slug)             logAction('CONFIG_CHANGE', `Alterou o slug para "${tc.slug}"`)
    if (tc.custom_query)     logAction('CONFIG_CHANGE', 'Editou a query SQL customizada')
    if (tc.fields_metadata)  logAction('CONFIG_CHANGE', typeof tc.fields_metadata === 'string' ? tc.fields_metadata : 'Alterou as propriedades de um campo (Etapa 3 (Campos & Layout))')
    if (tc.master_tab_title) logAction('CONFIG_CHANGE', 'Alterou o nome da aba Mestre (Etapa 3)')
    if (tc.details_tab_titles) logAction('CONFIG_CHANGE', 'Alterou os nomes das abas de Detalhe (Etapa 3)')
    textChangesRef.current = {}
  }, [logAction])

  useEffect(() => {
    if (!isInitialized) return

    const prev = prevConfigRef.current
    const curr = config

    if (!prev) {
      // First render after initialization: set baseline only, don't log
      prevConfigRef.current = curr
      return
    }

    const changes: string[] = []
    let hasDebouncedChange = false

    // ── Step 1: Logic (Selects & Toggles) ──────────────────────────────────
    if (prev.logic_type !== curr.logic_type && curr.logic_type)
      changes.push(`Alterou a lógica de "${prev.logic_type || 'nenhuma'}" para "${curr.logic_type}"`)
    if (prev.has_arguments !== curr.has_arguments)
      changes.push(curr.has_arguments ? 'Habilitou filtros de argumento (Pesquisa com Filtro)' : 'Desabilitou filtros de argumento')
    if (prev.query_type !== curr.query_type)
      changes.push(`Alterou tipo de query para "${curr.query_type}"`)

    // Debounce text inputs
    if (prev.name !== curr.name)         { textChangesRef.current.name = curr.name; hasDebouncedChange = true }
    if (prev.slug !== curr.slug)         { textChangesRef.current.slug = curr.slug; hasDebouncedChange = true }
    if (prev.custom_query !== curr.custom_query) { textChangesRef.current.custom_query = curr.custom_query; hasDebouncedChange = true }

    // Debounce field metadata changes
    const prevMeta = prev.layout_config.fields_metadata || {}
    const currMeta = curr.layout_config.fields_metadata || {}
    if (JSON.stringify(prevMeta) !== JSON.stringify(currMeta)) {
      const changedFid = Object.keys(currMeta).find(k => JSON.stringify(prevMeta[k]) !== JSON.stringify(currMeta[k]))
      if (changedFid) {
        let actualId = changedFid
        let zoneLabel = ''
        if (changedFid.startsWith('filter-')) { actualId = changedFid.replace('filter-', ''); zoneLabel = ' no Filtro' }
        else if (changedFid.startsWith('grid-')) { actualId = changedFid.replace('grid-', ''); zoneLabel = ' no Grid' }
        else if (changedFid.startsWith('form-')) { actualId = changedFid.replace('form-', ''); zoneLabel = ' no Formulário' }
        textChangesRef.current.fields_metadata = `Alterou as propriedades do campo "${getFormattedFieldName(actualId, models)}"${zoneLabel} (Etapa 3)`
      } else {
        textChangesRef.current.fields_metadata = 'Alterou as propriedades de um campo (Etapa 3)'
      }
      hasDebouncedChange = true
    }

    if (prev.layout_config.master_tab_title !== curr.layout_config.master_tab_title) {
      textChangesRef.current.master_tab_title = true; hasDebouncedChange = true
    }
    if (JSON.stringify(prev.layout_config.details_tab_titles) !== JSON.stringify(curr.layout_config.details_tab_titles)) {
      textChangesRef.current.details_tab_titles = true; hasDebouncedChange = true
    }

    if (hasDebouncedChange) {
      if (textTimeoutRef.current) clearTimeout(textTimeoutRef.current)
      textTimeoutRef.current = setTimeout(() => {
        flushTextChanges()
      }, 1500)
    }

    // ── Step 2: Tables ──────────────────────────────────────────────────────
    if (currentStep >= 2) {
      const addedModels  = curr.selected_models.filter(id => !prev.selected_models.includes(id))
      const removedModels = prev.selected_models.filter(id => !curr.selected_models.includes(id))
      if (addedModels.length > 0) {
        const names = addedModels.map(id => models.find(m => m.id === id)?.display_name || id).join(', ')
        changes.push(`Adicionou tabela(s): ${names}`)
      }
      if (removedModels.length > 0) {
        const names = removedModels.map(id => models.find(m => m.id === id)?.display_name || id).join(', ')
        changes.push(`Removeu tabela(s): ${names}`)
      }
    }

    // ── Step 3: Layout fields ───────────────────────────────────────────────
    if (currentStep >= 3) {
      const step3Label = '(Etapa 3 (Campos & Layout))'
      const zones: Array<{ key: 'filter_fields' | 'grid_fields' | 'form_fields'; label: string }> = [
        { key: 'filter_fields', label: 'Filtro' },
        { key: 'grid_fields',   label: 'Grid/Listagem' },
        { key: 'form_fields',   label: 'Formulário' }
      ]
      zones.forEach(({ key, label }) => {
        const prevF = prev.layout_config[key] || []
        const currF = curr.layout_config[key] || []
        const added   = currF.filter(f => !prevF.includes(f))
        const removed = prevF.filter(f => !currF.includes(f))
        const reordered = added.length === 0 && removed.length === 0 && JSON.stringify(prevF) !== JSON.stringify(currF)
        if (added.length   > 0) changes.push(`Adicionou ao ${label}: ${added.map(f => getFormattedFieldName(f, models)).join(', ')}`)
        if (removed.length > 0) changes.push(`Removeu do ${label}: ${removed.map(f => getFormattedFieldName(f, models)).join(', ')}`)
        if (reordered)           changes.push(`Reordenou campos no ${label}`)
      })

      // Joins
      const prevJoins = prev.layout_config.joins || []
      const currJoins = curr.layout_config.joins || []
      if (currJoins.length > prevJoins.length) {
        const newJoins = currJoins.filter(j => !prevJoins.some(pj => pj.id === j.id))
        newJoins.forEach(j => {
          const src = models.find(m => m.id === j.source_model_id)?.display_name || 'Tabela A'
          const tgt = models.find(m => m.id === j.target_model_id)?.display_name || 'Tabela B'
          changes.push(`Adicionou relacionamento (JOIN) entre ${src} e ${tgt}`)
        })
      } else if (currJoins.length < prevJoins.length) {
        changes.push(`Removeu ${prevJoins.length - currJoins.length} relacionamento(s) (JOIN) do layout`)
      }

      // Display / grouping / default_view
      if (prev.layout_config.display_type !== curr.layout_config.display_type)
        changes.push(`Alterou visualização padrão para "${curr.layout_config.display_type}"`)
      if (prev.layout_config.grouping_type !== curr.layout_config.grouping_type)
        changes.push(`Alterou agrupamento do formulário para "${curr.layout_config.grouping_type}"`)
      if (prev.layout_config.default_view !== curr.layout_config.default_view)
        changes.push(`Alterou modo de visualização padrão para "${curr.layout_config.default_view}"`)
      if (prev.layout_config.action_interface_type !== curr.layout_config.action_interface_type)
        changes.push(`Alterou interface de ação de "${prev.layout_config.action_interface_type}" para "${curr.layout_config.action_interface_type}"`)
      if (prev.layout_config.kanban_group_field !== curr.layout_config.kanban_group_field && curr.layout_config.kanban_group_field)
        changes.push(`Definiu campo de agrupamento do Kanban: "${curr.layout_config.kanban_group_field}"`)
      if (prev.layout_config.master_model_id !== curr.layout_config.master_model_id)
        changes.push('Alterou tabela Mestre do Master-Detail')
      if (prev.layout_config.mindmap_central_field !== curr.layout_config.mindmap_central_field)
        changes.push('Alterou campo central do Mapa Mental')

      // Specialized layout configs
      const specialConfigs: Array<{ key: keyof typeof curr.layout_config; label: string; fields: string[] }> = [
        { key: 'timeline_config',  label: 'Linha do Tempo',  fields: ['date_field', 'title_field', 'desc_field', 'icon_field'] },
        { key: 'map_config',       label: 'Mapa',            fields: ['lat_field', 'lng_field', 'title_field', 'desc_field'] },
        { key: 'gantt_config',     label: 'Gantt',           fields: ['title_field', 'start_date_field', 'end_date_field', 'progress_field', 'predecessor_field'] },
        { key: 'blueprint_config', label: 'Fluxograma',      fields: ['title_field', 'desc_field', 'status_field', 'predecessor_field'] },
        { key: 'scheduler_config', label: 'Agenda',          fields: ['title_field', 'start_date_field', 'end_date_field', 'color_field'] }
      ]
      const fieldLabels: Record<string, string> = {
        date_field: 'Data', title_field: 'Título', desc_field: 'Descrição',
        icon_field: 'Ícone', lat_field: 'Latitude', lng_field: 'Longitude',
        start_date_field: 'Data Início', end_date_field: 'Data Fim',
        progress_field: 'Progresso', predecessor_field: 'Predecessora',
        status_field: 'Status', color_field: 'Cor'
      }
      specialConfigs.forEach(({ key, label, fields }) => {
        const prevSpec = (prev.layout_config as any)[key] || {}
        const currSpec = (curr.layout_config as any)[key] || {}
        fields.forEach(field => {
          if (prevSpec[field] !== currSpec[field] && currSpec[field])
            changes.push(`Configurou campo "${fieldLabels[field] || field}" do ${label}: "${currSpec[field]}"`)
        })
      })

      // Analytics widgets
      const prevWidgets = prev.layout_config.analytics_config?.widgets || []
      const currWidgets = curr.layout_config.analytics_config?.widgets || []
      if (currWidgets.length > prevWidgets.length)
        changes.push(`Adicionou ${currWidgets.length - prevWidgets.length} widget(s) ao Dashboard BI`)
      if (currWidgets.length < prevWidgets.length)
        changes.push(`Removeu ${prevWidgets.length - currWidgets.length} widget(s) do Dashboard BI`)
      currWidgets.forEach(w => {
        const pw = prevWidgets.find(pw => pw.id === w.id)
        if (pw && JSON.stringify(pw) !== JSON.stringify(w))
          changes.push(`Editou widget BI "${w.title || w.type}" no Dashboard`)
      })
    }

    // ── Step 4: Buttons & Actions ───────────────────────────────────────────
    if (currentStep >= 4) {
      const step4Label = '(Etapa 4 (Ações & Query))'
      const prevButtons = prev.buttons_config || []
      const currButtons = curr.buttons_config || []
      currButtons.forEach(btn => {
        const prevBtn = prevButtons.find(b => b.id === btn.id)
        if (prevBtn && prevBtn.visible !== btn.visible)
          changes.push(`${btn.visible ? 'Habilitou' : 'Desabilitou'} o botão "${btn.label || btn.id}" ${step4Label}`)
        if (prevBtn && prevBtn.label !== btn.label && btn.label)
          changes.push(`Renomeou o botão "${prevBtn.label}" para "${btn.label}" ${step4Label}`)
      })

      const prevActions = prev.layout_config.custom_actions || []
      const currActions = curr.layout_config.custom_actions || []
      if (currActions.length > prevActions.length)
        changes.push(`Adicionou ${currActions.length - prevActions.length} ação(ões) customizada(s) ${step4Label}`)
      if (currActions.length < prevActions.length)
        changes.push(`Removeu ${prevActions.length - currActions.length} ação(ões) customizada(s) ${step4Label}`)
      currActions.forEach(a => {
        const prevA = prevActions.find(pa => pa.id === a.id)
        if (prevA && JSON.stringify(prevA) !== JSON.stringify(a))
          changes.push(`Editou a ação customizada "${a.label || a.id}" ${step4Label}`)
      })

      const prevFormats = prev.layout_config.export_formats || []
      const currFormats = curr.layout_config.export_formats || []
      const formatLabels: Record<string, string> = { xlsx: 'Excel (XLSX)', csv: 'CSV', json: 'JSON', pdf: 'PDF', ofx: 'OFX (Finance)' }
      currFormats.filter(f => !prevFormats.includes(f)).forEach(fmt => changes.push(`Habilitou o botão "${formatLabels[fmt] || fmt}" ${step4Label}`))
      prevFormats.filter(f => !currFormats.includes(f)).forEach(fmt => changes.push(`Desabilitou o botão "${formatLabels[fmt] || fmt}" ${step4Label}`))
    }

    // Send all immediate changes
    changes.forEach(detail => logAction('CONFIG_CHANGE', detail))
    prevConfigRef.current = curr
  }, [config, currentStep, isInitialized]) // eslint-disable-line react-hooks/exhaustive-deps

  return { flushTextChanges }
}
