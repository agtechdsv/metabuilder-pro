'use client'
// Refined UseCaseBuilderWizard - Metadata Driven Actions Order

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  ArrowLeft,
  Save,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  Settings2,
  Database,
  Layout,
  MousePointer2,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  Pencil,
  RefreshCcw,
  Table,
  GripVertical,
  SlidersHorizontal,
  ArrowRightLeft,
  ArrowRight,
  Type,
  Palette,
  Maximize2,
  Lock,
  Type as FontIcon,
  Share2,
  Columns,
  Settings,
  LayoutGrid,
  Wand2,
  Terminal,
  RotateCcw,
  Link,
  Layers,
  Activity,
  History,
  Gauge,
  BarChart3,
  BarChartHorizontal,
  Calendar,
  Download,
  Zap,
  Globe,
  Copy,
  FileText,
  FileSpreadsheet,
  Workflow
} from 'lucide-react'
import { useParams } from 'next/navigation'
import { useI18n } from '@/i18n/I18nContext'
import { createClient } from '@/utils/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { JoinsEditor } from './JoinsEditor'
import { cn } from '@/lib/utils'
import { Drawer } from '@/components/ui/Drawer'
import { Modal } from '@/components/ui/Modal'
import { IconPicker } from './IconPicker'
import { DynamicIcon } from '@/components/runtime/DynamicIcon'
import { BIWidgetEditor as BIWidgetConfigEditor } from '@/components/shared/BIWidgetEditor'
import {
  DndContext,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  useDraggable,
  useDroppable,
  DragOverlay
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion, useDragControls } from 'framer-motion'
import { useTelemetry } from '@/hooks/useTelemetry'

interface UseCaseBuilderWizardProps {
  initialData?: any
  onClose: () => void
  onSaveSuccess: () => void
  canCreate?: boolean
}

export function UseCaseBuilderWizard({ initialData, onClose, onSaveSuccess, canCreate = true }: UseCaseBuilderWizardProps) {
  const { t } = useI18n()
  const params = useParams()
  const { workspace_slug, project_slug } = params
  const supabase = createClient()
  const { toast } = useToast()
  
  const [currentProjectId, setCurrentProjectId] = useState<string>()
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string>()



  // Telemetria (Heartbeat de Produtividade)
  const { logAction, flush } = useTelemetry({
    workspaceId: currentWorkspaceId,
    projectId: currentProjectId,
    uiViewId: initialData?.id,
    uiViewName: initialData?.name || 'Novo Caso de Uso'
  })

  // Estados do Wizard
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [currentStatus, setCurrentStatus] = useState<string>(initialData?.status || 'draft')
  const [models, setModels] = useState<any[]>([])
  const [enumerations, setEnumerations] = useState<any[]>([])
  const [relations, setRelations] = useState<any[]>([])
  const [useCases, setUseCases] = useState<any[]>([])
  const [bpmWorkflows, setBpmWorkflows] = useState<any[]>([])
  const [isDownloadsActive, setIsDownloadsActive] = useState(false)

  const handleUpdateStatus = async (newStatus: 'delivered' | 'reopened') => {
    if (!initialData?.id) return
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('ui_views')
        .update({ status: newStatus })
        .eq('id', initialData.id)
      
      if (error) throw error
      setCurrentStatus(newStatus)
      flushTextChanges()
      logAction('LIFECYCLE', newStatus === 'delivered' ? 'Entregou o Caso de Uso' : 'Reabriu o Caso de Uso')
      toast(`Caso de Uso ${newStatus === 'delivered' ? 'entregue' : 'reaberto'} com sucesso!`, 'success')
      onSaveSuccess()
    } catch (err: any) {
      toast("Erro ao atualizar status: " + err.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  // Ref e Timeout para debounce dos campos de texto (name, slug, custom_query) e propriedades do Drawer (fields_metadata)
  const textChangesRef = useRef<{name?: string, slug?: string, custom_query?: string, fields_metadata?: string | boolean, master_tab_title?: boolean, details_tab_titles?: boolean}>({})
  const textTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const flushTextChanges = useCallback(() => {
    if (textTimeoutRef.current) {
      clearTimeout(textTimeoutRef.current)
      textTimeoutRef.current = null
    }
    if (textChangesRef.current.name) logAction('CONFIG_CHANGE', `Renomeou o caso de uso para "${textChangesRef.current.name}"`)
    if (textChangesRef.current.slug) logAction('CONFIG_CHANGE', `Alterou o slug para "${textChangesRef.current.slug}"`)
    if (textChangesRef.current.custom_query) logAction('CONFIG_CHANGE', 'Editou a query SQL customizada')
    if (textChangesRef.current.fields_metadata) logAction('CONFIG_CHANGE', 'Alterou as propriedades de um campo (Etapa 3 (Campos & Layout))')
    if (textChangesRef.current.master_tab_title) logAction('CONFIG_CHANGE', 'Alterou o nome da aba Mestre (Etapa 3)')
    if (textChangesRef.current.details_tab_titles) logAction('CONFIG_CHANGE', 'Alterou os nomes das abas de Detalhe (Etapa 3)')
    textChangesRef.current = {}
  }, [logAction])

  // Configuração da View sendo criada
  const [config, setConfig] = useState({
    name: '',
    slug: '',
    logic_type: '',
    has_arguments: true,
    selected_models: [] as string[],
    tables_config: [] as any[],
    query_type: 'dynamic',
    custom_query: '',
    layout_config: {
      filter_fields: [] as string[],
      grid_fields: [] as string[],
      form_fields: [] as string[],
      grouping_type: 'sections',
      display_type: 'list',
      default_view: 'list',
      kanban_group_field: '',
      master_model_id: '',
      detail_display_mode: 'tabs',
      mindmap_central_field: '',
      action_interface_type: 'drawer',
      joins: [] as any[],
      fields_metadata: {} as Record<string, any>,
      analytics_config: {
        widgets: [] as any[],
        allow_runtime_edit: true
      },
      details_interface_types: {} as Record<string, 'modal' | 'drawer'>,
      details_inline_types: {} as Record<string, boolean>,
      master_tab_title: '',
      details_tab_titles: {} as Record<string, string>,
      export_formats: ['xlsx', 'csv', 'json'],
      gallery_click_behavior: 'lightbox',
      scheduler_config: {
        title_field: '',
        start_date_field: '',
        end_date_field: '',
        color_field: ''
      },
      timeline_config: {
        date_field: '',
        title_field: '',
        desc_field: '',
        icon_field: ''
      },
      map_config: {
        lat_field: '',
        lng_field: '',
        title_field: '',
        desc_field: ''
      },
      blueprint_config: {
        title_field: '',
        desc_field: '',
        status_field: '',
        predecessor_field: ''
      },
      gantt_config: {
        title_field: '',
        start_date_field: '',
        end_date_field: '',
        progress_field: '',
        predecessor_field: ''
      },
      custom_actions: [] as any[]
    },
    buttons_config: [
      { id: 'search', label: t('runtime.search'), labelKey: 'runtime.search', icon: 'search', action: 'search', visible: true },
      { id: 'clear', label: t('runtime.clear'), labelKey: 'runtime.clear', icon: 'refresh-ccw', action: 'clear', visible: true },
      { id: 'view', label: t('runtime.view'), labelKey: 'runtime.view', icon: 'search', action: 'view', visible: true },
      { id: 'add', label: t('runtime.new_record'), labelKey: 'runtime.new_record', icon: 'plus', action: 'create', visible: true },
      { id: 'edit', label: t('runtime.edit'), labelKey: 'runtime.edit', icon: 'pencil', action: 'pencil', action_key: 'update', visible: true },
      { id: 'delete', label: t('runtime.delete'), labelKey: 'runtime.delete', icon: 'trash', action_key: 'delete', visible: true },
      { id: 'export', label: 'Exportar Dados', labelKey: 'runtime.export', icon: 'download', action: 'export', visible: true }
    ]
  })

  // Telemetria Automática (Hook de Mudança de Estado)
  useEffect(() => {
    if (currentStep && currentStep > 1) {
      flushTextChanges()
      logAction('NAVIGATION', `Avançou para Etapa ${currentStep}`)
    }
  }, [currentStep, logAction, flushTextChanges])

  const isButtonDisabledByModel = (btnId: string) => {
    const masterId = config.selected_models?.[0]
    if (!masterId) return false
    const masterModel = models.find((m: any) => m.id === masterId)
    if (!masterModel) return false
    if (btnId === 'add' && masterModel.can_create === false) return true
    if (btnId === 'edit' && masterModel.can_update === false) return true
    if (btnId === 'delete' && masterModel.can_delete === false) return true
    return false
  }

  // Forçar desmarcação de botões desabilitados pelas permissões do modelo
  useEffect(() => {
    let changed = false
    const newButtonsConfig = config.buttons_config.map((b: any) => {
      if (isButtonDisabledByModel(b.id) && b.visible) {
        changed = true
        return { ...b, visible: false }
      }
      return b
    })

    if (changed) {
      setConfig(prev => ({
        ...prev,
        buttons_config: newButtonsConfig
      }))
    }
  }, [config.selected_models, models, config.buttons_config])


  // Helpers de modo edição
  const isEditMode = !!initialData
  const viewId = initialData?.id

  // Popula os dados iniciais se estiver em modo edição
  const [isInitialized, setIsInitialized] = useState(false)

  // Se for criação de novo caso de uso, inicializa imediatamente para habilitar logs de telemetria
  useEffect(() => {
    if (!initialData) {
      setIsInitialized(true)
    }
  }, [initialData])

  function formatLabelText(text: string) {
    if (!text) return ''
    if (text.toLowerCase() === 'id') return 'ID'
    // Remove "id" from the end (e.g., "user_id" -> "user", "clienteId" -> "cliente")
    let formatted = text.replace(/_id$/i, '').replace(/Id$/i, '')
    if (formatted.trim() === '') formatted = text
    // Replace underscores with spaces
    formatted = formatted.replace(/_/g, ' ')
    // Split camelCase and PascalCase with spaces
    formatted = formatted.replace(/([a-z])([A-Z])/g, '$1 $2')
    // Title Case
    return formatted.replace(/\w\S*/g, (txt) => {
      return txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
    }).trim()
  }

  function getFormattedFieldName(id: string) {
    for (const m of models) {
      const f = m.fields.find((f: any) => f.id === id)
      if (f) {
        return formatLabelText(f.display_name || f.db_column_name)
      }
    }
    return formatLabelText(id)
  }

  function createDefaultFieldMeta(fid: string) {
    return {
      label: { text: getFormattedFieldName(fid), font: 'Inter', size: '10px', color: '' },
      content: { font: 'Inter', size: '12px', color: '', mask: '', required: false, readonly: false },
      component: { type: 'text', rows: 3, width: '100%', options_type: 'fixed', fixed_options: '', rel_table: '', rel_label: '', rel_value: '' },
      viacep: { enabled: false, logradouro: '', bairro: '', cidade: '', uf: '' }
    }
  }

  // Ref para guardar o estado anterior do config para o diff
  const prevConfigRef = useRef<typeof config | null>(null)
  
  // Lógica de diff síncrona para "Dar nome aos bois" sem perder a ordem sequencial das ações
  useEffect(() => {
    if (!isInitialized) return

    const prev = prevConfigRef.current
    const curr = config

    if (!prev) {
      // Primeira inicialização: apenas grava a baseline, sem logar
      prevConfigRef.current = curr
      return
    }

    const changes: string[] = []

    // --- Etapa 1: Lógica (Selects e Toggles) ---
    if (prev.logic_type !== curr.logic_type && curr.logic_type)
      changes.push(`Alterou a lógica de "${prev.logic_type || 'nenhuma'}" para "${curr.logic_type}"`)
    if (prev.has_arguments !== curr.has_arguments)
      changes.push(curr.has_arguments ? 'Habilitou filtros de argumento (Pesquisa com Filtro)' : 'Desabilitou filtros de argumento')
    if (prev.query_type !== curr.query_type)
      changes.push(`Alterou tipo de query para "${curr.query_type}"`)

    // Debounce manual para inputs de texto (Etapa 1) e propriedades do campo no Drawer (Etapa 3)
    let hasDebouncedChange = false
    if (prev.name !== curr.name) { textChangesRef.current.name = curr.name; hasDebouncedChange = true }
    if (prev.slug !== curr.slug) { textChangesRef.current.slug = curr.slug; hasDebouncedChange = true }
    if (prev.custom_query !== curr.custom_query) { textChangesRef.current.custom_query = curr.custom_query; hasDebouncedChange = true }

    const prevMeta = prev.layout_config.fields_metadata || {}
    const currMeta = curr.layout_config.fields_metadata || {}
    if (JSON.stringify(prevMeta) !== JSON.stringify(currMeta)) {
      const changedFid = Object.keys(currMeta).find(k => JSON.stringify(prevMeta[k]) !== JSON.stringify(currMeta[k]))
      if (changedFid) {
        let actualId = changedFid
        let zoneLabel = ''
        if (changedFid.startsWith('filter-')) {
          actualId = changedFid.replace('filter-', '')
          zoneLabel = ' no Filtro'
        } else if (changedFid.startsWith('grid-')) {
          actualId = changedFid.replace('grid-', '')
          zoneLabel = ' no Grid'
        } else if (changedFid.startsWith('form-')) {
          actualId = changedFid.replace('form-', '')
          zoneLabel = ' no Formulário'
        }
        textChangesRef.current.fields_metadata = `Alterou as propriedades do campo "${getFormattedFieldName(actualId)}"${zoneLabel} (Etapa 3)`
      } else {
        textChangesRef.current.fields_metadata = 'Alterou as propriedades de um campo (Etapa 3)'
      }
      hasDebouncedChange = true
    }

    if (prev.layout_config.master_tab_title !== curr.layout_config.master_tab_title) {
      textChangesRef.current.master_tab_title = true
      hasDebouncedChange = true
    }

    const prevDetailTabs = prev.layout_config.details_tab_titles || {}
    const currDetailTabs = curr.layout_config.details_tab_titles || {}
    if (JSON.stringify(prevDetailTabs) !== JSON.stringify(currDetailTabs)) {
      textChangesRef.current.details_tab_titles = true
      hasDebouncedChange = true
    }

    if (hasDebouncedChange) {
       if (textTimeoutRef.current) clearTimeout(textTimeoutRef.current)
       textTimeoutRef.current = setTimeout(() => {
          if (textChangesRef.current.name) logAction('CONFIG_CHANGE', `Renomeou o caso de uso para "${textChangesRef.current.name}"`)
          if (textChangesRef.current.slug) logAction('CONFIG_CHANGE', `Alterou o slug para "${textChangesRef.current.slug}"`)
          if (textChangesRef.current.custom_query) logAction('CONFIG_CHANGE', 'Editou a query SQL customizada')
          if (textChangesRef.current.fields_metadata) logAction('CONFIG_CHANGE', typeof textChangesRef.current.fields_metadata === 'string' ? textChangesRef.current.fields_metadata : 'Alterou as propriedades de um campo (Etapa 3)')
          if (textChangesRef.current.master_tab_title) logAction('CONFIG_CHANGE', 'Alterou o nome da aba Mestre (Etapa 3)')
          if (textChangesRef.current.details_tab_titles) logAction('CONFIG_CHANGE', 'Alterou os nomes das abas de Detalhe (Etapa 3)')
          textChangesRef.current = {}
       }, 1500)
    }

    // --- Etapa 2: Tabelas ---
    const addedModels = curr.selected_models.filter((id: string) => !prev.selected_models.includes(id))
    const removedModels = prev.selected_models.filter((id: string) => !curr.selected_models.includes(id))
    if (currentStep >= 2) {
      if (addedModels.length > 0) {
        const addedNames = addedModels.map((id: string) => models.find((m: any) => m.id === id)?.name || id).join(', ')
        changes.push(`Adicionou tabela(s): ${addedNames}`)
      }
      if (removedModels.length > 0) {
        const removedNames = removedModels.map((id: string) => models.find((m: any) => m.id === id)?.name || id).join(', ')
        changes.push(`Removeu tabela(s): ${removedNames}`)
      }
    }

    // --- Etapa 3: Layout - Campos ---
    const step3Label = '(Etapa 3 (Campos & Layout))'
    const zones: Array<{ key: 'filter_fields' | 'grid_fields' | 'form_fields'; label: string }> = [
      { key: 'filter_fields', label: 'Filtro' },
      { key: 'grid_fields', label: 'Grid/Listagem' },
      { key: 'form_fields', label: 'Formulário' },
    ]
    zones.forEach(({ key, label }) => {
      const prevFields: string[] = prev.layout_config[key] || []
      const currFields: string[] = curr.layout_config[key] || []
      const added = currFields.filter(f => !prevFields.includes(f))
      const removed = prevFields.filter(f => !currFields.includes(f))
      const reordered = added.length === 0 && removed.length === 0 &&
        JSON.stringify(prevFields) !== JSON.stringify(currFields)
      if (currentStep >= 3) {
        if (added.length > 0) {
          const addedNames = added.map(f => getFormattedFieldName(f)).join(', ')
          changes.push(`Adicionou ao ${label}: ${addedNames}`)
        }
        if (removed.length > 0) {
          const removedNames = removed.map(f => getFormattedFieldName(f)).join(', ')
          changes.push(`Removeu do ${label}: ${removedNames}`)
        }
        if (reordered) {
          changes.push(`Reordenou campos no ${label}`)
        }
      }
    })

    // --- Layout: Joins ---
    const prevJoins = prev.layout_config.joins || []
    const currJoins = curr.layout_config.joins || []
    if (prevJoins.length !== currJoins.length) {
      if (currentStep >= 3) {
        if (currJoins.length > prevJoins.length) {
          const newJoins = currJoins.filter((j: any) => !prevJoins.some((pj: any) => pj.id === j.id))
          newJoins.forEach((j: any) => {
            const sourceModel = models.find((m: any) => m.id === j.source_model_id)?.name || 'Tabela A'
            const targetModel = models.find((m: any) => m.id === j.target_model_id)?.name || 'Tabela B'
            changes.push(`Adicionou relacionamento (JOIN) entre ${sourceModel} e ${targetModel}`)
          })
        }
        else {
          changes.push(`Removeu ${prevJoins.length - currJoins.length} relacionamento(s) (JOIN) do layout`)
        }
      }
    }

    // --- Layout: Display Type, Grouping, Default View ---
    if (currentStep >= 3) {
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
        changes.push(`Alterou tabela Mestre do Master-Detail`)
      if (prev.layout_config.mindmap_central_field !== curr.layout_config.mindmap_central_field)
        changes.push(`Alterou campo central do Mapa Mental`)
    }

    // --- Layout: Configs Especializadas ---
    const specialConfigs: Array<{ key: string; label: string; fields: string[] }> = [
      { key: 'timeline_config', label: 'Linha do Tempo', fields: ['date_field', 'title_field', 'desc_field', 'icon_field'] },
      { key: 'map_config', label: 'Mapa', fields: ['lat_field', 'lng_field', 'title_field', 'desc_field'] },
      { key: 'gantt_config', label: 'Gantt', fields: ['title_field', 'start_date_field', 'end_date_field', 'progress_field', 'predecessor_field'] },
      { key: 'blueprint_config', label: 'Fluxograma', fields: ['title_field', 'desc_field', 'status_field', 'predecessor_field'] },
      { key: 'scheduler_config', label: 'Agenda', fields: ['title_field', 'start_date_field', 'end_date_field', 'color_field'] },
    ]
    specialConfigs.forEach(({ key, label, fields }) => {
      const prevSpec = (prev.layout_config as any)[key] || {}
      const currSpec = (curr.layout_config as any)[key] || {}
      fields.forEach(field => {
        if (prevSpec[field] !== currSpec[field] && currSpec[field]) {
          const fieldLabels: Record<string, string> = {
            date_field: 'Data', title_field: 'Título', desc_field: 'Descrição',
            icon_field: 'Ícone', lat_field: 'Latitude', lng_field: 'Longitude',
            start_date_field: 'Data Início', end_date_field: 'Data Fim',
            progress_field: 'Progresso', predecessor_field: 'Predecessora',
            status_field: 'Status', color_field: 'Cor'
          }
          if (currentStep >= 3) {
            changes.push(`Configurou campo "${fieldLabels[field] || field}" do ${label}: "${currSpec[field]}"`)
          }
        }
      })
    })

    // --- Layout: Widgets do Analytics ---
    const prevWidgets = prev.layout_config.analytics_config?.widgets || []
    const currWidgets = curr.layout_config.analytics_config?.widgets || []
    if (currentStep >= 3) {
      if (currWidgets.length > prevWidgets.length)
        changes.push(`Adicionou ${currWidgets.length - prevWidgets.length} widget(s) ao Dashboard BI`)
      if (currWidgets.length < prevWidgets.length)
        changes.push(`Removeu ${prevWidgets.length - currWidgets.length} widget(s) do Dashboard BI`)
      // Detectar edição de widget existente
      currWidgets.forEach((w: any) => {
        const prevW = prevWidgets.find((pw: any) => pw.id === w.id)
        if (prevW && JSON.stringify(prevW) !== JSON.stringify(w))
          changes.push(`Editou widget BI "${w.title || w.type}" no Dashboard`)
      })
    }

    // --- Etapa 4: Botões e Configurações de Ação ---
    const step4Label = '(Etapa 4 (Ações & Query))'
    const prevButtons = prev.buttons_config || []
    const currButtons = curr.buttons_config || []
    currButtons.forEach((btn: any) => {
      const prevBtn = prevButtons.find((b: any) => b.id === btn.id)
      if (prevBtn && prevBtn.visible !== btn.visible) {
        // Apenas registra a alteração do botão se o usuário estiver na Etapa 4
        // para evitar registrar o auto-suggest de botões que roda na Etapa 1
        if (currentStep >= 4) {
          changes.push(`${btn.visible ? 'Habilitou' : 'Desabilitou'} o botão "${btn.label || btn.id}" ${step4Label}`)
        }
      }
      if (prevBtn && prevBtn.label !== btn.label && btn.label) {
        if (currentStep >= 4) {
          changes.push(`Renomeou o botão "${prevBtn.label}" para "${btn.label}" ${step4Label}`)
        }
      }
    })

    // --- Etapa 4: Ações Customizadas ---
    const prevActions = prev.layout_config.custom_actions || []
    const currActions = curr.layout_config.custom_actions || []
    if (currentStep >= 4) {
      if (currActions.length > prevActions.length)
        changes.push(`Adicionou ${currActions.length - prevActions.length} ação(ões) customizada(s) ${step4Label}`)
      if (currActions.length < prevActions.length)
        changes.push(`Removeu ${prevActions.length - currActions.length} ação(ões) customizada(s) ${step4Label}`)
      
      currActions.forEach((a: any) => {
        const prevA = prevActions.find((pa: any) => pa.id === a.id)
        if (prevA && JSON.stringify(prevA) !== JSON.stringify(a)) {
          changes.push(`Editou a ação customizada "${a.label || a.id}" ${step4Label}`)
        }
      })
    }

    // --- Etapa 4: Formatos de Exportação ---
    const prevFormats: string[] = prev.layout_config.export_formats || ['xlsx', 'csv', 'json']
    const currFormats: string[] = curr.layout_config.export_formats || ['xlsx', 'csv', 'json']
    const formatLabels: Record<string, string> = {
      xlsx: 'Excel (XLSX)',
      csv: 'CSV',
      json: 'JSON',
      pdf: 'PDF',
      ofx: 'OFX (Finance)'
    }
    const addedFormats = currFormats.filter(f => !prevFormats.includes(f))
    const removedFormats = prevFormats.filter(f => !currFormats.includes(f))
    if (currentStep >= 4) {
      addedFormats.forEach(fmt => {
        const fmtLabel = formatLabels[fmt] || fmt
        changes.push(`Habilitou o botão "${fmtLabel}" ${step4Label}`)
      })
      removedFormats.forEach(fmt => {
        const fmtLabel = formatLabels[fmt] || fmt
        changes.push(`Desabilitou o botão "${fmtLabel}" ${step4Label}`)
      })
    }

    // --- Enviar logs ---
    if (changes.length > 0) {
      changes.forEach(detail => logAction('CONFIG_CHANGE', detail))
    }

    prevConfigRef.current = curr
  }, [config, currentStep, isInitialized, logAction])

  useEffect(() => {
    const loadData = async () => {
      // 1. Primeiro buscamos o ID do projeto atual pelo slug
      const { data: project } = await supabase
        .from('projects')
        .select('id, workspace_id, theme_config')
        .eq('slug', project_slug)
        .single()

      if (!project) return
      
      setIsDownloadsActive(project.theme_config?.enable_downloads !== false)
      setCurrentProjectId(project.id)
      setCurrentWorkspaceId(project.workspace_id)

      // 2. Buscamos apenas os modelos deste projeto
      const { data: modelsData } = await supabase
        .from('models')
        .select('*, fields(*)')
        .eq('project_id', project.id)
        .order('db_table_name')

      if (modelsData) setModels(modelsData)

      // 2.5 Buscamos as enumerations globais do projeto
      const { data: enumsData } = await supabase
        .from('project_enumerations')
        .select('*')
        .eq('project_id', project.id)
        .order('name')
        
      if (enumsData) setEnumerations(enumsData)

      // 3. Buscamos apenas as relações deste projeto
      const { data: relsData } = await supabase
        .from('relations')
        .select('*')
        .eq('project_id', project.id)
      
      if (relsData) setRelations(relsData)

      const { data: viewsData } = await supabase
        .from('ui_views')
        .select('name, slug, logic_type')
        .eq('project_id', project.id)
        .order('name')
      
      if (viewsData) {
        // Deduplicate to avoid React key errors
        const unique = viewsData.filter((v, i, a) => a.findIndex(t => (t.slug === v.slug)) === i)
        setUseCases(unique)
      }

      // 4. Busca os workflows BPM deste projeto para a aba de BPM/Automação
      const { data: bpmData } = await supabase
        .from('bpm_workflows')
        .select('id, name')
        .eq('project_id', project.id)
        .order('name')
        
      if (bpmData) setBpmWorkflows(bpmData)

      setIsLoading(false)
    }
    loadData()
  }, [supabase, project_slug])

  // Brinde UX: Sugestão automática de Joins baseada na tabela 'relations' (vinda do tunnel)
  useEffect(() => {
    // Se estiver em modo edição ou se já houver joins configurados, não sobrescrevemos
    // ou se não houver modelos suficientes selecionados
    if (config.layout_config.joins.length > 0 || config.selected_models.length <= 1) return

    if (currentStep === 3) {
      const autoJoins: any[] = []
      
      if (relations.length > 0) {
        // Filtra relações onde AMBOS os modelos estão selecionados no Wizard
        const relevantRelations = relations.filter(rel => 
          config.selected_models.includes(rel.foreign_table_id) && 
          config.selected_models.includes(rel.referenced_table_id)
        )

        relevantRelations.forEach(rel => {
          const fromModel = models.find(m => m.id === rel.foreign_table_id)
          const toModel = models.find(m => m.id === rel.referenced_table_id)
          const fromField = fromModel?.fields.find((f: any) => f.id === rel.foreign_column_id)
          const toField = toModel?.fields.find((f: any) => f.id === rel.referenced_column_id)

          if (fromModel && toModel && fromField && toField) {
            // No MetaBuilder, convencionamos Mestre (Pai) -> Detalhe (Filho)
            // No banco: fromModel(B).fromField(a_id) -> toModel(A).toField(id)
            // Na UI: A.id -> B.a_id
            autoJoins.push({
              from: toModel.db_table_name,
              localKey: toField.db_column_name,
              to: fromModel.db_table_name,
              foreignKey: fromField.db_column_name
            })
          }
        })
      }

      // NOVO: Fallback (Heurística) para caso não encontre relações via banco de dados
      if (autoJoins.length === 0) {
        const selectedModelsData = models.filter(m => config.selected_models.includes(m.id))
        for (let i = 0; i < selectedModelsData.length; i++) {
          for (let j = 0; j < selectedModelsData.length; j++) {
            if (i === j) continue
            const modelA = selectedModelsData[i]
            const modelB = selectedModelsData[j]
            
            const expectedKeys = [
              `${modelA.db_table_name}_id`,
              `${modelA.db_table_name.replace(/s$/, '')}_id`
            ]
            
            const parts = modelA.db_table_name.split('_')
            if (parts.length > 1) {
              expectedKeys.push(`${parts[0]}_id`)
              expectedKeys.push(`${parts[0].replace(/s$/, '')}_id`)
            }

            const fkField = modelB.fields.find((f: any) => expectedKeys.includes(f.db_column_name))
            const pkField = modelA.fields.find((f: any) => f.db_column_name === 'id') || modelA.fields[0]

            if (fkField && pkField) {
              const alreadyExists = autoJoins.some(j => (j.from === modelA.db_table_name && j.to === modelB.db_table_name) || (j.from === modelB.db_table_name && j.to === modelA.db_table_name))
              if (!alreadyExists) {
                autoJoins.push({
                  from: modelA.db_table_name,
                  localKey: pkField.db_column_name,
                  to: modelB.db_table_name,
                  foreignKey: fkField.db_column_name
                })
              }
            }
          }
        }
      }

      if (autoJoins.length > 0) {
        setConfig(prev => ({
          ...prev,
          layout_config: {
            ...prev.layout_config,
            joins: autoJoins
          }
        }))
        toast(`Sugerimos ${autoJoins.length} relacionamentos automaticamente!`, 'info')
      }
    }
  }, [currentStep, relations, config.selected_models, initialData, models])

  useEffect(() => {
    if (initialData && !isInitialized) {
      setConfig({
        name: initialData.name || '',
        slug: initialData.slug || '',
        logic_type: initialData.logic_type || '',
        has_arguments: initialData.has_arguments ?? true,
        selected_models: initialData.tables_config || [],
        tables_config: initialData.tables_config || [],
        query_type: initialData.query_type || 'dynamic',
        custom_query: initialData.custom_query || '',
        layout_config: {
          filter_fields: initialData.layout_config?.filter_fields || [],
          grid_fields: initialData.layout_config?.grid_fields || [],
          form_fields: initialData.layout_config?.form_fields || [],
          grouping_type: initialData.layout_config?.grouping_type || 'sections',
          display_type: initialData.layout_config?.display_type || 'list',
          default_view: initialData.layout_config?.default_view || 'list',
          kanban_group_field: initialData.layout_config?.kanban_group_field || '',
          master_model_id: initialData.layout_config?.master_model_id || '',
          detail_display_mode: initialData.layout_config?.detail_display_mode || 'tabs',
          mindmap_central_field: initialData.layout_config?.mindmap_central_field || '',
          action_interface_type: initialData.layout_config?.action_interface_type || 'drawer',
          joins: initialData.layout_config?.joins || [],
          fields_metadata: initialData.layout_config?.fields_metadata || {},
          analytics_config: initialData.layout_config?.analytics_config || { widgets: [], allow_runtime_edit: true },
          details_interface_types: initialData.layout_config?.details_interface_types || {},
          details_inline_types: initialData.layout_config?.details_inline_types || {},
          master_tab_title: initialData.layout_config?.master_tab_title,
          details_tab_titles: initialData.layout_config?.details_tab_titles || {},
          export_formats: initialData.layout_config?.export_formats || ['xlsx', 'csv', 'json'],
          gallery_click_behavior: initialData.layout_config?.gallery_click_behavior || 'lightbox',
          scheduler_config: initialData.layout_config?.scheduler_config || {
            title_field: '',
            start_date_field: '',
            end_date_field: '',
            color_field: ''
          },
          timeline_config: initialData.layout_config?.timeline_config || {
            date_field: '',
            title_field: '',
            desc_field: '',
            icon_field: ''
          },
          map_config: initialData.layout_config?.map_config || {
            lat_field: '',
            lng_field: '',
            title_field: '',
            desc_field: ''
          },
          gantt_config: initialData.layout_config?.gantt_config || {
            title_field: '',
            start_date_field: '',
            end_date_field: '',
            progress_field: '',
            dependencies_field: ''
          },
          blueprint_config: initialData.layout_config?.blueprint_config || {
            title_field: '',
            desc_field: '',
            status_field: '',
            predecessor_field: ''
          },
          custom_actions: initialData.layout_config?.custom_actions || []
        },
        buttons_config: (() => {
          const defaults = [
            { id: 'search', label: t('runtime.search'), labelKey: 'runtime.search', icon: 'search', action: 'search', visible: true },
            { id: 'clear', label: t('runtime.clear'), labelKey: 'runtime.clear', icon: 'refresh-ccw', action: 'clear', visible: true },
            { id: 'view', label: t('runtime.view'), labelKey: 'runtime.view', icon: 'search', action: 'view', visible: true },
            { id: 'add', label: t('runtime.new_record'), labelKey: 'runtime.new_record', icon: 'plus', action: 'create', visible: true },
            { id: 'edit', label: t('runtime.edit'), labelKey: 'runtime.edit', icon: 'pencil', action: 'pencil', action_key: 'update', visible: true },
            { id: 'delete', label: t('runtime.delete'), labelKey: 'runtime.delete', icon: 'trash', action_key: 'delete', visible: true },
            { id: 'export', label: 'Exportar Dados', labelKey: 'runtime.export', icon: 'download', action: 'export', visible: true }
          ]
          if (!initialData.buttons_config) return defaults
          // Merge: Keep existing visible states, but ensure all default IDs exist
          return defaults.map(def => {
            const existing = initialData.buttons_config.find((b: any) => b.id === def.id)
            return existing ? { ...def, ...existing } : { ...def, visible: def.id === 'export' ? true : false }
          })
        })()
      })
      setIsInitialized(true)
    }
  }, [initialData, isInitialized])

  // Sugestão automática de botões baseado na lógica selecionada
  useEffect(() => {
    // Se estivermos em modo edição (initialData presente), NUNCA rodamos a sugestão automática
    // para não atropelar as escolhas já salvas e persistidas pelo usuário.
    if (initialData) return

    // Só sugerimos enquanto o usuário não chegou na etapa de edição manual (Passo 4)
    if (currentStep < 4) {
      const isPesquisa = config.logic_type === 'pesquisa'
      const isCadastro = config.logic_type === 'cadastro'
      const isBoth = config.logic_type === 'pesquisa_cadastro'
      const isMasterDetail = config.logic_type === 'master_detail'
      const hasArgs = config.has_arguments

      let searchVis = false
      let viewVis = false
      let addVis = false
      let editVis = false
      let delVis = false

      if (isPesquisa) {
        searchVis = hasArgs
        viewVis = true
      } else if (isBoth || isMasterDetail) {
        // Para Mestre-Detalhe ou Pesquisa+Cadastro, mostramos todos por padrão (UX solicitada)
        searchVis = true
        viewVis = true
        addVis = true
        editVis = true
        delVis = true
      } else if (isCadastro) {
        addVis = true
      }

      setConfig(prev => ({
        ...prev,
        buttons_config: prev.buttons_config.map(btn => {
          if (btn.id === 'search') return { ...btn, visible: searchVis }
          if (btn.id === 'clear') return { ...btn, visible: searchVis }
          if (btn.id === 'view') return { ...btn, visible: viewVis }
          if (btn.id === 'add') return { ...btn, visible: addVis }
          if (btn.id === 'edit') return { ...btn, visible: editVis }
          if (btn.id === 'delete') return { ...btn, visible: delVis }
          return btn
        })
      }))
    }
  }, [config.logic_type, config.has_arguments, currentStep, isInitialized, initialData])

  // Limpeza automática de campos se a lógica mudar
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

    if (updateNeeded) {
      setConfig(prev => ({ ...prev, layout_config: newLayout }))
    }
  }, [config.logic_type, config.has_arguments])

  // Auto-descoberta de tabelas para Analytics (BI)
  useEffect(() => {
    if (config.logic_type !== 'analytics') return

    const widgetModels = (config.layout_config.analytics_config?.widgets || []).map((w: any) => w.model_id)
    const joinModels = (config.layout_config.joins || []).flatMap((j: any) => {
      const fromModel = models.find(m => m.db_table_name === j.from)
      const toModel = models.find(m => m.db_table_name === j.to)
      return [fromModel?.id, toModel?.id].filter(Boolean)
    })

    const allInvolved = Array.from(new Set([...widgetModels, ...joinModels])).filter(Boolean) as string[]
    
    // Só atualizamos se houver mudança real para evitar loops de renderização
    if (JSON.stringify([...allInvolved].sort()) !== JSON.stringify([...config.selected_models].sort())) {
      setConfig(prev => ({
        ...prev,
        selected_models: allInvolved,
        tables_config: allInvolved
      }))
    }
  }, [config.layout_config.analytics_config.widgets, config.layout_config.joins, config.logic_type, models])

  useEffect(() => {
    const loadModels = async () => {
      const { data } = await supabase
        .from('models')
        .select('*, fields(*)')
        .order('db_table_name')

      if (data) setModels(data)
      setIsLoading(false)
    }
    loadModels()
  }, [supabase])

  const steps = [
    { id: 1, title: t('wizard.steps.logic'), icon: <Settings2 className="w-4 h-4" /> },
    { id: 2, title: t('wizard.steps.tables'), icon: <Database className="w-4 h-4" />, hidden: config.logic_type === 'analytics' },
    { id: 3, title: t('wizard.steps.layout'), icon: <Layout className="w-4 h-4" /> },
    { id: 4, title: t('wizard.steps.actions'), icon: <MousePointer2 className="w-4 h-4" /> }
  ].filter(s => !s.hidden)

  const isStepValid = (step: number) => {
    if (step === 1) return !!(config.name && config.slug && config.logic_type)
    if (step === 2) return config.selected_models.length > 0
    if (step === 3) {
      const { logic_type, has_arguments, layout_config } = config
      const hasGrid = layout_config.grid_fields.length > 0
      const hasFilter = layout_config.filter_fields.length > 0
      const hasForm = layout_config.form_fields.length > 0

      if (logic_type === 'pesquisa') {
        return hasGrid && (!has_arguments || hasFilter)
      }
      if (logic_type === 'cadastro') {
        return hasForm
      }
      if (logic_type === 'pesquisa_cadastro') {
        return hasGrid && hasForm && (!has_arguments || hasFilter)
      }
      if (logic_type === 'kanban') {
        return !!layout_config.kanban_group_field && hasGrid
      }
      if (logic_type === 'timeline') {
        return !!((layout_config as any).timeline_config?.date_field && (layout_config as any).timeline_config?.title_field)
      }
      if (logic_type === 'map') {
        return !!((layout_config as any).map_config?.lat_field && (layout_config as any).map_config?.lng_field && (layout_config as any).map_config?.title_field)
      }
      if (logic_type === 'gantt') {
        return !!((layout_config as any).gantt_config?.title_field && (layout_config as any).gantt_config?.start_date_field && (layout_config as any).gantt_config?.end_date_field)
      }
      if (logic_type === 'blueprint') {
        return !!((layout_config as any).blueprint_config?.title_field && (layout_config as any).blueprint_config?.predecessor_field)
      }
      if (logic_type === 'scheduler') {
        return !!((layout_config as any).scheduler_config?.title_field && (layout_config as any).scheduler_config?.start_date_field) && hasGrid
      }
      if (logic_type === 'mapa_mental') {
        return !!(layout_config as any).mindmap_central_field && hasGrid
      }
      if (logic_type === 'master_detail') {
        return config.selected_models.length >= 2 && !!(layout_config as any).master_model_id && hasGrid
      }
      return true
    }
    return true
  }

  const nextStep = () => {
    if (!isStepValid(currentStep)) {
      if (currentStep === 1) toast(t('wizard.buttons.validation.name_slug_required'), 'error')
      if (currentStep === 2 && config.selected_models.length < (config.logic_type === 'master_detail' ? 2 : 1)) {
        toast(config.logic_type === 'master_detail' ? "Mestre-Detalhe requer pelo menos 2 tabelas." : t('dashboard.projects.studio.config.db_fields_desc').replace('{table}', ''), 'error')
        return
      }

      if (currentStep === 3) {
        const { logic_type, has_arguments, layout_config } = config
        if (!layout_config.grid_fields.length && logic_type !== 'cadastro') toast(t('wizard.buttons.validation.grid_required'), 'error')
        if (!layout_config.form_fields.length && (logic_type === 'cadastro' || logic_type === 'pesquisa_cadastro' || logic_type === 'master_detail')) toast(t('wizard.buttons.validation.form_required'), 'error')
        if (has_arguments && !layout_config.filter_fields.length && logic_type.includes('pesquisa')) toast(t('wizard.buttons.validation.filter_required'), 'error')
        if (logic_type === 'kanban' && !layout_config.kanban_group_field) toast("Please select a grouping field for Kanban.", 'error')
        if (logic_type === 'timeline' && (!(layout_config as any).timeline_config?.date_field || !(layout_config as any).timeline_config?.title_field)) toast("Por favor, selecione os campos de data e título para a Linha do Tempo.", 'error')
        if (logic_type === 'map' && (!(layout_config as any).map_config?.lat_field || !(layout_config as any).map_config?.lng_field || !(layout_config as any).map_config?.title_field)) toast("Por favor, selecione os campos de Latitude, Longitude e Título para o Mapa.", 'error')
        if (logic_type === 'gantt' && (!(layout_config as any).gantt_config?.title_field || !(layout_config as any).gantt_config?.start_date_field || !(layout_config as any).gantt_config?.end_date_field)) toast("Por favor, selecione os campos de Título, Data Inicial e Data Final para o Gantt.", 'error')
        if (logic_type === 'blueprint' && (!(layout_config as any).blueprint_config?.title_field || !(layout_config as any).blueprint_config?.predecessor_field)) toast("Por favor, selecione os campos de Título e Predecessora para o Fluxograma.", 'error')
        if (logic_type === 'scheduler' && (!(layout_config as any).scheduler_config?.title_field || !(layout_config as any).scheduler_config?.start_date_field)) toast("Por favor, selecione os campos de título e data de início para o Calendário.", 'error')
        if (logic_type === 'mapa_mental' && !(layout_config as any).mindmap_central_field) toast("Please select a central field for Mind Map.", 'error')
        if (logic_type === 'master_detail' && !(layout_config as any).master_model_id) toast("Please select the Master Table.", 'error')
      }
      return
    }

    if (currentStep === 1 && config.logic_type === 'analytics' && config.selected_models.length === 0 && models.length > 0) {
      setConfig(prev => ({ ...prev, selected_models: [models[0].id] }))
    }

    setCurrentStep(prev => Math.min(prev + 1, steps.length))
  }
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1))

  const handleSave = async () => {
    if (!canCreate) {
      toast("Você não tem permissão para salvar alterações.", 'error')
      return
    }

    if (!config.name || !config.slug) {
      toast(t('wizard.buttons.validation.name_slug_required'), 'error')
      return
    }

    setIsSaving(true)
    try {
      // 1. Criar/Atualizar a View Principal
      const { data: projectData } = await supabase.from('projects').select('id').eq('slug', project_slug).single()

      const validFieldIds = new Set(models.flatMap((m: any) => m.fields?.map((f: any) => f.id) || []))

      const filterValid = (arr: string[]) => (arr || []).filter(fid => validFieldIds.has(fid))

      const validFormFields = filterValid(config.layout_config.form_fields)
      const validGridFields = filterValid(config.layout_config.grid_fields)
      const validFilterFields = filterValid(config.layout_config.filter_fields)

      const allFieldIds = new Set([
        ...validFormFields,
        ...validGridFields,
        ...validFilterFields,
      ])

      const populatedFieldsMeta = { ...config.layout_config.fields_metadata }

      allFieldIds.forEach(fid => {
        if (!populatedFieldsMeta[fid]) {
          populatedFieldsMeta[fid] = createDefaultFieldMeta(fid)
        }
      })

      const cleanLayoutConfig = {
        ...config.layout_config,
        form_fields: validFormFields,
        grid_fields: validGridFields,
        filter_fields: validFilterFields,
      }

      const viewPayload = {
        project_id: projectData?.id,
        name: config.name,
        slug: config.slug,
        logic_type: config.logic_type,
        has_arguments: config.has_arguments,
        tables_config: config.selected_models,
        query_type: config.query_type,
        custom_query: config.custom_query,
        layout_config: { ...cleanLayoutConfig, fields_metadata: populatedFieldsMeta, is_active: true },
        buttons_config: config.buttons_config,
        view_type: 'advanced_use_case',
        model_id: config.selected_models[0], // Define a primeira tabela como modelo principal
      }

      // Tenta encontrar por slug primeiro
      const { data: existingBySlug } = await supabase
        .from('ui_views')
        .select('id')
        .eq('project_id', projectData?.id)
        .eq('slug', config.slug)
        .maybeSingle()

      let view: any
      let viewError: any

      if (existingBySlug && (!initialData || existingBySlug.id !== initialData.id)) {
        toast("Já existe um caso de uso com este slug neste projeto.", 'error')
        setIsSaving(false)
        return
      }

      if (initialData) {
        const { data, error } = await supabase
          .from('ui_views')
          .update(viewPayload)
          .eq('id', initialData.id)
          .select()
          .single()
        view = data
        viewError = error
      } else {
        const { data, error } = await supabase
          .from('ui_views')
          .insert(viewPayload)
          .select()
          .single()
        view = data
        viewError = error
      }

      if (viewError) throw viewError

      // 2. Limpar componentes antigos desta view
      await supabase.from('ui_components').delete().eq('view_id', view.id)

      // 3. Consolidar componentes por field_id para evitar violação de constraint unique(view_id, field_id)
      const componentMap: Record<string, any> = {}

      const formatLabelText = (text: string) => {
        let formatted = text.replace(/_id$/i, '').replace(/Id$/i, '')
        formatted = formatted.replace(/_/g, ' ')
        formatted = formatted.replace(/([a-z])([A-Z])/g, '$1 $2')
        return formatted.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase())
      }

      const getFormattedFieldName = (id: string) => {
        for (const m of models) {
          const f = m.fields?.find((f: any) => f.id === id)
          if (f) return formatLabelText(f.display_name || f.db_column_name)
        }
        return formatLabelText(id)
      }

      const addOrUpdateComponent = (fid: string, zone: string) => {
        const zoneMeta = config.layout_config.fields_metadata[`${zone}-${fid}`]
        const globalMeta = config.layout_config.fields_metadata[fid] || {}
        const metadata = zoneMeta || globalMeta
        
        const labelText = metadata.label?.text || getFormattedFieldName(fid)

        if (!componentMap[fid]) {
          componentMap[fid] = {
            view_id: view.id,
            field_id: fid,
            component_type: zone,
            label: labelText,
            is_visible: true,
            config: {
              zones: [zone],
              [`${zone}_config`]: metadata,
              ...metadata
            }
          }
        } else {
          if (!componentMap[fid].config.zones.includes(zone)) {
            componentMap[fid].config.zones.push(zone)
          }
          componentMap[fid].config[`${zone}_config`] = metadata
          
          if (zone === 'form' && metadata.label?.text) {
             componentMap[fid].label = metadata.label.text
          } else if (zone === 'form' && !componentMap[fid].label) {
             componentMap[fid].label = labelText
          }
        }
      }

      validFilterFields.forEach((fid: string) => addOrUpdateComponent(fid, 'filter'))
      validGridFields.forEach((fid: string) => addOrUpdateComponent(fid, 'grid'))
      validFormFields.forEach((fid: string) => addOrUpdateComponent(fid, 'form'))

      const componentsToInsert = Object.values(componentMap)

      if (componentsToInsert.length > 0) {
        const { error: compError } = await supabase.from('ui_components').insert(componentsToInsert)
        if (compError) throw compError
      }

      flushTextChanges()
      logAction('SAVE', 'Atualizou as configurações do caso de uso')
      await flush(view.id)
      onSaveSuccess()
    } catch (err: any) {
      console.error(err)
      toast(t('wizard.buttons.error_save') + err.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] text-neutral-500">
      <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-600" />
      <p className="text-sm font-bold animate-pulse">{t('common.loading')}</p>
    </div>
  )

  return (
    <div className="flex flex-col pb-32">

      {/* Header Interno do Builder (Imagem 2) */}
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="p-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-all text-neutral-400 hover:text-neutral-900 dark:hover:text-white border border-neutral-200 dark:border-neutral-800 shadow-sm">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="h-8 w-px bg-neutral-200 dark:bg-neutral-800 mx-2"></div>
            <div>
              <h1 className="text-sm font-black tracking-tight">{t('wizard.title')}</h1>
              <p className="text-[8px] text-indigo-600 dark:text-indigo-400 uppercase font-black tracking-[0.2em]">
                {initialData ? t('wizard.edit_mode') : t('wizard.new_mode')}
                {config.name ? <span className="text-neutral-400 dark:text-neutral-500 ml-1">/ {config.name}</span> : ''}
              </p>
            </div>
          </div>

          {canCreate && (
            <div className="flex items-center gap-4">
              {initialData && (
                <>
                  <div className={cn(
                    "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                    currentStatus === 'delivered' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                    currentStatus === 'reopened' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                    'bg-neutral-100 text-neutral-500 border-neutral-200 dark:bg-neutral-800 dark:border-neutral-700'
                  )}>
                    {currentStatus === 'delivered' ? 'Entregue' : currentStatus === 'reopened' ? 'Reaberto' : 'Rascunho'}
                  </div>

                  {currentStatus !== 'delivered' && (
                    <button
                      onClick={() => handleUpdateStatus('delivered')}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-50 active:scale-95"
                    >
                      🚀 Entregar
                    </button>
                  )}

                  {currentStatus === 'delivered' && (
                    <button
                      onClick={() => handleUpdateStatus('reopened')}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-amber-500/20 disabled:opacity-50 active:scale-95"
                    >
                      🔓 Reabrir
                    </button>
                  )}
                </>
              )}

              {/* Só permite salvar se não estiver Entregue */}
              {currentStatus !== 'delivered' && (
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-50 active:scale-95"
                >
                  {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  {isSaving ? (initialData ? t('wizard.buttons.updating') : t('wizard.buttons.saving')) : (initialData ? t('wizard.buttons.update') : t('wizard.buttons.finish'))}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Stepper Progress Bar */}
        <div className="bg-neutral-50/50 dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 px-6 py-4 rounded-[2rem]">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            {steps.map((step, idx) => (
              <div key={step.id} className="flex items-center flex-1 last:flex-none">
                <div
                  className={cn(
                    "flex items-center gap-3 transition-all",
                    currentStep >= idx + 1 ? 'text-indigo-600 dark:text-indigo-400' : 'text-neutral-400'
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-xl border-2 flex items-center justify-center font-black text-[10px] transition-all shadow-sm",
                    currentStep === idx + 1 ? 'border-indigo-600 bg-indigo-600 text-white rotate-3 shadow-indigo-500/20' :
                      currentStep > idx + 1 ? 'border-indigo-600 bg-indigo-600/10' : 'border-neutral-200 dark:border-neutral-800'
                  )}>
                    {currentStep > idx + 1 ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-[0.15em] hidden sm:block">{step.title}</span>
                </div>
                {idx < steps.length - 1 && (
                  <div className={cn(
                    "flex-1 mx-6 h-px transition-colors",
                    currentStep > idx + 1 ? 'bg-indigo-600/30' : 'bg-neutral-200 dark:bg-neutral-800'
                  )}></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="mt-6 min-h-[500px]">
        {steps[currentStep - 1]?.id === 1 && (
          <StepLogic config={config} setConfig={setConfig} />
        )}
        {steps[currentStep - 1]?.id === 2 && (
          <StepTables config={config} setConfig={setConfig} models={models} />
        )}
        {steps[currentStep - 1]?.id === 3 && (
          <StepLayout config={config} setConfig={setConfig} models={models} enumerations={enumerations} />
        )}
        {steps[currentStep - 1]?.id === 4 && (
          <StepActions config={config} setConfig={setConfig} models={models} useCases={useCases} isDownloadsActive={isDownloadsActive} bpmWorkflows={bpmWorkflows} />
        )}
      </div>

      {/* Floating Footer Navigation */}
      <div className="fixed bottom-6 left-0 right-0 flex justify-center px-6 z-40">
        <div className="w-full max-w-2xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200 dark:border-neutral-800 p-2 rounded-full flex items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-0",
              currentStep === steps.length
                ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-xl"
                : "text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800"
            )}
          >
            <ChevronLeft className="w-3 h-3" /> {t('wizard.buttons.prev')}
          </button>

          <button
            onClick={currentStep === steps.length ? handleSave : nextStep}
            disabled={isSaving || (currentStep === steps.length && !canCreate)}
            className={cn(
              "flex items-center gap-2 px-8 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl",
              currentStep === steps.length
                ? (!canCreate ? "bg-neutral-200 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed opacity-50" : "text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800")
                : (currentStep === 1 && config.logic_type === 'analytics' ? false : !isStepValid(steps[currentStep-1].id))
                  ? "bg-neutral-200 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed opacity-50"
                  : "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-neutral-900/10 dark:shadow-white/5"
            )}
          >
            {currentStep === steps.length ? (
              isSaving ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> {initialData ? t('wizard.buttons.updating') : t('wizard.buttons.saving')}</>
              ) : (
                <>{!canCreate ? "Sem permissão" : (initialData ? t('wizard.buttons.update') : t('wizard.buttons.finish'))} <Save className="w-3 h-3 ml-1" /></>
              )
            ) : (
              <>{t('wizard.buttons.next')} <ChevronRight className="w-3 h-3" /></>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// --- SUB-COMPONENTES DE PASSOS ---

function StepLogic({ config, setConfig }: any) {
  const { t } = useI18n()
  const categories = [
    {
      id: 'dados',
      title: 'Gestão de Dados e Cadastros',
      description: 'Interfaces focadas em inserção, listagem e relacionamento.',
      icon: Database,
      items: [
        { id: 'pesquisa', title: t('wizard.logic.types.pesquisa.title'), desc: t('wizard.logic.types.pesquisa.desc'), icon: Layout },
        { id: 'cadastro', title: t('wizard.logic.types.cadastro.title'), desc: t('wizard.logic.types.cadastro.desc'), icon: Layout },
        { id: 'pesquisa_cadastro', title: t('wizard.logic.types.pesquisa_cadastro.title'), desc: t('wizard.logic.types.pesquisa_cadastro.desc'), icon: Layout },
        { id: 'master_detail', title: t('wizard.logic.types.master_detail.title'), desc: t('wizard.logic.types.master_detail.desc'), icon: Layers },
      ]
    },
    {
      id: 'projetos',
      title: 'Projetos, Prazos e Cronogramas',
      description: 'Controle visual de tarefas, eventos e progresso.',
      icon: Calendar,
      items: [
        { id: 'kanban', title: t('wizard.logic.types.kanban.title'), desc: t('wizard.logic.types.kanban.desc'), icon: Columns },
        { id: 'timeline', title: t('wizard.logic.types.timeline.title', 'Linha do Tempo / Feed'), desc: t('wizard.logic.types.timeline.desc', 'Visualize registros em uma linha do tempo cronológica com base em uma data.'), icon: History },
        { id: 'gantt', title: t('wizard.logic.types.gantt.title', 'Gráfico de Gantt'), desc: t('wizard.logic.types.gantt.desc', 'Gerencie cronogramas e projetos com um gráfico de Gantt.'), icon: BarChartHorizontal },
        { id: 'scheduler', title: t('wizard.logic.types.scheduler.title', 'Agenda / Calendário'), desc: t('wizard.logic.types.scheduler.desc', 'Agendamentos, prazos, compromissos e tarefas em calendário.'), icon: Calendar },
      ]
    },
    {
      id: 'mapas',
      title: 'Mapeamento, Fluxos e Espacial',
      description: 'Interfaces para exibição geoespacial ou diagramas interligados.',
      icon: Share2,
      items: [
        { id: 'blueprint', title: t('wizard.logic.types.blueprint.title', 'Fluxograma (Blueprint)'), desc: t('wizard.logic.types.blueprint.desc', 'Mapeie processos e fluxos de trabalho interligados dinamicamente.'), icon: Activity },
        { id: 'mapa_mental', title: t('wizard.logic.types.mapa_mental.title'), desc: t('wizard.logic.types.mapa_mental.desc'), icon: Share2 },
        { id: 'map', title: t('wizard.logic.types.map.title', 'Visão de Mapa (Geospatial)'), desc: t('wizard.logic.types.map.desc', 'Visualize registros através de marcadores e coordenadas interativas no mapa.'), icon: Share2 },
      ]
    },
    {
      id: 'outros',
      title: 'Inteligência, Mídia e Outros',
      description: 'Dashboards analíticos, galerias e lógicas customizadas.',
      icon: LayoutGrid,
      items: [
        { id: 'analytics', title: t('wizard.logic.types.analytics.title', 'Dashboard (BI)'), desc: t('wizard.logic.types.analytics.desc', 'Indicadores de desempenho, gráficos e KPIs.'), icon: Layout },
        { id: 'galeria', title: t('wizard.logic.types.galeria.title', 'Galeria / Assets'), desc: t('wizard.logic.types.galeria.desc', 'Galeria de mídias, imagens e documentos com download e redirecionamentos.'), icon: LayoutGrid },
        { id: 'personalizado', title: t('wizard.logic.types.personalizado.title'), desc: t('wizard.logic.types.personalizado.desc'), icon: Settings }
      ]
    }
  ]

  const [expandedCategory, setExpandedCategory] = useState<string | null>(() => {
    if (config.name && config.logic_type) {
      const found = categories.find(c => c.items.some(i => i.id === config.logic_type))
      if (found) return found.id
    }
    return null
  })

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="space-y-2">
        <h2 className="text-xl font-extrabold tracking-tight text-neutral-900 dark:text-white">{t('wizard.logic.title')}</h2>
        <p className="text-neutral-500 dark:text-neutral-400 text-sm">{t('wizard.logic.subtitle')}</p>
      </div>

      <div className="p-4 bg-neutral-50/50 dark:bg-neutral-900/30 rounded-[1.5rem] border border-neutral-200 dark:border-neutral-800 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.logic.screen_name')}</label>
            <input
              required
              autoFocus
              type="text"
              value={config.name}
              onChange={e => {
                const val = e.target.value
                const suggestedSlug = val.toLowerCase()
                  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                  .replace(/[^a-z0-9\s-]/g, '')
                  .trim()
                  .replace(/\s+/g, '-')

                setConfig({
                  ...config,
                  name: val,
                  slug: (!config.slug || config.slug === config.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')) ? suggestedSlug : config.slug
                })
              }}
              placeholder={t('wizard.logic.screen_name_placeholder')}
              className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
            />
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.logic.slug_label')}</label>
            <div className="flex items-center bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus-within:border-indigo-600 transition-all shadow-sm">
              <span className="text-neutral-400 mr-2 font-bold">/</span>
              <input
                type="text"
                value={config.slug}
                onChange={e => setConfig({ ...config, slug: e.target.value.toLowerCase().replace(/\s/g, '-') })}
                placeholder={t('wizard.logic.slug_placeholder')}
                className="w-full bg-transparent outline-none text-sm font-bold"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {categories.map(cat => {
          const isExpanded = expandedCategory === cat.id
          const hasSelectedLogic = cat.items.some(i => i.id === config.logic_type)
          
          return (
            <div key={cat.id} className={cn(
              "rounded-[1.5rem] border-2 overflow-hidden transition-all duration-300",
              isExpanded ? "border-indigo-600 bg-white dark:bg-neutral-950 shadow-xl" : "border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 hover:border-neutral-300 dark:hover:border-neutral-700 cursor-pointer"
            )}>
              {/* Header da Categoria */}
              <div 
                className={cn("p-4 flex items-center justify-between", !isExpanded && "cursor-pointer")}
                onClick={() => setExpandedCategory(isExpanded ? null : cat.id)}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                    isExpanded || hasSelectedLogic ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" : "bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-500"
                  )}>
                    <cat.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-neutral-900 dark:text-white text-sm">{cat.title}</h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">{cat.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {hasSelectedLogic && !isExpanded && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-md">
                      Selecionado
                    </span>
                  )}
                  {isExpanded ? <ChevronUp className="w-5 h-5 text-neutral-400" /> : <ChevronDown className="w-5 h-5 text-neutral-400" />}
                </div>
              </div>

              {/* Grid de Lógicas */}
              {isExpanded && (
                <div className="p-4 pt-0 border-t border-neutral-100 dark:border-neutral-800/50 mt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pt-4">
                    {cat.items.map(t => (
                      <button
                        key={t.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          setConfig({ ...config, logic_type: t.id })
                        }}
                        className={cn(
                          "p-4 rounded-[1.25rem] border-2 text-left transition-all group relative overflow-hidden",
                          config.logic_type === t.id
                            ? 'border-indigo-600 bg-indigo-600/5 shadow-md shadow-indigo-500/10 scale-[1.02]'
                            : 'border-neutral-100 dark:border-neutral-800/50 hover:border-neutral-200 dark:hover:border-neutral-700 bg-white dark:bg-neutral-950/50'
                        )}
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center mb-3 transition-all shadow-sm",
                          config.logic_type === t.id ? 'bg-indigo-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 group-hover:text-indigo-600 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30'
                        )}>
                          <t.icon className="w-4 h-4" />
                        </div>
                        <h4 className="font-bold text-sm mb-1 text-neutral-900 dark:text-white">{t.title}</h4>
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-relaxed font-medium line-clamp-2">{t.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {(config.logic_type.includes('pesquisa') || config.logic_type === 'kanban') && (
        <div className="flex items-center gap-4 p-6 bg-white dark:bg-neutral-950/50 rounded-2xl border border-neutral-200 dark:border-neutral-800 group cursor-pointer hover:border-indigo-500/30 transition-all" onClick={() => setConfig({ ...config, has_arguments: !config.has_arguments })}>
          <div className={cn(
            "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
            config.has_arguments ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-neutral-200 dark:border-neutral-800'
          )}>
            {config.has_arguments && <CheckCircle2 className="w-4 h-4" />}
          </div>
          <span className="text-sm font-bold text-neutral-700 dark:text-neutral-300">{t('wizard.logic.enable_args')}</span>
        </div>
      )}
    </div>
  )
}

function StepTables({ config, setConfig, models }: any) {
  const { t } = useI18n()

  const groupedModels = models.reduce((acc: any, m: any) => {
    const schema = m.db_schema_name || 'public'
    if (!acc[schema]) acc[schema] = []
    acc[schema].push(m)
    return acc
  }, {})

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="space-y-2">
        <h2 className="text-xl font-extrabold tracking-tight text-neutral-900 dark:text-white">{t('wizard.tables.title')}</h2>
        <p className="text-neutral-500 dark:text-neutral-400 text-sm">{t('wizard.tables.subtitle')}</p>
      </div>

      <div className="space-y-10">
        {Object.keys(groupedModels).map((schema) => (
          <div key={schema} className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600 flex items-center gap-2">
              <Database className="w-4 h-4" />
              Banco: {schema}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {groupedModels[schema].map((m: any) => {
                const isSelected = config.selected_models.includes(m.id)
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      const newSelected = isSelected
                        ? config.selected_models.filter((id: string) => id !== m.id)
                        : [...config.selected_models, m.id]
                      
                      // Extrai todos os IDs de campos válidos baseados nas tabelas selecionadas
                      const validFields = models
                        .filter((mod: any) => newSelected.includes(mod.id))
                        .flatMap((mod: any) => mod.fields?.map((f: any) => f.id) || [])

                      setConfig({ 
                        ...config, 
                        selected_models: newSelected,
                        layout_config: {
                          ...config.layout_config,
                          filter_fields: config.layout_config.filter_fields?.filter((id: string) => validFields.includes(id)) || [],
                          grid_fields: config.layout_config.grid_fields?.filter((id: string) => validFields.includes(id)) || [],
                          form_fields: config.layout_config.form_fields?.filter((id: string) => validFields.includes(id)) || [],
                          master_model_id: newSelected.includes(config.layout_config.master_model_id) ? config.layout_config.master_model_id : '',
                          joins: [] // Reseta os joins para forçar a re-sugestão na Etapa 3
                        }
                      })
                    }}
                    className={cn(
                      "p-4 rounded-[1.5rem] border-2 text-left transition-all relative group hover:-translate-y-1",
                      isSelected
                        ? 'border-indigo-600 bg-indigo-600/5 shadow-xl shadow-indigo-500/10'
                        : 'border-neutral-100 dark:border-neutral-800/50 hover:border-neutral-200 dark:hover:border-neutral-700 bg-white dark:bg-neutral-900/30'
                    )}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full transition-colors ${isSelected ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 dark:group-hover:bg-indigo-900/30 dark:group-hover:text-indigo-400'}`}>
                        <Database className="w-3 h-3" />
                        {m.db_schema_name || 'public'}
                      </div>
                      {isSelected ? (
                        <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-indigo-500/40"><CheckCircle2 className="w-4 h-4" /></div>
                      ) : (
                        <div className="w-6 h-6 rounded-full border-2 border-neutral-200 dark:border-neutral-700 group-hover:border-indigo-300 transition-colors"></div>
                      )}
                    </div>
                    <h4 className="font-bold text-base text-neutral-900 dark:text-white leading-tight">{m.display_name || m.db_table_name}</h4>
                    <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono mt-1 uppercase tracking-widest block">{m.db_table_name}</p>
                    {m.description && (
                      <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-2 line-clamp-2 leading-normal border-t border-neutral-100 dark:border-neutral-800/40 pt-1.5">
                        {m.description}
                      </p>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      {config.selected_models.length > 1 && (
        <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-600 dark:text-amber-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-[11px] font-bold leading-relaxed">{t('wizard.tables.selected_warning').replace('{count}', config.selected_models.length.toString())}</p>
        </div>
      )}
    </div>
  )
}

function StepLayout({ config, setConfig, models, enumerations = [] }: any) {
  const { t } = useI18n()
  const { toast } = useToast()

  function formatLabelText(text: string) {
    if (!text) return ''
    if (text.toLowerCase() === 'id') return 'ID'
    let formatted = text.replace(/_id$/i, '').replace(/Id$/i, '')
    if (formatted.trim() === '') formatted = text
    formatted = formatted.replace(/_/g, ' ')
    formatted = formatted.replace(/([a-z])([A-Z])/g, '$1 $2')
    return formatted.replace(/\w\S*/g, (txt) => {
      return txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
    }).trim()
  }

  function getFormattedFieldName(id: string) {
    for (const m of models) {
      const f = m.fields?.find((f: any) => f.id === id)
      if (f) {
        return formatLabelText(f.display_name || f.db_column_name)
      }
    }
    return formatLabelText(id)
  }

  function createDefaultFieldMeta(fid: string) {
    return {
      label: { text: getFormattedFieldName(fid), font: 'Inter', size: '10px', color: '' },
      content: { font: 'Inter', size: '12px', color: '', mask: '', required: false, readonly: false },
      component: { type: 'text', rows: 3, width: '100%', options_type: 'fixed', fixed_options: '', rel_table: '', rel_label: '', rel_value: '' },
      viacep: { enabled: false, logradouro: '', bairro: '', cidade: '', uf: '' }
    }
  }
  const [expandedZones, setExpandedZones] = useState<Record<string, boolean>>({
    masterDetail: true,
    joins: true,
    zone01: true,
    zone02: true,
    zone03: true
  })
  const toggleZone = (zone: string) => setExpandedZones(prev => ({ ...prev, [zone]: !prev[zone] }))

  const [editingFieldId, setEditingFieldId] = useState<string | null>(null)
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editingFieldZone, setEditingFieldZone] = useState<string | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [drawerActiveTab, setDrawerActiveTab] = useState<'geral' | 'estilos'>('geral')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [collapsedTables, setCollapsedTables] = useState<Record<string, boolean>>({})
  const [fieldSearchTerm, setFieldSearchTerm] = useState('')
  const dragControls = useDragControls()
  
  const [editingWidget, setEditingWidget] = useState<any>(null)
  const [isWidgetModalOpen, setIsWidgetModalOpen] = useState(false)

  const handleAddWidget = () => {
    setEditingWidget({
      id: Math.random().toString(36).substr(2, 9),
      title: 'Novo Widget',
      type: 'kpi',
      model_id: config.selected_models[0] || '',
      field: '',
      calc: 'COUNT',
      group_by: '',
      width: 'third',
      joins: []
    })
    setIsWidgetModalOpen(true)
  }

  const handleSaveWidget = (updatedWidget: any) => {
    const currentWidgets = config.layout_config.analytics_config?.widgets || []
    const exists = currentWidgets.find((w: any) => w.id === updatedWidget.id)
    
    let newWidgets
    if (exists) {
      newWidgets = currentWidgets.map((w: any) => w.id === updatedWidget.id ? updatedWidget : w)
    } else {
      newWidgets = [...currentWidgets, updatedWidget]
    }

    setConfig({
      ...config,
      layout_config: {
        ...config.layout_config,
        analytics_config: { ...config.layout_config.analytics_config, widgets: newWidgets }
      }
    })
    setIsWidgetModalOpen(false)
    setEditingWidget(null)
  }

  const handleDeleteWidget = (id: string) => {
    const newWidgets = (config.layout_config.analytics_config?.widgets || []).filter((w: any) => w.id !== id)
    setConfig({
      ...config,
      layout_config: {
        ...config.layout_config,
        analytics_config: { ...config.layout_config.analytics_config, widgets: newWidgets }
      }
    })
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragStart = (event: any) => {
    setActiveId(String(event.active.id))
  }

  const handleDragEnd = (event: any) => {
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    const activeIdStr = String(active.id)
    const overIdStr = String(over.id)

    if (activeIdStr.startsWith('source-') || activeIdStr.startsWith('table-source-')) {
      const isTable = activeIdStr.startsWith('table-source-')
      const id = activeIdStr.replace(isTable ? 'table-source-' : 'source-', '')
      
      let targetZone: 'filter_fields' | 'grid_fields' | 'form_fields' | null = null
      if (overIdStr === 'droppable-filter' || overIdStr.startsWith('filter-')) targetZone = 'filter_fields'
      else if (overIdStr === 'droppable-grid' || overIdStr.startsWith('grid-')) targetZone = 'grid_fields'
      else if (overIdStr === 'droppable-form' || overIdStr.startsWith('form-') || overIdStr.startsWith('droppable-form-')) targetZone = 'form_fields'

      if (targetZone) {
        if (isTable) {
          const model = models.find((m: any) => m.id === id)
          if (!model) return

          // Filtra os campos que possuem permissão para entrar na zona correspondente
          const allowedFields = model.fields.filter((f: any) => {
            if (targetZone === 'grid_fields' && f.is_visible_in_list === false) return false
            if (targetZone === 'form_fields' && f.is_visible_in_form === false) return false
            if (targetZone === 'filter_fields' && f.is_searchable === false) return false
            return true
          })

          const fieldIdsToAdd = allowedFields.map((f: any) => f.id)
          const currentFields = [...config.layout_config[targetZone]]
          const newFields = [...currentFields]
          let addedCount = 0

          fieldIdsToAdd.forEach((fid: string) => {
            if (!newFields.includes(fid)) {
              if (targetZone === 'filter_fields' && (!config.has_arguments || config.logic_type === 'cadastro')) return
              if (targetZone === 'form_fields' && config.logic_type === 'pesquisa') return
              newFields.push(fid)
              addedCount++
            }
          })

          if (addedCount > 0) {
            setConfig({
              ...config,
              layout_config: {
                ...config.layout_config,
                [targetZone]: newFields
              }
            })
            toast(`${addedCount} campos permitidos da tabela "${model.display_name || model.db_table_name}" adicionados com sucesso!`, 'success')
          } else {
            toast('Nenhum novo campo permitido pôde ser adicionado a esta zona.', 'info')
          }
        } else {
          const fieldId = id
          
          // Achar o campo no modelo para validar
          let fieldObj: any = null
          for (const m of models) {
            fieldObj = m.fields.find((f: any) => f.id === fieldId)
            if (fieldObj) break
          }

          if (fieldObj) {
            if (targetZone === 'grid_fields' && fieldObj.is_visible_in_list === false) {
              toast(`O campo "${fieldObj.display_name || fieldObj.db_column_name}" está configurado como não visível no grid.`, 'error')
              return
            }
            if (targetZone === 'form_fields' && fieldObj.is_visible_in_form === false) {
              toast(`O campo "${fieldObj.display_name || fieldObj.db_column_name}" está configurado como não visível no formulário.`, 'error')
              return
            }
            if (targetZone === 'filter_fields' && fieldObj.is_searchable === false) {
              toast(`O campo "${fieldObj.display_name || fieldObj.db_column_name}" está configurado como não pesquisável (não visível no filtro).`, 'error')
              return
            }
          }

          const currentFields = [...config.layout_config[targetZone]]
          if (!currentFields.includes(fieldId)) {
            if (targetZone === 'filter_fields' && (!config.has_arguments || config.logic_type === 'cadastro')) return
            if (targetZone === 'form_fields' && config.logic_type === 'pesquisa') return

            currentFields.push(fieldId)
            setConfig({
              ...config,
              layout_config: {
                ...config.layout_config,
                [targetZone]: currentFields
              }
            })
            toast(t('common.success', 'Campo adicionado com sucesso!'), 'success')
          } else {
            toast(t('common.info', 'Este campo já está nesta zona.'), 'info')
          }
        }
      }
      return
    }

    if (active.id === over.id) return

    const isWidget = activeIdStr.startsWith('widget-')

    if (isWidget) {
      const activeId = activeIdStr.replace('widget-', '')
      const overId = overIdStr.replace('widget-', '')
      setConfig((prev: any) => {
        const widgets = [...(prev.layout_config.analytics_config?.widgets || [])]
        const oldIndex = widgets.findIndex(w => w.id === activeId)
        const newIndex = widgets.findIndex(w => w.id === overId)
        if (oldIndex === -1 || newIndex === -1) return prev
        return {
          ...prev,
          layout_config: {
            ...prev.layout_config,
            analytics_config: {
              ...prev.layout_config.analytics_config,
              widgets: arrayMove(widgets, oldIndex, newIndex)
            }
          }
        }
      })
      return
    }

    const isFilter = activeIdStr.startsWith('filter-')
    const isGrid = activeIdStr.startsWith('grid-')
    const isForm = activeIdStr.startsWith('form-')

    const listKey = isFilter ? 'filter_fields' : isGrid ? 'grid_fields' : 'form_fields'
    
    const activeId = activeIdStr.replace(/^(filter-|grid-|form-)/, '')
    const overId = overIdStr.replace(/^(filter-|grid-|form-)/, '')

    setConfig((prev: any) => {
      const list = [...prev.layout_config[listKey as keyof typeof prev.layout_config] as string[]]
      const oldIndex = list.indexOf(activeId)
      const newIndex = list.indexOf(overId)
      if (oldIndex === -1 || newIndex === -1) return prev
      return {
        ...prev,
        layout_config: {
          ...prev.layout_config,
          [listKey]: arrayMove(list, oldIndex, newIndex)
        }
      }
    })
  }

  const relationalTree = (() => {
    const masterId = config.layout_config.master_model_id || config.selected_models[0]
    const masterModel = models.find((m: any) => m.id === masterId)
    if (!masterModel) return []

    const joins = config.layout_config.joins || []
    const visited = new Set<string>([masterModel.db_table_name])

    const getNode = (model: any): any => {
      const children: any[] = []
      joins.forEach((j: any) => {
        if (j.from === model.db_table_name && !visited.has(j.to)) {
          const childModel = models.find((m: any) => m.db_table_name === j.to)
          if (childModel) {
            visited.add(j.to)
            children.push(getNode(childModel))
          }
        }
      })
      return { ...model, children }
    }

    const tree = [getNode(masterModel)]
    models.filter((m: any) => config.selected_models.includes(m.id) && !visited.has(m.db_table_name)).forEach((m: any) => {
       visited.add(m.db_table_name)
       tree.push(getNode(m))
    })
    return tree
  })()

  const flattenTree = (nodes: any[]): any[] => {
    let flat: any[] = []
    nodes.forEach(node => {
      flat.push(node)
      if (node.children) flat = flat.concat(flattenTree(node.children))
    })
    return flat
  }
  const orderedModels = config.logic_type === 'analytics' ? models : flattenTree(relationalTree)

  const renderModelZone = (model: any, depth: number = 0, index: number = 0) => {
    const isMaster = depth === 0 && index === 0
    const fieldsOfThisModel = config.layout_config.form_fields.filter((fid: string) => 
      model.fields.some((f: any) => f.id === fid)
    )

    const tabsMeta = (config.layout_config as any).fields_metadata?.['form-TABS'] || (config.layout_config as any).fields_metadata?.['TABS']
    const tabStyles = {
      fontFamily: tabsMeta?.label?.font?.replace(' (Padrão)', ''),
      fontSize: tabsMeta?.label?.size ? (tabsMeta.label.size.includes('px') ? tabsMeta.label.size : `${tabsMeta.label.size}px`) : undefined,
      color: tabsMeta?.label?.color || undefined,
    }

    return (
      <div key={`${model.id}-${depth}-${index}`} className={cn("space-y-4", depth > 0 && "ml-8 border-l-2 border-dashed border-amber-200 dark:border-amber-900/30 pl-6 pb-4")}>
        <div className="flex items-center justify-between ml-1 pr-6">
          <div className="flex items-center gap-2">
            <div className={cn("w-1.5 h-4 rounded-full shadow-sm", isMaster ? "bg-amber-600" : "bg-amber-400")}></div>
            <div className="flex items-center gap-2 group relative">
              {isMaster ? (
                <input
                  type="text"
                  placeholder={`Mestre: ${model.display_name || model.db_table_name}`}
                  value={(config.layout_config as any).master_tab_title ?? `Mestre: ${model.display_name || model.db_table_name}`}
                  onChange={e => setConfig({
                    ...config,
                    layout_config: {
                      ...config.layout_config,
                      master_tab_title: e.target.value
                    }
                  })}
                  style={tabStyles}
                  className="bg-transparent border-none outline-none font-black tracking-widest text-neutral-600 dark:text-neutral-400 placeholder:text-neutral-300 dark:placeholder:text-neutral-700 w-[250px] hover:bg-neutral-100 dark:hover:bg-neutral-900 focus:bg-white dark:focus:bg-neutral-900 focus:ring-2 focus:ring-amber-500/20 rounded px-1.5 py-0.5 transition-all"
                />
              ) : (
                <input
                  type="text"
                  placeholder={`${depth === 1 ? 'Detalhe' : 'Sub-Detalhe'}: ${model.display_name || model.db_table_name}`}
                  value={(config.layout_config as any).details_tab_titles?.[model.id] ?? `${depth === 1 ? 'Detalhe' : 'Sub-Detalhe'}: ${model.display_name || model.db_table_name}`}
                  onChange={e => {
                    const currentTitles = (config.layout_config as any).details_tab_titles || {}
                    setConfig({
                      ...config,
                      layout_config: {
                        ...config.layout_config,
                        details_tab_titles: {
                          ...currentTitles,
                          [model.id]: e.target.value
                        }
                      }
                    })
                  }}
                  style={tabStyles}
                  className="bg-transparent border-none outline-none font-black tracking-widest text-neutral-600 dark:text-neutral-400 placeholder:text-neutral-300 dark:placeholder:text-neutral-700 w-[250px] hover:bg-neutral-100 dark:hover:bg-neutral-900 focus:bg-white dark:focus:bg-neutral-900 focus:ring-2 focus:ring-amber-500/20 rounded px-1.5 py-0.5 transition-all"
                />
              )}
              <button
                type="button"
                title="Configurar propriedades das abas"
                onClick={() => { setEditingFieldId('TABS'); setEditingTabId(isMaster ? 'master' : model.id); setEditingFieldZone('form'); setDrawerActiveTab('estilos'); setIsDrawerOpen(true); }}
                className="opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 p-1 bg-white dark:bg-neutral-900 rounded border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-indigo-600 hover:border-indigo-200 shadow-sm z-10"
              >
                <Settings2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          {!isMaster && (
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-950 p-0.5 rounded-lg border border-neutral-200 dark:border-neutral-800">
                {[
                  { id: 'modal', label: 'Modal', icon: Maximize2 },
                  { id: 'drawer', label: 'Drawer', icon: Layout }
                ].map(opt => {
                  const currentType = (config.layout_config as any).details_interface_types?.[model.id] || 'modal'
                  const isActive = currentType === opt.id
                  return (
                    <button
                      key={opt.id}
                      onClick={() => {
                        const currentTypes = (config.layout_config as any).details_interface_types || {}
                        setConfig({
                          ...config,
                          layout_config: {
                            ...config.layout_config,
                            details_interface_types: {
                              ...currentTypes,
                              [model.id]: opt.id
                            }
                          }
                        })
                      }}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1 rounded-md text-[8px] font-black uppercase tracking-widest transition-all",
                        isActive
                          ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20'
                          : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'
                      )}
                    >
                      <opt.icon className="w-2.5 h-2.5" />
                      {opt.label}
                    </button>
                  )
                })}
              </div>

            <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-950 p-0.5 rounded-lg border border-neutral-200 dark:border-neutral-800 ml-2">
              <button
                onClick={() => {
                  const currentInlines = (config.layout_config as any).details_inline_types || {}
                  const isCurrentlyInline = currentInlines[model.id] !== false // Default true
                  
                  setConfig({
                    ...config,
                    layout_config: {
                      ...config.layout_config,
                      details_inline_types: {
                        ...currentInlines,
                        [model.id]: !isCurrentlyInline
                      }
                    }
                  })
                }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-md text-[8px] font-black uppercase tracking-widest transition-all",
                  ((config.layout_config as any).details_inline_types?.[model.id] !== false)
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                    : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'
                )}
              >
                <div className={cn(
                  "w-1 h-1 rounded-full",
                  ((config.layout_config as any).details_inline_types?.[model.id] !== false) ? "bg-white" : "bg-neutral-400"
                )} />
                Na lista
              </button>
            </div>
          </div>
        )}
        </div>

        <DroppableZone 
          id={`droppable-form-${model.id}`} 
          className="grid grid-cols-7 gap-3 min-h-[100px] p-6 bg-neutral-50 dark:bg-neutral-950/30 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] items-start transition-all hover:bg-neutral-100/50 dark:hover:bg-neutral-900/40"
        >
          {fieldsOfThisModel.length === 0 ? (
            <div className="col-span-7 flex flex-col items-center justify-center py-4 space-y-2 opacity-50">
               <Plus className="w-4 h-4 text-neutral-400" />
               <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Arraste campos de "{model.display_name || model.db_table_name}" para cá</p>
            </div>
          ) : (
            <SortableContext items={fieldsOfThisModel.map((id: string) => `form-${id}`)} strategy={rectSortingStrategy}>
              {fieldsOfThisModel.map((id: string) => (
                <SortableFieldChip
                  key={`form-${id}`}
                  id={`form-${id}`}
                  itemValue={id}
                  toggleField={toggleField}
                  zoneType="form"
                  onEdit={() => { setEditingFieldId(id); setEditingFieldZone('form'); setIsDrawerOpen(true); }}
                >
                   <span
                    style={{
                      fontFamily: getFieldMeta(id, 'form').label?.font,
                      fontSize: getFieldMeta(id, 'form').label?.size,
                      color: getFieldMeta(id, 'form').label?.color || undefined
                    }}
                    className={cn(
                      "text-[10px] font-black tracking-wider",
                      !getFieldMeta(id, 'form').label?.font && "uppercase"
                    )}
                  >
                    {getFieldMeta(id, 'form').label?.text || getFieldName(id)}
                  </span>
                </SortableFieldChip>
              ))}
            </SortableContext>
          )}
        </DroppableZone>

        {model.children && model.children.length > 0 && (
          <div className="space-y-6 pt-2">
            {model.children.map((child: any, cIdx: number) => renderModelZone(child, depth + 1, cIdx))}
          </div>
        )}
      </div>
    )
  }

  const toggleField = (fieldId: string, zone: 'filter_fields' | 'grid_fields' | 'form_fields') => {
    const currentFields = [...config.layout_config[zone]]
    const index = currentFields.indexOf(fieldId)

    if (index > -1) {
      currentFields.splice(index, 1)
    } else {
      currentFields.push(fieldId)
    }

    setConfig({
      ...config,
      layout_config: {
        ...config.layout_config,
        [zone]: currentFields
      }
    })
  }


  const getFieldName = (id: string) => {
    for (const m of models) {
      const f = m.fields.find((f: any) => f.id === id)
      if (f) {
        const tableName = m.display_name || m.db_table_name
        const fieldName = f.display_name || f.db_column_name
        return `${tableName}.${fieldName}`
      }
    }
    return id
  }

  const getFieldMeta = (fid: string, zone?: string | null) => {
    const specificKey = zone ? `${zone}-${fid}` : null
    const meta = (specificKey ? config.layout_config.fields_metadata[specificKey] : null) || config.layout_config.fields_metadata[fid]
    
    if (meta) return meta

    return createDefaultFieldMeta(fid)
  }

  const currentFieldMeta = editingFieldId ? getFieldMeta(editingFieldId, editingFieldZone) : null

  const updateMeta = (section: 'label' | 'content' | 'component' | 'viacep', key: string, value: any) => {
    if (!editingFieldId) return
    
    // O usuário solicitou que todas as instâncias do mesmo campo compartilhem as configurações.
    // Então, ao atualizar uma propriedade, atualizamos todas as chaves deste field.
    
    const baseMeta = getFieldMeta(editingFieldId, null) // get current base meta or default
    const newMeta = { ...currentFieldMeta } // current meta being edited
    newMeta[section] = { ...newMeta[section], [key]: value }

    const newFieldsMetadata = { ...config.layout_config.fields_metadata }
    
    // 1. Atualizar a chave base (para servir de herança quando arrastar para uma nova zona)
    newFieldsMetadata[editingFieldId] = newMeta

    // 2. Atualizar as zonas existentes
    const zones = ['form', 'grid', 'filter']
    zones.forEach(z => {
      const zKey = `${z}-${editingFieldId}`
      if (newFieldsMetadata[zKey] !== undefined || editingFieldZone === z) {
         newFieldsMetadata[zKey] = newMeta
      }
    })

    setConfig({
      ...config,
      layout_config: {
        ...config.layout_config,
        fields_metadata: newFieldsMetadata
      }
    })
  }

  const handleApplyStylesToZone = () => {
    if (!editingFieldId || !editingFieldZone) return
    
    // Identificar os campos da zona atual
    const zoneFields = editingFieldZone === 'filter' ? config.layout_config.filter_fields 
      : editingFieldZone === 'grid' ? config.layout_config.grid_fields
      : editingFieldZone === 'form' ? config.layout_config.form_fields
      : []

    if (!zoneFields.length) return

    const newFieldsMetadata = { ...(config.layout_config.fields_metadata || {}) }
    const stylesToCopyLabel = { ...currentFieldMeta.label }
    delete stylesToCopyLabel.text // Não sobrescrever o texto de exibição

    const stylesToCopyContent = { ...currentFieldMeta.content }

    zoneFields.forEach((fieldId: string) => {
      const metaKey = `${editingFieldZone}-${fieldId}`
      const existingMeta = newFieldsMetadata[metaKey] || { label: {}, content: {}, component: {} }
      
      newFieldsMetadata[metaKey] = {
        ...existingMeta,
        label: {
          ...existingMeta.label,
          ...stylesToCopyLabel
        },
        content: {
          ...existingMeta.content,
          ...stylesToCopyContent
        }
      }
    })

    setConfig({
      ...config,
      layout_config: {
        ...config.layout_config,
        fields_metadata: newFieldsMetadata
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between xl:pr-96">
        <div className="space-y-2">
          <h2 className="text-xl font-extrabold tracking-tight text-neutral-900 dark:text-white">{t('wizard.layout.title')}</h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">{t('wizard.layout.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowResetConfirm(true)}
          className="flex items-center gap-3 px-8 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-red-500 bg-white dark:bg-neutral-900 border-2 border-red-100 dark:border-red-900/30 rounded-2xl shadow-xl shadow-red-500/5 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all hover:scale-105 active:scale-95 group shrink-0"
        >
          <RotateCcw className="w-4 h-4 transition-transform group-hover:rotate-[-180deg] duration-700" />
          {t('wizard.layout.reset_formatting')}
        </button>
      </div>

      <Modal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        title={t('wizard.layout.reset_formatting')}
      >
        <div className="space-y-6">
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 rounded-2xl flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-xs text-red-700 dark:text-red-400 font-medium leading-relaxed">
              {t('wizard.layout.reset_confirm')}
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => setShowResetConfirm(false)}
              className="flex-1 px-4 py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white rounded-2xl font-bold text-xs uppercase tracking-widest transition-all"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={() => {
                const newFieldsMeta: Record<string, any> = {}
                const allFieldIds = new Set([
                  ...(config.layout_config.form_fields || []),
                  ...(config.layout_config.grid_fields || []),
                  ...(config.layout_config.filter_fields || []),
                ])
                allFieldIds.forEach(fid => {
                  newFieldsMeta[fid] = createDefaultFieldMeta(fid)
                })

                setConfig({
                  ...config,
                  layout_config: {
                    ...config.layout_config,
                    fields_metadata: newFieldsMeta
                  }
                })
                setShowResetConfirm(false)
              }}
              className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg shadow-red-500/20"
            >
              {t('wizard.layout.reset_formatting')}
            </button>
          </div>
        </div>
      </Modal>

      <DndContext 
        sensors={sensors} 
        collisionDetection={rectIntersection} 
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-col xl:flex-row-reverse gap-10 relative">
          <div className="w-full xl:w-80 shrink-0">
            <motion.div 
              drag
              dragControls={dragControls}
              dragListener={false}
              dragMomentum={false}
              className="bg-white dark:bg-neutral-900 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 flex flex-col xl:fixed xl:w-80 xl:h-[600px] xl:top-64 xl:right-12 z-30 shadow-2xl shadow-indigo-500/10 overflow-hidden ring-1 ring-black/5 transition-colors duration-500 resize both min-w-[280px] min-h-[400px] max-w-[500px]"
            >
            <div 
              onPointerDown={(e) => dragControls.start(e)}
              className="p-5 border-b border-neutral-200 dark:border-neutral-800 cursor-grab active:cursor-grabbing hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors group flex items-center justify-between"
            >
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 group-hover:text-indigo-500 transition-colors">{t('wizard.layout.available_fields')}</h3>
              <div className="flex gap-0.5">
                {[1,2,3].map(i => <div key={i} className="w-1 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700 group-hover:bg-indigo-400"></div>)}
              </div>
            </div>
            
            {/* Filtro de Campos */}
            <div className="px-4 py-3 bg-neutral-50 dark:bg-neutral-950/50 border-b border-neutral-100 dark:border-neutral-800">
              <div className="relative group">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-indigo-500 transition-all" />
                <input 
                  type="text"
                  placeholder="Pesquisar tabelas ou campos..."
                  value={fieldSearchTerm}
                  onChange={e => setFieldSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-[10px] font-bold outline-none focus:border-indigo-500 transition-all shadow-sm"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {orderedModels
                .filter((m: any) => {
                  if (!fieldSearchTerm) return true
                  const term = fieldSearchTerm.toLowerCase()
                  const tableMatch = (m.display_name || m.db_table_name || '').toLowerCase().includes(term)
                  const fieldMatch = m.fields.some((f: any) => (f.display_name || f.db_column_name || '').toLowerCase().includes(term))
                  return tableMatch || fieldMatch
                })
                .map((m: any) => {
                  const isCollapsed = collapsedTables[m.id]
                  // Se houver busca e a tabela der match via campo, forçamos a expansão para mostrar os campos
                  const forceExpand = fieldSearchTerm && m.fields.some((f: any) => (f.display_name || f.db_column_name || '').toLowerCase().includes(fieldSearchTerm.toLowerCase()))
                  const actuallyCollapsed = isCollapsed && !forceExpand

                return (
                  <div key={`sidebar-table-${m.id}`} className="border-b border-neutral-100 dark:border-neutral-800/50 last:border-0">
                    <button
                      onClick={() => setCollapsedTables(prev => ({ ...prev, [m.id]: !prev[m.id] }))}
                      className="w-full p-4 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-1 h-4 rounded-full transition-all",
                          actuallyCollapsed ? "bg-neutral-300" : "bg-indigo-500"
                        )}></div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-700 dark:text-neutral-300">
                          {m.display_name || m.db_table_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[9px] font-black text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">{m.fields.length}</span>
                        {actuallyCollapsed ? <ChevronDown className="w-3.5 h-3.5 text-neutral-400" /> : <ChevronUp className="w-3.5 h-3.5 text-indigo-500" />}
                      </div>
                    </button>
                    
                    {!actuallyCollapsed && (
                      <div className="p-4 pt-0 grid grid-cols-1 gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                        <DraggableItem id={`table-source-${m.id}`} className="bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 p-2.5 rounded-xl flex items-center justify-between group cursor-grab active:cursor-grabbing hover:border-indigo-300 transition-all">
                           <div className="flex items-center gap-2">
                             <Table className="w-3 h-3 text-indigo-500" />
                             <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Adicionar Tabela</span>
                           </div>
                           <Plus className="w-3 h-3 text-indigo-400 group-hover:scale-125 transition-transform" />
                        </DraggableItem>

                        <div className="h-px bg-neutral-100 dark:bg-neutral-800 my-1"></div>

                        {m.fields
                          .filter((f: any) => {
                             if (!fieldSearchTerm) return true
                             const term = fieldSearchTerm.toLowerCase()
                             return (f.display_name || f.db_column_name || '').toLowerCase().includes(term) || (m.display_name || m.db_table_name || '').toLowerCase().includes(term)
                          })
                          .map((f: any) => (
                          <DraggableItem key={`source-${f.id}`} id={`source-${f.id}`} className="bg-neutral-50 dark:bg-neutral-950/50 border border-neutral-100 dark:border-neutral-800/50 p-2.5 rounded-xl flex items-center justify-between group cursor-grab active:cursor-grabbing hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all">
                            <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-400 truncate pr-2">
                              {f.display_name || f.db_column_name}
                            </span>
                            <Plus className="w-3 h-3 text-neutral-300 group-hover:text-indigo-500 group-hover:scale-125 transition-all" />
                          </DraggableItem>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            </motion.div>
          </div>
          
          <div className="flex-1 space-y-10 min-w-0">
          {/* ZONA: KANBAN CONFIG */}
          {config.logic_type === 'kanban' && (
            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-[1.5rem] space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/20">
                    <Columns className="w-4 h-4" />
                  </div>
                  <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em]">{t('wizard.layout.kanban.title')}</h4>
                </div>
              </div>
              
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.kanban.group_field')}</label>
                <select
                  value={config.layout_config.kanban_group_field || ''}
                  onChange={e => setConfig({
                    ...config,
                    layout_config: { ...config.layout_config, kanban_group_field: e.target.value }
                  })}
                  className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
                >
                  <option value="">{t('wizard.layout.kanban.group_placeholder')}</option>
                  {orderedModels.flatMap((m: any) => m.fields).map((f: any) => (
                    <option key={`opt-kanban-${f.id}`} value={f.id}>
                      {getFieldName(f.id)} ({f.data_type})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-neutral-400 font-medium italic ml-1">{t('wizard.layout.kanban.group_desc')}</p>
              </div>
            </div>
          )}

          {/* ZONA: SCHEDULER CONFIG */}
          {config.logic_type === 'scheduler' && (
            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-[1.5rem] space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/20">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em]">Configuração do Calendário</h4>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Campo do Título</label>
                  <select
                    value={config.layout_config.scheduler_config?.title_field || ''}
                    onChange={e => setConfig({
                      ...config,
                      layout_config: {
                        ...config.layout_config,
                        scheduler_config: { ...config.layout_config.scheduler_config, title_field: e.target.value }
                      }
                    })}
                    className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
                  >
                    <option value="">Selecione o campo de título...</option>
                    {orderedModels.flatMap((m: any) => m.fields).map((f: any) => (
                      <option key={`opt-sched-title-${f.id}`} value={f.id}>
                        {getFieldName(f.id)} ({f.data_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Campo de Data de Início</label>
                  <select
                    value={config.layout_config.scheduler_config?.start_date_field || ''}
                    onChange={e => setConfig({
                      ...config,
                      layout_config: {
                        ...config.layout_config,
                        scheduler_config: { ...config.layout_config.scheduler_config, start_date_field: e.target.value }
                      }
                    })}
                    className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
                  >
                    <option value="">Selecione o campo de data de início...</option>
                    {orderedModels.flatMap((m: any) => m.fields).filter((f: any) => f.data_type.includes('date') || f.data_type.includes('timestamp')).map((f: any) => (
                      <option key={`opt-sched-start-${f.id}`} value={f.id}>
                        {getFieldName(f.id)} ({f.data_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Campo de Data de Fim (Opcional)</label>
                  <select
                    value={config.layout_config.scheduler_config?.end_date_field || ''}
                    onChange={e => setConfig({
                      ...config,
                      layout_config: {
                        ...config.layout_config,
                        scheduler_config: { ...config.layout_config.scheduler_config, end_date_field: e.target.value }
                      }
                    })}
                    className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
                  >
                    <option value="">Nenhum (Evento de data única)</option>
                    {orderedModels.flatMap((m: any) => m.fields).filter((f: any) => f.data_type.includes('date') || f.data_type.includes('timestamp')).map((f: any) => (
                      <option key={`opt-sched-end-${f.id}`} value={f.id}>
                        {getFieldName(f.id)} ({f.data_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Campo de Cor/Categoria (Opcional)</label>
                  <select
                    value={config.layout_config.scheduler_config?.color_field || ''}
                    onChange={e => setConfig({
                      ...config,
                      layout_config: {
                        ...config.layout_config,
                        scheduler_config: { ...config.layout_config.scheduler_config, color_field: e.target.value }
                      }
                    })}
                    className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
                  >
                    <option value="">Nenhum (Cor padrão indigo)</option>
                    {orderedModels.flatMap((m: any) => m.fields).map((f: any) => (
                      <option key={`opt-sched-color-${f.id}`} value={f.id}>
                        {getFieldName(f.id)} ({f.data_type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}


          {/* ZONA: TIMELINE CONFIG */}
          {config.logic_type === 'timeline' && (
            <div className="p-5 bg-indigo-50/30 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/30 rounded-[1.5rem] space-y-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/20">
                    <History className="w-4 h-4" />
                  </div>
                  <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em]">{t('wizard.layout.timeline.title', 'Configuração da Linha do Tempo')}</h4>
                </div>
              </div>
              
              {/* Subcard 1: Mapeamento de Dados */}
              <div className="p-4 bg-white dark:bg-neutral-900/70 border border-neutral-200/60 dark:border-neutral-800/60 rounded-2xl space-y-4 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <Database className="w-4 h-4 text-indigo-500" />
                  <span className="text-[10px] font-black uppercase text-neutral-700 dark:text-neutral-300 tracking-wider">Mapeamento de Dados</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.timeline.title_field', 'Campo de Título')}</label>
                    <select
                      value={(config.layout_config as any).timeline_config?.title_field || ''}
                      onChange={e => setConfig({
                        ...config,
                        layout_config: {
                          ...config.layout_config,
                          timeline_config: { ...(config.layout_config as any).timeline_config, title_field: e.target.value }
                        }
                      })}
                      className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
                    >
                      <option value="">Selecione o campo de título...</option>
                      {orderedModels.flatMap((m: any) => m.fields).map((f: any) => (
                        <option key={`opt-tl-title-${f.id}`} value={f.id}>
                          {getFieldName(f.id)} ({f.data_type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.timeline.date_field', 'Campo de Data')}</label>
                    <select
                      value={(config.layout_config as any).timeline_config?.date_field || ''}
                      onChange={e => setConfig({
                        ...config,
                        layout_config: {
                          ...config.layout_config,
                          timeline_config: { ...(config.layout_config as any).timeline_config, date_field: e.target.value }
                        }
                      })}
                      className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
                    >
                      <option value="">Selecione a data...</option>
                      {orderedModels.flatMap((m: any) => m.fields).filter((f: any) => f.data_type.includes('date') || f.data_type.includes('timestamp')).map((f: any) => (
                        <option key={`opt-tl-date-${f.id}`} value={f.id}>
                          {getFieldName(f.id)} ({f.data_type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.timeline.desc_field', 'Campo de Descrição (Opcional)')}</label>
                    <select
                      value={(config.layout_config as any).timeline_config?.desc_field || ''}
                      onChange={e => setConfig({
                        ...config,
                        layout_config: {
                          ...config.layout_config,
                          timeline_config: { ...(config.layout_config as any).timeline_config, desc_field: e.target.value }
                        }
                      })}
                      className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
                    >
                      <option value="">Nenhum</option>
                      {orderedModels.flatMap((m: any) => m.fields).map((f: any) => (
                        <option key={`opt-tl-desc-${f.id}`} value={f.id}>
                          {getFieldName(f.id)} ({f.data_type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.timeline.icon_field', 'Campo de Ícone/Status (Opcional)')}</label>
                    <select
                      value={(config.layout_config as any).timeline_config?.icon_field || ''}
                      onChange={e => setConfig({
                        ...config,
                        layout_config: {
                          ...config.layout_config,
                          timeline_config: { ...(config.layout_config as any).timeline_config, icon_field: e.target.value }
                        }
                      })}
                      className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
                    >
                      <option value="">Nenhum</option>
                      {orderedModels.flatMap((m: any) => m.fields).map((f: any) => (
                        <option key={`opt-tl-icon-${f.id}`} value={f.id}>
                          {getFieldName(f.id)} ({f.data_type})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Subcard 2: Estilo e Comportamento */}
              <div className="p-4 bg-white dark:bg-neutral-900/70 border border-neutral-200/60 dark:border-neutral-800/60 rounded-2xl space-y-4 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <Settings2 className="w-4 h-4 text-indigo-500" />
                  <span className="text-[10px] font-black uppercase text-neutral-700 dark:text-neutral-300 tracking-wider">Estilo e Comportamento</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.timeline.direction', 'Direção da Linha')}</label>
                    <select
                      value={(config.layout_config as any).timeline_config?.layout_direction || 'vertical'}
                      onChange={e => setConfig({
                        ...config,
                        layout_config: {
                          ...config.layout_config,
                          timeline_config: { ...(config.layout_config as any).timeline_config, layout_direction: e.target.value }
                        }
                      })}
                      className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
                    >
                      <option value="vertical">Vertical</option>
                      <option value="horizontal">Horizontal</option>
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.timeline.mode', 'Modo de Exibição')}</label>
                    <select
                      value={(config.layout_config as any).timeline_config?.layout_mode || 'alternating'}
                      onChange={e => setConfig({
                        ...config,
                        layout_config: {
                          ...config.layout_config,
                          timeline_config: { ...(config.layout_config as any).timeline_config, layout_mode: e.target.value }
                        }
                      })}
                      className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
                    >
                      <option value="alternating">Intercalado (Zig-Zag)</option>
                      <option value="same_side">Mesmo Lado</option>
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.timeline.animated', 'Animação de Desenho')}</label>
                    <select
                      value={(config.layout_config as any).timeline_config?.animated === false ? 'false' : 'true'}
                      onChange={e => setConfig({
                        ...config,
                        layout_config: {
                          ...config.layout_config,
                          timeline_config: { ...(config.layout_config as any).timeline_config, animated: e.target.value === 'true' }
                        }
                      })}
                      className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
                    >
                      <option value="false">Sem Animação (Estático)</option>
                      <option value="true">Com Animação (Desenho Dinâmico)</option>
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.timeline.style', 'Estilo Visual')}</label>
                    <select
                      value={(config.layout_config as any).timeline_config?.layout_style || 'cards'}
                      onChange={e => setConfig({
                        ...config,
                        layout_config: {
                          ...config.layout_config,
                          timeline_config: { ...(config.layout_config as any).timeline_config, layout_style: e.target.value }
                        }
                      })}
                      className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
                    >
                      <option value="cards">Cards (Padrão)</option>
                      <option value="infographic">Infográfico (Minimalista)</option>
                    </select>
                  </div>

                  <div className="space-y-3 col-span-1 sm:col-span-2 border-t border-neutral-100 dark:border-neutral-800/50 pt-4">
                    <div className="flex justify-between items-center ml-1">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">Escala de Exibição (Cards e Textos)</label>
                      <span className="text-[10px] font-extrabold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-md">
                        {((config.layout_config as any).timeline_config?.card_scale ?? 1.0).toFixed(1)}x
                        {((config.layout_config as any).timeline_config?.card_scale ?? 1.0) === 1.0 ? ' (Padrão)' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Compacto (0.6x)</span>
                      <input
                        type="range"
                        min="0.6"
                        max="1.4"
                        step="0.1"
                        value={(config.layout_config as any).timeline_config?.card_scale ?? 1.0}
                        onChange={e => setConfig({
                          ...config,
                          layout_config: {
                            ...config.layout_config,
                            timeline_config: { ...(config.layout_config as any).timeline_config, card_scale: parseFloat(e.target.value) }
                          }
                        })}
                        className="flex-1 h-2 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-600 focus:outline-none"
                      />
                      <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Ampliado (1.4x)</span>
                    </div>
                    <p className="text-[9px] text-neutral-400 italic ml-1">Arraste para ajustar proporcionalmente o tamanho dos cards, fontes e espaçamentos da linha do tempo.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ZONA: GANTT CONFIG */}
          {config.logic_type === 'gantt' && (
            <div className="p-6 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-[2rem] space-y-6 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 flex items-center justify-center">
                  <BarChartHorizontal className="w-4 h-4" />
                </div>
                <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em]">{t('wizard.layout.gantt.title', 'Configuração do Gráfico de Gantt')}</h4>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.gantt.title_field', 'Campo de Título (Obrigatório)')}</label>
                  <select
                    value={(config.layout_config as any).gantt_config?.title_field || ''}
                    onChange={e => setConfig({
                      ...config,
                      layout_config: {
                        ...config.layout_config,
                        gantt_config: { ...(config.layout_config as any).gantt_config, title_field: e.target.value }
                      }
                    })}
                    className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
                  >
                    <option value="">Selecione o campo de título...</option>
                    {orderedModels.flatMap((m: any) => m.fields).map((f: any) => (
                      <option key={`opt-gantt-title-${f.id}`} value={f.id}>
                        {getFieldName(f.id)} ({f.data_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.gantt.start_date_field', 'Data Inicial (Obrigatório)')}</label>
                  <select
                    value={(config.layout_config as any).gantt_config?.start_date_field || ''}
                    onChange={e => setConfig({
                      ...config,
                      layout_config: {
                        ...config.layout_config,
                        gantt_config: { ...(config.layout_config as any).gantt_config, start_date_field: e.target.value }
                      }
                    })}
                    className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
                  >
                    <option value="">Selecione a data inicial...</option>
                    {orderedModels.flatMap((m: any) => m.fields).filter((f: any) => f.data_type.includes('date') || f.data_type.includes('timestamp')).map((f: any) => (
                      <option key={`opt-gantt-start-${f.id}`} value={f.id}>
                        {getFieldName(f.id)} ({f.data_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.gantt.end_date_field', 'Data Final (Obrigatório)')}</label>
                  <select
                    value={(config.layout_config as any).gantt_config?.end_date_field || ''}
                    onChange={e => setConfig({
                      ...config,
                      layout_config: {
                        ...config.layout_config,
                        gantt_config: { ...(config.layout_config as any).gantt_config, end_date_field: e.target.value }
                      }
                    })}
                    className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
                  >
                    <option value="">Selecione a data final...</option>
                    {orderedModels.flatMap((m: any) => m.fields).filter((f: any) => f.data_type.includes('date') || f.data_type.includes('timestamp')).map((f: any) => (
                      <option key={`opt-gantt-end-${f.id}`} value={f.id}>
                        {getFieldName(f.id)} ({f.data_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.gantt.progress_field', 'Progresso % (Opcional)')}</label>
                  <select
                    value={(config.layout_config as any).gantt_config?.progress_field || ''}
                    onChange={e => setConfig({
                      ...config,
                      layout_config: {
                        ...config.layout_config,
                        gantt_config: { ...(config.layout_config as any).gantt_config, progress_field: e.target.value }
                      }
                    })}
                    className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
                  >
                    <option value="">Nenhum (Progresso não exibido)</option>
                    {orderedModels.flatMap((m: any) => m.fields).filter((f: any) => f.data_type.includes('int') || f.data_type.includes('float') || f.data_type.includes('numeric')).map((f: any) => (
                      <option key={`opt-gantt-prog-${f.id}`} value={f.id}>
                        {getFieldName(f.id)} ({f.data_type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ZONA: BLUEPRINT CONFIG */}
          {config.logic_type === 'blueprint' && (
            <div className="space-y-6">
              {/* Card 1: Mapeamento de Dados */}
              <div className="p-6 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] space-y-6 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 flex items-center justify-center">
                    <Database className="w-4 h-4" />
                  </div>
                  <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em]">Mapeamento de Dados</h4>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Campo de Título do Nó (Obrigatório)</label>
                    <select
                      value={(config.layout_config as any).blueprint_config?.title_field || ''}
                      onChange={e => setConfig({
                        ...config,
                        layout_config: {
                          ...config.layout_config,
                          blueprint_config: { ...(config.layout_config as any).blueprint_config, title_field: e.target.value }
                        }
                      })}
                      className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
                    >
                      <option value="">Selecione o título...</option>
                      {orderedModels.flatMap((m: any) => m.fields).map((f: any) => (
                        <option key={`opt-bp-title-${f.id}`} value={f.id}>
                          {getFieldName(f.id)} ({f.data_type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Campo Nó Anterior / Predecessora (Obrigatório)</label>
                    <select
                      value={(config.layout_config as any).blueprint_config?.predecessor_field || ''}
                      onChange={e => setConfig({
                        ...config,
                        layout_config: {
                          ...config.layout_config,
                          blueprint_config: { ...(config.layout_config as any).blueprint_config, predecessor_field: e.target.value }
                        }
                      })}
                      className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
                    >
                      <option value="">Selecione o campo de relação...</option>
                      {orderedModels.flatMap((m: any) => m.fields).map((f: any) => (
                        <option key={`opt-bp-pred-${f.id}`} value={f.id}>
                          {getFieldName(f.id)} ({f.data_type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Campo de Status (Opcional)</label>
                    <select
                      value={(config.layout_config as any).blueprint_config?.status_field || ''}
                      onChange={e => setConfig({
                        ...config,
                        layout_config: {
                          ...config.layout_config,
                          blueprint_config: { ...(config.layout_config as any).blueprint_config, status_field: e.target.value }
                        }
                      })}
                      className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
                    >
                      <option value="">Selecione o campo de status...</option>
                      {orderedModels.flatMap((m: any) => m.fields).map((f: any) => (
                        <option key={`opt-bp-status-${f.id}`} value={f.id}>
                          {getFieldName(f.id)} ({f.data_type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Campo de Descrição (Opcional)</label>
                    <select
                      value={(config.layout_config as any).blueprint_config?.desc_field || ''}
                      onChange={e => setConfig({
                        ...config,
                        layout_config: {
                          ...config.layout_config,
                          blueprint_config: { ...(config.layout_config as any).blueprint_config, desc_field: e.target.value }
                        }
                      })}
                      className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
                    >
                      <option value="">Selecione a descrição...</option>
                      {orderedModels.flatMap((m: any) => m.fields).map((f: any) => (
                        <option key={`opt-bp-desc-${f.id}`} value={f.id}>
                          {getFieldName(f.id)} ({f.data_type})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Card 2: Estilo e Comportamento */}
              <div className="p-6 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] space-y-6 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 flex items-center justify-center">
                    <SlidersHorizontal className="w-4 h-4" />
                  </div>
                  <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em]">Estilo e Comportamento</h4>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  {/* Direção da Linha */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Direção da Linha</label>
                    <select
                      value={(config.layout_config as any).blueprint_config?.direction || 'TB'}
                      onChange={e => setConfig({
                        ...config,
                        layout_config: { ...config.layout_config, blueprint_config: { ...(config.layout_config as any).blueprint_config, direction: e.target.value } }
                      })}
                      className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
                    >
                      <option value="TB">Vertical (Cima para Baixo)</option>
                      <option value="LR">Horizontal (Esquerda para Direita)</option>
                    </select>
                  </div>

                  {/* Animação */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Animação de Desenho</label>
                    <select
                      value={(config.layout_config as any).blueprint_config?.animated_edges !== false ? 'true' : 'false'}
                      onChange={e => setConfig({
                        ...config,
                        layout_config: { ...config.layout_config, blueprint_config: { ...(config.layout_config as any).blueprint_config, animated_edges: e.target.value === 'true' } }
                      })}
                      className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
                    >
                      <option value="true">Com Animação (Desenho Dinâmico)</option>
                      <option value="false">Sem Animação (Estático)</option>
                    </select>
                  </div>
                </div>

                {/* Slider de Escala */}
                <div className="space-y-3 pt-4 border-t border-neutral-100 dark:border-neutral-800/50">
                  <div className="flex justify-between items-center text-xs font-bold text-neutral-500 mb-2 uppercase tracking-wider">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Escala de exibição (Cards e textos)</label>
                    <span className="text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">
                      {((config.layout_config as any).blueprint_config?.scale || 1).toFixed(1)}x
                    </span>
                  </div>
                  <div className="flex items-center gap-4 px-2">
                    <span className="text-[10px] font-semibold text-neutral-400 whitespace-nowrap">COMPACTO (0.6X)</span>
                    <input 
                      type="range" 
                      min="0.6" 
                      max="1.4" 
                      step="0.1" 
                      value={(config.layout_config as any).blueprint_config?.scale || 1} 
                      onChange={(e) => setConfig({
                        ...config,
                        layout_config: { ...config.layout_config, blueprint_config: { ...(config.layout_config as any).blueprint_config, scale: Number(e.target.value) } }
                      })}
                      className="flex-1 h-2 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-600 transition-all" 
                    />
                    <span className="text-[10px] font-semibold text-neutral-400 whitespace-nowrap">AMPLIADO (1.4X)</span>
                  </div>
                  <p className="text-[10px] text-neutral-400 mt-2 italic px-2">Arraste para ajustar proporcionalmente o tamanho dos cards, fontes e espaçamentos do fluxograma.</p>
                </div>
              </div>
            </div>
          )}

          {/* ZONA: MAP CONFIG */}
          {config.logic_type === 'map' && (
            <div className="p-6 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-[2rem] space-y-6 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 flex items-center justify-center">
                  <Share2 className="w-4 h-4" />
                </div>
                <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em]">{t('wizard.layout.map.title', 'Configuração do Mapa (Leaflet)')}</h4>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.map.title_field', 'Campo de Título (Obrigatório)')}</label>
                  <select
                    value={(config.layout_config as any).map_config?.title_field || ''}
                    onChange={e => setConfig({
                      ...config,
                      layout_config: {
                        ...config.layout_config,
                        map_config: { ...(config.layout_config as any).map_config, title_field: e.target.value }
                      }
                    })}
                    className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
                  >
                    <option value="">Selecione o título...</option>
                    {orderedModels.flatMap((m: any) => m.fields).map((f: any) => (
                      <option key={`opt-map-title-${f.id}`} value={f.id}>
                        {getFieldName(f.id)} ({f.data_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.map.desc_field', 'Campo de Descrição (Opcional)')}</label>
                  <select
                    value={(config.layout_config as any).map_config?.desc_field || ''}
                    onChange={e => setConfig({
                      ...config,
                      layout_config: {
                        ...config.layout_config,
                        map_config: { ...(config.layout_config as any).map_config, desc_field: e.target.value }
                      }
                    })}
                    className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
                  >
                    <option value="">Selecione a descrição...</option>
                    {orderedModels.flatMap((m: any) => m.fields).map((f: any) => (
                      <option key={`opt-map-desc-${f.id}`} value={f.id}>
                        {getFieldName(f.id)} ({f.data_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.map.lat_field', 'Latitude (Y) - Obrigatório')}</label>
                  <select
                    value={(config.layout_config as any).map_config?.lat_field || ''}
                    onChange={e => setConfig({
                      ...config,
                      layout_config: {
                        ...config.layout_config,
                        map_config: { ...(config.layout_config as any).map_config, lat_field: e.target.value }
                      }
                    })}
                    className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
                  >
                    <option value="">Selecione a latitude...</option>
                    {orderedModels.flatMap((m: any) => m.fields).map((f: any) => (
                      <option key={`opt-map-lat-${f.id}`} value={f.id}>
                        {getFieldName(f.id)} ({f.data_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.map.lng_field', 'Longitude (X) - Obrigatório')}</label>
                  <select
                    value={(config.layout_config as any).map_config?.lng_field || ''}
                    onChange={e => setConfig({
                      ...config,
                      layout_config: {
                        ...config.layout_config,
                        map_config: { ...(config.layout_config as any).map_config, lng_field: e.target.value }
                      }
                    })}
                    className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
                  >
                    <option value="">Selecione a longitude...</option>
                    {orderedModels.flatMap((m: any) => m.fields).map((f: any) => (
                      <option key={`opt-map-lng-${f.id}`} value={f.id}>
                        {getFieldName(f.id)} ({f.data_type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ZONA: MASTER-DETAIL CONFIG */}
          {config.logic_type === 'master_detail' && (
            <div className="p-6 bg-slate-50/50 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-800 rounded-[2rem] space-y-6 shadow-sm overflow-hidden transition-all duration-300">
              <div 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => toggleZone('masterDetail')}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/20">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em]">{t('wizard.layout.master_detail.title')}</h4>
                    <p className="text-[10px] text-neutral-400 font-medium mt-1">{t('wizard.layout.master_detail.subtitle')}</p>
                  </div>
                </div>
                <div className="p-2 text-indigo-600">
                  {expandedZones.masterDetail ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </div>

              {expandedZones.masterDetail && (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300 pt-4 border-t border-slate-200 dark:border-slate-800/50">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Tabela Mestre (Root)</label>
                  <select
                    value={(config.layout_config as any).master_model_id || ''}
                    onChange={e => setConfig({
                      ...config,
                      layout_config: { ...config.layout_config, master_model_id: e.target.value }
                    })}
                    className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
                  >
                    <option value="">Selecione a tabela principal...</option>
                    {models.filter((m: any) => config.selected_models.includes(m.id)).map((m: any) => (
                      <option key={m.id} value={m.id}>{m.display_name || m.db_table_name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Estilo dos Detalhes</label>
                  <div className="flex p-1 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm">
                    <button
                      onClick={() => setConfig({ ...config, layout_config: { ...config.layout_config, detail_display_mode: 'tabs' } })}
                      className={cn(
                        "flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                        (config.layout_config as any).detail_display_mode !== 'sections' ? 'bg-indigo-600 text-white shadow-lg' : 'text-neutral-400 hover:text-neutral-600'
                      )}
                    >
                      Abas
                    </button>
                    <button
                      onClick={() => setConfig({ ...config, layout_config: { ...config.layout_config, detail_display_mode: 'sections' } })}
                      className={cn(
                        "flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                        (config.layout_config as any).detail_display_mode === 'sections' ? 'bg-indigo-600 text-white shadow-lg' : 'text-neutral-400 hover:text-neutral-600'
                      )}
                    >
                      Seções
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 flex gap-3 items-start">
                <AlertCircle className="w-4 h-4 text-indigo-500 mt-0.5" />
                <p className="text-[10px] text-indigo-600 dark:text-indigo-400 leading-relaxed">
                  <strong>Dica:</strong> No estilo <strong>Abas</strong>, cada tabela detalhe será uma aba separada. No estilo <strong>Seções</strong>, os dados serão empilhados em grupos dentro do mesmo corpo de formulário.
                </p>
              </div>
            </div>
          )}
            </div>
          )}

          {/* ZONA: ANALYTICS (BI) CONFIG */}
          {config.logic_type === 'analytics' && (
            <div className="p-6 bg-indigo-50/30 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800 rounded-[2rem] space-y-6 shadow-sm animate-in zoom-in-95 duration-500">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/20">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em]">Painel de Indicadores (BI)</h4>
                    <p className="text-[10px] text-neutral-400 font-medium mt-1">Configure os widgets e gráficos do seu dashboard.</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-1 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl">
                   <button 
                     onClick={() => setConfig({
                       ...config,
                       layout_config: {
                         ...config.layout_config,
                         analytics_config: { ...config.layout_config.analytics_config, allow_runtime_edit: !config.layout_config.analytics_config.allow_runtime_edit }
                       }
                     })}
                     className={cn(
                       "px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                       config.layout_config.analytics_config.allow_runtime_edit ? "bg-indigo-600 text-white shadow-md" : "text-neutral-400 hover:text-neutral-600"
                     )}
                   >
                     Edição no Runtime: {config.layout_config.analytics_config.allow_runtime_edit ? 'ON' : 'OFF'}
                   </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <SortableContext items={(config.layout_config.analytics_config?.widgets || []).map((w: any) => `widget-${w.id}`)} strategy={rectSortingStrategy}>
                  {(config.layout_config.analytics_config?.widgets || []).map((widget: any) => (
                    <SortableWidgetCard 
                      key={`widget-${widget.id}`} 
                      widget={widget} 
                      onEdit={() => { setEditingWidget(widget); setIsWidgetModalOpen(true); }}
                      onDelete={() => handleDeleteWidget(widget.id)}
                      getFieldName={getFieldName}
                    />
                  ))}
                </SortableContext>
                
                <button 
                  onClick={handleAddWidget}
                  className="p-8 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col items-center justify-center gap-3 text-neutral-400 hover:text-indigo-600 hover:border-indigo-500 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-all group"
                >
                  <Plus className="w-6 h-6 group-hover:scale-125 transition-transform" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Adicionar Widget de BI</span>
                </button>
              </div>
            </div>
          )}
          {config.logic_type === 'mapa_mental' && (
            <div className="p-4 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-[1.5rem] space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-600 text-white rounded-xl shadow-lg shadow-purple-500/20">
                    <Share2 className="w-4 h-4" />
                  </div>
                  <h4 className="text-[10px] font-black uppercase text-purple-600 tracking-[0.3em]">{t('wizard.layout.mindmap.config_title', 'Configuração do Mapa Mental')}</h4>
                </div>
              </div>
              
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.mindmap.central_field', 'Campo Central (Nó Raiz)')}</label>
                <select
                  value={config.layout_config.mindmap_central_field || ''}
                  onChange={e => setConfig((prev: any) => ({
                    ...prev,
                    layout_config: { ...prev.layout_config, mindmap_central_field: e.target.value }
                  }))}
                  className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-purple-600 outline-none transition-all shadow-sm text-sm font-bold"
                >
                  <option value="">{t('wizard.layout.mindmap.select_central', 'Selecione o campo central...')}</option>
                  {relationalTree.flatMap((m: any) => m.fields).map((f: any) => (
                    <option key={f.id} value={f.id}>
                      {getFieldName(f.id)} ({f.data_type})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-neutral-400 font-medium italic ml-1">{t('wizard.layout.mindmap.central_desc', 'Este campo será a raiz do seu mapa mental. Os campos selecionados na Zona 02 formarão os próximos níveis na ordem definida.')}</p>
              </div>
            </div>
          )}
          {config.logic_type === 'galeria' && (
            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-[1.5rem] space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/20">
                    <LayoutGrid className="w-4 h-4" />
                  </div>
                  <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em]">Configuração da Galeria</h4>
                </div>
              </div>
              
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Visualização de Imagem</label>
                <div className="flex p-1 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm">
                  <button
                    type="button"
                    onClick={() => setConfig({
                      ...config,
                      layout_config: { ...config.layout_config, gallery_click_behavior: 'lightbox' }
                    })}
                    className={cn(
                      "flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      (config.layout_config.gallery_click_behavior || 'lightbox') === 'lightbox' ? 'bg-indigo-600 text-white shadow-lg' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'
                    )}
                  >
                    Abrir na Modal (Lightbox)
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig({
                      ...config,
                      layout_config: { ...config.layout_config, gallery_click_behavior: 'thumbnail' }
                    })}
                    className={cn(
                      "flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      (config.layout_config.gallery_click_behavior || 'lightbox') === 'thumbnail' ? 'bg-indigo-600 text-white shadow-lg' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'
                    )}
                  >
                    Ver no próprio Thumbnail
                  </button>
                </div>
                <p className="text-[10px] text-neutral-400 font-medium italic ml-1">
                  Selecione "Ver no próprio Thumbnail" para exibir a imagem inteira (sem cortes) diretamente no card, desabilitando a modal de visualização ao clicar.
                </p>
              </div>
            </div>
          )}


          {/* Seção Global de Relacionamentos (JOINS) - Posicionada estrategicamente antes das Zonas de Dados */}
          <JoinsEditor 
            joins={config.layout_config.joins || []}
            // Para Analytics, permitimos relacionar qualquer tabela do projeto. Para outros, apenas as selecionadas.
            models={config.logic_type === 'analytics' ? models : models.filter((m: any) => config.selected_models.includes(m.id))}
            onUpdate={(newJoins) => setConfig({
              ...config,
              layout_config: { ...config.layout_config, joins: newJoins }
            })}
            t={t}
          />

          {/* ZONA: FILTROS */}
          {(config.logic_type.includes('pesquisa') || 
            config.logic_type === 'kanban' || 
            config.logic_type === 'mapa_mental' || 
            config.logic_type === 'master_detail' || 
            config.logic_type === 'scheduler' || 
            config.logic_type === 'galeria' || 
            config.logic_type === 'personalizado' || 
            config.logic_type === 'analytics') && (
            <div className="p-4 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-[1.5rem] space-y-3 shadow-sm overflow-hidden transition-all duration-300">
              <div 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => toggleZone('zone01')}
              >
                <div className="flex items-center gap-3">
                  <h4 className="text-[9px] font-black uppercase text-indigo-600 tracking-[0.3em]">{t('wizard.layout.zones.zone_01')}: {t('wizard.layout.zones.filter')}</h4>
                  <span className="px-3 py-1 bg-indigo-500/10 text-indigo-600 rounded-full text-[9px] font-black tracking-widest">{config.layout_config.filter_fields.length} {t('dashboard.projects.studio.fields_count')}</span>
                </div>
                <div className="flex items-center gap-2">
                  {config.layout_config.filter_fields.length > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfig({ ...config, layout_config: { ...config.layout_config, filter_fields: [] } }) }}
                      className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                      title={t('common.clear_all', 'Limpar Tudo')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <div className="p-1 text-indigo-600">
                    {expandedZones.zone01 ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </div>

              {expandedZones.zone01 && (
                <div className="pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <DroppableZone id="droppable-filter" className="grid grid-cols-7 gap-3 min-h-[80px] p-6 bg-neutral-50 dark:bg-neutral-950/30 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-[2rem] items-start">
                {config.layout_config.filter_fields.length === 0 ? (
                  <p className="text-xs text-neutral-400 font-medium w-full text-center italic">{t('wizard.layout.subtitle')}</p>
                ) : (
                  <SortableContext items={config.layout_config.filter_fields.map((id: string) => `filter-${id}`)} strategy={rectSortingStrategy}>
                    {config.layout_config.filter_fields.map((id: string) => (
                      <SortableFieldChip
                        key={`filter-${id}`}
                        id={`filter-${id}`}
                        itemValue={id}
                        toggleField={toggleField}
                        zoneType="filter"
                        onEdit={() => { setEditingFieldId(id); setEditingFieldZone('filter'); setIsDrawerOpen(true); }}
                      >
                        <span
                          style={{
                            fontFamily: getFieldMeta(id, 'filter').label?.font,
                            fontSize: getFieldMeta(id, 'filter').label?.size,
                            color: getFieldMeta(id, 'filter').label?.color || undefined
                          }}
                          className={cn(
                            "text-[10px] font-black tracking-wider",
                            !getFieldMeta(id, 'filter').label?.font && "uppercase"
                          )}
                        >
                          {getFieldMeta(id, 'filter').label?.text || getFieldName(id)}
                        </span>
                      </SortableFieldChip>
                    ))}
                  </SortableContext>
                )}
              </DroppableZone>
              </div>
            )}
            </div>
          )}

          {/* ZONA: GRID */}
          {config.logic_type !== 'timeline' && config.logic_type !== 'map' && config.logic_type !== 'gantt' && config.logic_type !== 'cadastro' && (
          <div className="p-4 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-[1.5rem] space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h4 className="text-[9px] font-black uppercase text-emerald-600 tracking-[0.3em]">
                  {config.logic_type === 'kanban' ? t('wizard.layout.zones.kanban_card', 'Campos do Card') : config.logic_type === 'mapa_mental' ? t('wizard.layout.zones.mindmap_nodes', 'Campos do Mapa (Níveis)') : `${t('wizard.layout.zones.zone_02')}: ${t('wizard.layout.zones.grid')}`}
                </h4>
                {config.logic_type !== 'kanban' && config.logic_type !== 'mapa_mental' && config.logic_type !== 'galeria' && (
                  <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-950 p-0.5 rounded-lg w-fit">
                    {[
                      { id: 'list', label: t('wizard.layout.display_options.list') },
                      { id: 'card', label: t('wizard.layout.display_options.card') },
                      { id: 'both', label: t('wizard.layout.display_options.both') }
                    ].map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => setConfig({
                          ...config,
                          layout_config: { ...config.layout_config, display_type: opt.id }
                        })}
                        className={cn(
                          "px-3 py-1 rounded-md text-[8px] font-black uppercase tracking-widest transition-all",
                          (config.layout_config.display_type || 'list') === opt.id
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                            : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-full text-[9px] font-black tracking-widest">{config.layout_config.grid_fields.length} {t('dashboard.projects.studio.fields_count')}</span>
                {config.layout_config.grid_fields.length > 0 && (
                  <button
                    onClick={() => setConfig({ ...config, layout_config: { ...config.layout_config, grid_fields: [] } })}
                    className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                    title={t('common.clear_all', 'Limpar Tudo')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <DroppableZone id="droppable-grid" className="grid grid-cols-7 gap-3 min-h-[100px] p-6 bg-neutral-50 dark:bg-neutral-950/30 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-[2rem] items-start">
              {config.layout_config.grid_fields.length === 0 ? (
                <p className="text-xs text-neutral-400 font-medium w-full text-center italic">{t('wizard.layout.subtitle')}</p>
              ) : (
                <SortableContext items={config.layout_config.grid_fields.map((id: string) => `grid-${id}`)} strategy={rectSortingStrategy}>
                  {config.layout_config.grid_fields.map((id: string) => (
                    <SortableFieldChip
                      key={`grid-${id}`}
                      id={`grid-${id}`}
                      itemValue={id}
                      toggleField={toggleField}
                      zoneType="grid"
                      onEdit={() => { setEditingFieldId(id); setEditingFieldZone('grid'); setIsDrawerOpen(true); }}
                    >
                      <span
                        style={{
                          fontFamily: getFieldMeta(id, 'grid').label?.font,
                          fontSize: getFieldMeta(id, 'grid').label?.size,
                          color: getFieldMeta(id, 'grid').label?.color || undefined
                        }}
                        className={cn(
                          "text-[10px] font-black tracking-wider",
                          !getFieldMeta(id, 'grid').label?.font && "uppercase"
                        )}
                      >
                        {getFieldMeta(id, 'grid').label?.text || getFieldName(id)}
                      </span>
                    </SortableFieldChip>
                  ))}
                </SortableContext>
              )}
            </DroppableZone>
            </div>
            )}

          {/* ZONA: FORMULÁRIO (RECURSIVO) */}
          {(config.logic_type.includes('cadastro') || 
            config.logic_type === 'master_detail' || 
            config.logic_type === 'kanban' || 
            config.logic_type === 'timeline' ||
            config.logic_type === 'map' ||
            config.logic_type === 'gantt' ||
            config.logic_type === 'scheduler' || 
            config.logic_type === 'mapa_mental' || 
            config.logic_type === 'galeria' || 
            config.logic_type === 'personalizado') && (
            <div className="p-4 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-[1.5rem] space-y-4 shadow-sm overflow-hidden transition-all duration-300">
              <div 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => toggleZone('zone03')}
              >
                <div className="flex items-center gap-3">
                  <h4 className="text-[9px] font-black uppercase text-amber-600 tracking-[0.3em]">{config.logic_type === 'cadastro' ? t('wizard.layout.zones.zone_01') : t('wizard.layout.zones.zone_03')}: {t('wizard.layout.zones.form')}</h4>
                  <span className="px-3 py-1 bg-amber-500/10 text-amber-600 rounded-full text-[9px] font-black tracking-widest">{config.layout_config.form_fields.length} {t('dashboard.projects.studio.fields_count')}</span>
                </div>
                <div className="flex items-center gap-2">
                  {config.layout_config.form_fields.length > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfig({ ...config, layout_config: { ...config.layout_config, form_fields: [] } }) }}
                      className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                      title={t('common.clear_all', 'Limpar Tudo')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <div className="p-1 text-amber-600">
                    {expandedZones.zone03 ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </div>

              {expandedZones.zone03 && (
                <div className="space-y-6 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  {relationalTree.map((node: any, nIdx: number) => renderModelZone(node, 0, nIdx))}
                </div>
              )}
            </div>
          )}
          </div>
        </div>

        <DragOverlay zIndex={1000}>
          {activeId ? (
            activeId.startsWith('table-source-') ? (
              <div className="bg-white dark:bg-neutral-900 rounded-2xl border-2 border-indigo-500 p-4 shadow-2xl opacity-90 scale-105 flex items-center justify-between w-80">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-4 bg-indigo-500 rounded-full"></div>
                  <span className="text-[11px] font-black text-neutral-900 dark:text-white uppercase tracking-[0.15em]">
                    {models.find((m: any) => m.id === activeId.replace('table-source-', ''))?.display_name || 'Tabela'}
                  </span>
                </div>
              </div>
            ) : activeId.startsWith('source-') ? (
              <div className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border-2 border-indigo-500 shadow-2xl opacity-90 scale-105 flex items-center justify-between w-72">
                <span className="text-xs font-bold text-neutral-700 dark:text-neutral-200">
                  {(() => {
                    const fid = activeId.replace('source-', '')
                    for (const m of models) {
                      const f = m.fields.find((f: any) => f.id === fid)
                      if (f) return f.display_name || f.db_column_name
                    }
                    return 'Campo'
                  })()}
                </span>
                <Plus className="w-3.5 h-3.5 text-indigo-500" />
              </div>
            ) : null
          ) : null}
        </DragOverlay>
      </DndContext>

      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={`${t('wizard.layout.drawer.title')}: ${editingFieldId ? getFieldName(editingFieldId) : ''}`}
      >
        {currentFieldMeta && (
          <div className="flex flex-col h-full">
            {editingFieldId !== 'TABS' && (
              <div className="flex border-b border-neutral-100 dark:border-neutral-800 mb-6">
                <button
                  onClick={() => setDrawerActiveTab('geral')}
                  className={cn(
                    "flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative",
                    drawerActiveTab === 'geral' ? "text-indigo-600" : "text-neutral-400 hover:text-neutral-600"
                  )}
                >
                  Básico / Geral
                  {drawerActiveTab === 'geral' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
                </button>
                <button
                  onClick={() => setDrawerActiveTab('estilos')}
                  className={cn(
                    "flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative",
                    drawerActiveTab === 'estilos' ? "text-indigo-600" : "text-neutral-400 hover:text-neutral-600"
                  )}
                >
                  Aparência / Estilos
                  {drawerActiveTab === 'estilos' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
                </button>
              </div>
            )}

            <div className="space-y-8 pb-20">
              {editingFieldId === 'TABS' && (
                <>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-4 bg-indigo-600 rounded-full"></div>
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">{t('wizard.layout.drawer.label_config')}</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.font')}</label>
                        <select
                          value={currentFieldMeta.label.font}
                          onChange={e => updateMeta('label', 'font', e.target.value)}
                          className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2.5 text-xs font-bold outline-none"
                        >
                          <option value="Inter">{t('wizard.layout.drawer.font_default')}</option>
                          <option value="Roboto">Roboto</option>
                          <option value="Outfit">Outfit</option>
                          <option value="JetBrains Mono">Mono</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.size')}</label>
                        <input
                          type="text"
                          placeholder="Ex: 12px"
                          value={currentFieldMeta.label.size}
                          onChange={e => updateMeta('label', 'size', e.target.value)}
                          className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.text_color')}</label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          value={currentFieldMeta.label.color || '#6366f1'}
                          onChange={e => updateMeta('label', 'color', e.target.value)}
                          className="w-8 h-8 rounded-lg cursor-pointer overflow-hidden border-none p-0"
                        />
                        <input
                          type="text"
                          value={currentFieldMeta.label.color}
                          onChange={e => updateMeta('label', 'color', e.target.value)}
                          placeholder={t('wizard.layout.drawer.text_color')}
                          className="flex-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2 text-xs font-mono font-bold outline-none"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* TEXTO DE EXIBIÇÃO PARA TABS FICA SEPARADO MAS NA MESMA ABA ÚNICA */}
                  <div className="space-y-4 pt-6 mt-6 border-t border-neutral-100 dark:border-neutral-800">
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-4 bg-indigo-600 rounded-full"></div>
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">{t('wizard.layout.drawer.label_config')}</h3>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.display_text')}</label>
                      <input
                        type="text"
                        value={
                          editingTabId === 'master' 
                            ? ((config.layout_config as any).master_tab_title || `Mestre: ${models.find((m: any) => m.id === (config.layout_config as any).master_model_id)?.display_name || ''}`)
                            : ((config.layout_config as any).details_tab_titles?.[editingTabId || ''] || `Detalhe`)
                        }
                        onChange={e => {
                          if (editingTabId === 'master') {
                            setConfig({
                              ...config,
                              layout_config: { ...config.layout_config, master_tab_title: e.target.value }
                            })
                          } else if (editingTabId) {
                            const currentTitles = (config.layout_config as any).details_tab_titles || {}
                            setConfig({
                              ...config,
                              layout_config: {
                                ...config.layout_config,
                                details_tab_titles: { ...currentTitles, [editingTabId]: e.target.value }
                              }
                            })
                          }
                        }}
                        className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold focus:border-indigo-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                </>
              )}

              {editingFieldId !== 'TABS' && drawerActiveTab === 'geral' && (
                <>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-4 bg-indigo-600 rounded-full"></div>
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">{t('wizard.layout.drawer.label_config')}</h3>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.display_text')}</label>
                      <input
                        type="text"
                        value={currentFieldMeta.label.text}
                        onChange={e => updateMeta('label', 'text', e.target.value)}
                        className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold focus:border-indigo-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-4 pt-6 border-t border-neutral-100 dark:border-neutral-800">
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-4 bg-emerald-600 rounded-full"></div>
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">{t('wizard.layout.drawer.content_config')}</h3>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.mask')}</label>
                        <div className="flex flex-col gap-2">
                          <select
                            value={
                              ['', '000.000.000-00', '00.000.000/0000-00', '00000-000', '(00) 00000-0000', '00/00/0000', '0.000', '0.000,00'].includes(currentFieldMeta.content.mask || '')
                                ? currentFieldMeta.content.mask || ''
                                : 'custom'
                            }
                            onChange={e => {
                              const val = e.target.value
                              if (val !== 'custom') {
                                updateMeta('content', 'mask', val)
                              } else {
                                const isKnown = ['', '000.000.000-00', '00.000.000/0000-00', '00000-000', '(00) 00000-0000', '00/00/0000', '0.000', '0.000,00'].includes(currentFieldMeta.content.mask || '')
                                if (isKnown) {
                                  updateMeta('content', 'mask', ' ') 
                                }
                              }
                            }}
                            className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none cursor-pointer"
                          >
                            <option value="">{t('common.none', 'Nenhuma')}</option>
                            <option value="000.000.000-00">CPF (000.000.000-00)</option>
                            <option value="00.000.000/0000-00">CNPJ (00.000.000/0000-00)</option>
                            <option value="00000-000">CEP (00000-000)</option>
                            <option value="(00) 00000-0000">Telefone/Celular ((00) 00000-0000)</option>
                            <option value="00/00/0000">Data (00/00/0000)</option>
                            <option value="0.000">Inteiro com Milhar (0.000)</option>
                            <option value="0.000,00">Decimal com Milhar (0.000,00)</option>
                            <option value="custom">Personalizado (Custom)...</option>
                          </select>

                          {!['', '000.000.000-00', '00.000.000/0000-00', '00000-000', '(00) 00000-0000', '00/00/0000', '0.000', '0.000,00'].includes(currentFieldMeta.content.mask || '') && (
                            <input
                              type="text"
                              placeholder="Ex: 000.000.000-00"
                              value={(currentFieldMeta.content.mask || '').trim()}
                              onChange={e => updateMeta('content', 'mask', e.target.value)}
                              className="w-full bg-neutral-50 dark:bg-neutral-900 border border-indigo-500/50 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-indigo-500 transition-colors"
                            />
                          )}

                          {currentFieldMeta.content.mask === '00000-000' && (
                            <div className="space-y-4 p-4 mt-2 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 animate-in fade-in slide-in-from-top-2">
                              <div className="flex items-center gap-3">
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input 
                                    type="checkbox" 
                                    className="sr-only peer"
                                    checked={currentFieldMeta.viacep?.enabled || false}
                                    onChange={(e) => updateMeta('viacep', 'enabled', e.target.checked)}
                                  />
                                  <div className="w-9 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                                </label>
                                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Busca Automática de Endereço (ViaCEP)</span>
                              </div>

                              {currentFieldMeta.viacep?.enabled && (
                                <div className="space-y-3 pt-4 border-t border-indigo-100 dark:border-indigo-900/30">
                                  <p className="text-[9px] text-neutral-500 font-medium leading-relaxed">Mapeie os campos do formulário que receberão os dados do ViaCEP automaticamente:</p>
                                  
                                  {['logradouro', 'bairro', 'cidade', 'uf'].map((fieldKey) => (
                                    <div key={fieldKey} className="flex items-center justify-between gap-2">
                                      <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider w-20">{fieldKey}</label>
                                      <select
                                        value={currentFieldMeta.viacep?.[fieldKey] || ''}
                                        onChange={e => updateMeta('viacep', fieldKey, e.target.value)}
                                        className="flex-1 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1.5 text-[9px] font-bold outline-none"
                                      >
                                        <option value="">Selecione o campo...</option>
                                        {config.layout_config.form_fields.map((ffId: string) => (
                                          <option key={ffId} value={ffId}>{getFieldName(ffId)}</option>
                                        ))}
                                      </select>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border border-neutral-100 dark:border-neutral-800 cursor-pointer group" onClick={() => updateMeta('content', 'required', !currentFieldMeta.content?.required)}>
                        <div className={cn(
                          "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                          currentFieldMeta.content?.required ? 'bg-red-500 border-red-500 text-white' : 'border-neutral-300 dark:border-neutral-700'
                        )}>
                          {currentFieldMeta.content?.required && <Plus className="w-3 h-3 rotate-45" />}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-neutral-700 dark:text-neutral-200 uppercase tracking-widest">{t('wizard.layout.drawer.required')}</span>
                          <span className="text-[8px] text-neutral-400 font-medium">{t('wizard.layout.drawer.required_desc')}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border border-neutral-100 dark:border-neutral-800 cursor-pointer group" onClick={() => updateMeta('content', 'readonly', !currentFieldMeta.content?.readonly)}>
                        <div className={cn(
                          "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                          currentFieldMeta.content?.readonly ? 'bg-amber-500 border-amber-500 text-white' : 'border-neutral-300 dark:border-neutral-700'
                        )}>
                          {currentFieldMeta.content?.readonly && <Plus className="w-3 h-3 rotate-45" />}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-neutral-700 dark:text-neutral-200 uppercase tracking-widest">{t('wizard.layout.drawer.readonly', 'Somente Leitura')}</span>
                          <span className="text-[8px] text-neutral-400 font-medium">{t('wizard.layout.drawer.readonly_desc', 'O usuário não poderá alterar este valor')}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-6 border-t border-neutral-100 dark:border-neutral-800">
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-4 bg-amber-500 rounded-full"></div>
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">{t('wizard.layout.drawer.component_config', 'Configuração do Componente')}</h3>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.component_type', 'Tipo de Componente')}</label>
                        <select
                          value={currentFieldMeta.component?.type || 'text'}
                          onChange={e => updateMeta('component', 'type', e.target.value)}
                          className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2.5 text-xs font-bold outline-none"
                        >
                          <option value="text">Input Texto</option>
                          <option value="textarea">Área de Texto (Textarea)</option>
                          <option value="number">Número</option>
                          <option value="select">Combo (Select)</option>
                          <option value="radio">Radio Buttons</option>
                          <option value="checkbox">Checkbox Group</option>
                          <option value="switch">Switch (Liga/Desliga)</option>
                          <option value="date">Data</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.width', 'Largura')}</label>
                          <input
                            type="text"
                            placeholder="Ex: 100% ou 200px"
                            value={currentFieldMeta.component?.width || '100%'}
                            onChange={e => updateMeta('component', 'width', e.target.value)}
                            className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
                          />
                        </div>
                        {currentFieldMeta.component?.type === 'textarea' && (
                          <div className="space-y-2">
                            <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.rows', 'Linhas')}</label>
                            <input
                              type="number"
                              value={currentFieldMeta.component?.rows || 3}
                              onChange={e => updateMeta('component', 'rows', parseInt(e.target.value))}
                              className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
                            />
                          </div>
                        )}
                      </div>

                      {(['select', 'radio', 'checkbox'].includes(currentFieldMeta.component?.type)) && (
                        <div className="space-y-4 p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/50">
                          <div className="space-y-2">
                            <label className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.options_source', 'Origem dos Dados')}</label>
                            <div className="flex gap-2">
                              {['fixed', 'enumeration', 'relational'].map(opt => (
                                <button
                                  key={opt}
                                  onClick={() => updateMeta('component', 'options_type', opt)}
                                  className={cn(
                                    "flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all",
                                    (currentFieldMeta.component?.options_type || 'fixed') === opt ? 'bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-neutral-900 text-neutral-400'
                                  )}
                                >
                                  {opt === 'fixed' ? 'Valores Fixos' : opt === 'enumeration' ? 'Enum Global' : 'Relacionamento'}
                                </button>
                              ))}
                            </div>
                          </div>

                          {(currentFieldMeta.component?.options_type || 'fixed') === 'fixed' ? (
                            <div className="space-y-2">
                              <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.fixed_options', 'Opções (Label:Valor, separadas por vírgula)')}</label>
                              <textarea
                                placeholder="Ex: Ativo:A, Inativo:I"
                                value={currentFieldMeta.component?.fixed_options || ''}
                                onChange={e => updateMeta('component', 'fixed_options', e.target.value)}
                                className="w-full h-20 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none resize-none"
                              />
                            </div>
                          ) : currentFieldMeta.component?.options_type === 'enumeration' ? (
                            <div className="space-y-2">
                              <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">Selecione o Enumeration</label>
                              <select
                                value={currentFieldMeta.component?.rel_table || ''}
                                onChange={e => updateMeta('component', 'rel_table', e.target.value)}
                                className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                              >
                                <option value="">Selecione...</option>
                                {enumerations.map((e: any) => (
                                  <option key={e.id} value={e.id}>{e.name}</option>
                                ))}
                              </select>
                              {currentFieldMeta.component?.rel_table && (
                                <p className="text-[9px] text-neutral-500 mt-2 italic px-1">
                                  {enumerations.find((e: any) => e.id === currentFieldMeta.component?.rel_table)?.values?.length || 0} opções disponíveis
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="space-y-2">
                                <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.rel_table', 'Tabela Relacionada')}</label>
                                <select
                                  value={currentFieldMeta.component?.rel_table || ''}
                                  onChange={e => updateMeta('component', 'rel_table', e.target.value)}
                                  className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                                >
                                  <option value="">Selecione...</option>
                                  {models.map((m: any) => (
                                    <option key={m.id} value={m.db_table_name}>{m.display_name || m.db_table_name}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                  <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">Label (Exibição)</label>
                                  <select
                                    value={currentFieldMeta.component?.rel_label || ''}
                                    onChange={e => updateMeta('component', 'rel_label', e.target.value)}
                                    className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                                  >
                                    <option value="">Selecione...</option>
                                    {models.find((m: any) => m.db_table_name === currentFieldMeta.component?.rel_table)?.fields.map((f: any) => (
                                      <option key={f.id} value={f.db_column_name}>{f.display_name || f.db_column_name}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">Value (ID)</label>
                                  <select
                                    value={currentFieldMeta.component?.rel_value || ''}
                                    onChange={e => updateMeta('component', 'rel_value', e.target.value)}
                                    className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                                  >
                                    <option value="">Selecione...</option>
                                    {models.find((m: any) => m.db_table_name === currentFieldMeta.component?.rel_table)?.fields.map((f: any) => (
                                      <option key={f.id} value={f.db_column_name}>{f.display_name || f.db_column_name}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {editingFieldId !== 'TABS' && drawerActiveTab === 'estilos' && (
                <>
                  <button
                      onClick={handleApplyStylesToZone}
                      className="w-full mb-6 flex items-center justify-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 py-3 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors text-xs font-bold"
                    >
                      <Copy className="w-4 h-4" />
                      Aplicar formatação a todos desta zona ({editingFieldZone === 'filter' ? 'Filtro' : editingFieldZone === 'grid' ? 'Grid' : 'Formulário'})
                    </button>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-4 bg-indigo-600 rounded-full"></div>
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">{t('wizard.layout.drawer.label_config')}</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.font')}</label>
                        <select
                          value={currentFieldMeta.label.font}
                          onChange={e => updateMeta('label', 'font', e.target.value)}
                          className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2.5 text-xs font-bold outline-none"
                        >
                          <option value="Inter">{t('wizard.layout.drawer.font_default')}</option>
                          <option value="Roboto">Roboto</option>
                          <option value="Outfit">Outfit</option>
                          <option value="JetBrains Mono">Mono</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.size')}</label>
                        <input
                          type="text"
                          placeholder="Ex: 12px"
                          value={currentFieldMeta.label.size}
                          onChange={e => updateMeta('label', 'size', e.target.value)}
                          className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.text_color')}</label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          value={currentFieldMeta.label.color || '#6366f1'}
                          onChange={e => updateMeta('label', 'color', e.target.value)}
                          className="w-8 h-8 rounded-lg cursor-pointer overflow-hidden border-none p-0"
                        />
                        <input
                          type="text"
                          value={currentFieldMeta.label.color}
                          onChange={e => updateMeta('label', 'color', e.target.value)}
                          placeholder={t('wizard.layout.drawer.text_color')}
                          className="flex-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2 text-xs font-mono font-bold outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-6 border-t border-neutral-100 dark:border-neutral-800">
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-4 bg-emerald-600 rounded-full"></div>
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">{t('wizard.layout.drawer.content_config')}</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.font')}</label>
                        <select
                          value={currentFieldMeta.content.font}
                          onChange={e => updateMeta('content', 'font', e.target.value)}
                          className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2.5 text-xs font-bold outline-none"
                        >
                          <option value="Inter">{t('wizard.layout.drawer.font_default')}</option>
                          <option value="Roboto">Roboto</option>
                          <option value="Outfit">Outfit</option>
                          <option value="JetBrains Mono">Mono</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.size')}</label>
                        <input
                          type="text"
                          placeholder="Ex: 14px"
                          value={currentFieldMeta.content.size}
                          onChange={e => updateMeta('content', 'size', e.target.value)}
                          className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.content_color')}</label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          value={currentFieldMeta.content.color || '#000000'}
                          onChange={e => updateMeta('content', 'color', e.target.value)}
                          className="w-8 h-8 rounded-lg cursor-pointer overflow-hidden border-none p-0"
                        />
                        <input
                          type="text"
                          value={currentFieldMeta.content.color}
                          onChange={e => updateMeta('content', 'color', e.target.value)}
                          placeholder={t('wizard.layout.drawer.content_color')}
                          className="flex-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2 text-xs font-mono font-bold outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* Widget Editor Modal */}
      <Modal
        isOpen={isWidgetModalOpen}
        onClose={() => setIsWidgetModalOpen(false)}
        title="Configurar Widget de BI"
      >
        <div className="space-y-6">
          <BIWidgetConfigEditor 
            editingWidget={editingWidget}
            setEditingWidget={setEditingWidget}
            models={models}
            joins={config.layout_config.joins || []}
            t={t}
          />


          <div className="flex gap-3 pt-6 border-t border-neutral-100 dark:border-neutral-800">
             <button onClick={() => setIsWidgetModalOpen(false)} className="flex-1 px-4 py-3.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">Cancelar</button>
             <button onClick={() => handleSaveWidget(editingWidget)} className="flex-1 px-4 py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-500 shadow-xl shadow-indigo-500/20 transition-all active:scale-95">Salvar Widget</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function StepActions({ config, setConfig, models, useCases, isDownloadsActive, bpmWorkflows }: any) {
  const params = useParams()
  const { workspace_slug, project_slug } = params as { workspace_slug: string, project_slug: string }
  const { t } = useI18n()
  const [isActionModalOpen, setIsActionModalOpen] = useState(false)
  const [editingAction, setEditingAction] = useState<any>(null)
  const [editingActionIndex, setEditingActionIndex] = useState<number | null>(null)
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false)
  const [activeModalTab, setActiveModalTab] = useState<'general' | 'trigger' | 'appearance' | 'bpm'>('general')
  const [selectedButtonConfig, setSelectedButtonConfig] = useState<any>(null)
  const [isButtonPropertiesOpen, setIsButtonPropertiesOpen] = useState(false)

  const isButtonDisabledByModel = (btnId: string) => {
    const masterId = config.selected_models?.[0]
    if (!masterId) return false
    const masterModel = models.find((m: any) => m.id === masterId)
    if (!masterModel) return false
    if (btnId === 'add' && masterModel.can_create === false) return true
    if (btnId === 'edit' && masterModel.can_update === false) return true
    if (btnId === 'delete' && masterModel.can_delete === false) return true
    return false
  }

  const getFieldName = (id: string) => {
    for (const m of models) {
      const f = m.fields?.find((f: any) => f.id === id)
      if (f) {
        return f.display_name || f.db_column_name
      }
    }
    return id
  }

  const getGroupedFields = () => {
    const layout = config.layout_config || {}
    const filterIds = layout.filter_fields || []
    const gridIds = layout.grid_fields || []
    const formIds = layout.form_fields || []
    const masterId = layout.master_model_id || config.selected_models?.[0] || ''

    const filterFields: any[] = []
    const gridFields: any[] = []
    const masterFields: any[] = []
    const detailFields: any[] = []

    models.forEach((m: any) => {
      m.fields?.forEach((f: any) => {
        if (filterIds.includes(f.id)) filterFields.push(f)
        if (gridIds.includes(f.id)) gridFields.push(f)
        if (formIds.includes(f.id)) {
          if (m.id === masterId) masterFields.push(f)
          else detailFields.push(f)
        }
      })
    })
    return { filterFields, gridFields, masterFields, detailFields }
  }

  const handleSaveAction = (action: any) => {
    const currentActions = config.layout_config.custom_actions || []
    const isNew = !currentActions.some((a: any) => a.id === action.id)
    const newActions = isNew
      ? [...currentActions, { ...action, id: action.id || Math.random().toString(36).substr(2, 9) }]
      : currentActions.map((a: any) => a.id === action.id ? action : a)
      
    setConfig({
      ...config,
      layout_config: {
        ...config.layout_config,
        custom_actions: newActions
      }
    })
    setIsActionModalOpen(false)
    setEditingAction(null)
  }

  const handleDeleteAction = (id: string) => {
    setConfig({
      ...config,
      layout_config: {
        ...config.layout_config,
        custom_actions: (config.layout_config.custom_actions || []).filter((a: any) => a.id !== id)
      }
    })
  }

  const strategies = [
    { 
      id: 'dynamic', 
      title: t('wizard.actions.dynamic_query.title'), 
      desc: t('wizard.actions.dynamic_query.desc'), 
      icon: Wand2 
    },
    { 
      id: 'raw', 
      title: t('wizard.actions.raw_sql.title'), 
      desc: t('wizard.actions.raw_sql.desc'), 
      icon: Terminal 
    }
  ]

  const groupedFields = getGroupedFields()

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="space-y-2">
        <h2 className="text-xl font-extrabold tracking-tight text-neutral-900 dark:text-white">{t('wizard.actions.title')}</h2>
        <p className="text-neutral-500 dark:text-neutral-400 text-sm">{t('wizard.actions.subtitle')}</p>
      </div>

      <div className="space-y-6">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.actions.interface_buttons')}</label>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {config.buttons_config.filter((b: any) => b.id !== 'export').map((btn: any) => {
            const isDisabled = isButtonDisabledByModel(btn.id)
            return (
              <div key={btn.id} className="relative group/btn w-full">
                <button
                  type="button"
                  disabled={isDisabled}
                  onClick={() => {
                    setConfig({
                      ...config,
                      buttons_config: config.buttons_config.map((b: any) => 
                        b.id === btn.id ? { ...b, visible: !b.visible } : b
                      )
                    })
                  }}
                  className={cn(
                    "w-full p-4 rounded-[1.5rem] border transition-all flex flex-col items-center justify-center gap-3 min-h-[108px] relative",
                    btn.visible 
                      ? "bg-white dark:bg-neutral-955 border-indigo-600 shadow-lg shadow-indigo-500/5" 
                      : "bg-neutral-50/50 dark:bg-neutral-900/30 border-neutral-200 dark:border-neutral-800 opacity-50",
                    isDisabled && "opacity-30 cursor-not-allowed hover:border-neutral-200 dark:hover:border-neutral-800"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-2xl flex items-center justify-center transition-colors",
                    btn.visible ? "bg-indigo-500 text-white" : "bg-neutral-200 dark:bg-neutral-800 text-neutral-500"
                  )}
                  style={btn.visible ? {
                    backgroundColor: btn.bg_color || undefined,
                    color: btn.text_color || undefined
                  } : undefined}
                  >
                    {btn.icon === 'search' && <Search className="w-5 h-5" />}
                    {btn.icon === 'refresh-ccw' && <RefreshCcw className="w-5 h-5" />}
                    {btn.icon === 'plus' && <Plus className="w-5 h-5" />}
                    {btn.icon === 'pencil' && <Pencil className="w-5 h-5" />}
                    {btn.icon === 'trash' && <Trash2 className="w-5 h-5" />}
                  </div>
                  <span 
                    className={cn(
                      "text-[10px] font-black transition-all truncate max-w-full px-2",
                      (btn.custom_label !== undefined && btn.custom_label !== '') ? "" : "capitalize tracking-wider"
                    )}
                    style={btn.visible ? {
                      fontFamily: (btn.font_family && btn.font_family !== 'Inter (Padrão)') ? btn.font_family : undefined,
                      fontSize: btn.font_size || undefined,
                      color: btn.text_color || undefined,
                      textTransform: (btn.text_transform !== undefined ? (btn.text_transform !== 'none' ? btn.text_transform : undefined) : 'capitalize') as any
                    } : undefined}
                  >
                    {btn.custom_label !== undefined && btn.custom_label !== '' ? btn.custom_label : (t(btn.labelKey) || btn.label)}
                  </span>
                </button>

                {/* Settings Trigger Icon */}
                {!isDisabled && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedButtonConfig({
                        ...btn,
                        custom_label: btn.custom_label !== undefined ? btn.custom_label : (t(btn.labelKey) || btn.label),
                        font_family: btn.font_family || 'Inter (Padrão)',
                        font_size: btn.font_size || '10px',
                        text_color: btn.text_color || '',
                        bg_color: btn.bg_color || '',
                        text_transform: btn.text_transform || 'capitalize'
                      });
                      setIsButtonPropertiesOpen(true);
                    }}
                    className="absolute top-3 right-3 p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-400 opacity-0 group-hover/btn:opacity-100 focus:opacity-100 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all cursor-pointer z-10"
                    title="Propriedades do Botão"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Ações Customizadas</label>
          <button
            onClick={() => {
              setEditingAction({
                id: Math.random().toString(36).substr(2, 9),
                label: 'Nova Ação',
                icon: 'Zap',
                color: 'indigo',
                trigger_type: 'usecase',
                context: 'row',
                sql_query: '',
                usecase_slug: '',
                usecase_params: '',
                usecase_open_mode: 'page',
                rest_url: '',
                rest_method: 'POST',
                rest_body: ''
              })
              setActiveModalTab('general')
              setIsActionModalOpen(true)
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar Ação
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(config.layout_config.custom_actions || []).length === 0 ? (
            <div className="col-span-full p-8 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-[2rem] flex flex-col items-center justify-center text-neutral-400">
              <Zap className="w-6 h-6 mb-2 opacity-50" />
              <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma ação customizada configurada</p>
            </div>
          ) : (
            (config.layout_config.custom_actions || []).map((action: any) => (
              <div key={action.id} className="p-5 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] flex items-center justify-between group shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl bg-${action.color}-100 dark:bg-${action.color}-900/30 text-${action.color}-600 dark:text-${action.color}-400`}>
                    {action.icon === 'Zap' && <Zap className="w-5 h-5" />}
                    {action.icon === 'Link' && <Link className="w-5 h-5" />}
                    {action.icon === 'Database' && <Database className="w-5 h-5" />}
                    {action.icon === 'Globe' && <Globe className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-neutral-900 dark:text-white">{action.label}</h4>
                    <p className="text-[10px] text-neutral-400 uppercase tracking-wider">
                      {action.trigger_type} • {(() => {
                        const activeContexts: string[] = action.contexts
                          ? (Array.isArray(action.contexts) ? action.contexts : [action.contexts])
                          : (action.context ? [action.context] : ['row']);
                        return activeContexts.map(c => {
                          if (c === 'row') return 'Linha (Pesquisa)';
                          if (c === 'bulk') return 'Global (Pesquisa)';
                          if (c === 'master_top') return 'Global (Mestre)';
                          if (c === 'detail_top') return 'Global (Detalhe)';
                          if (c === 'detail_row') return 'Linha (Detalhe)';
                          return c;
                        }).join(', ');
                      })()}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditingAction(action); setActiveModalTab('general'); setIsActionModalOpen(true); }} className="p-2 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl hover:bg-indigo-100"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => handleDeleteAction(action.id)} className="p-2 text-red-600 bg-red-50 dark:bg-red-900/30 rounded-xl hover:bg-red-100"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="space-y-6">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Interface de Ação (Cadastro/Edição)</label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { id: 'drawer', title: 'Drawer (Lateral)', desc: 'Os formulários abrirão em uma gaveta lateral deslizante.', icon: Layout },
            { id: 'modal', title: 'Modal (Central)', desc: 'Os formulários abrirão em uma janela centralizada com fundo escurecido.', icon: Maximize2 },
            { id: 'page', title: 'Mesma Tela (Página)', desc: 'O formulário será exibido na mesma tela, substituindo a lista atual.', icon: Layout }
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setConfig({
                ...config,
                layout_config: { ...config.layout_config, action_interface_type: opt.id }
              })}
              className={cn(
                "p-6 rounded-[2rem] border-2 text-left transition-all relative group overflow-hidden",
                (config.layout_config.action_interface_type || 'drawer') === opt.id
                  ? 'border-indigo-600 bg-indigo-600/5 shadow-xl shadow-indigo-500/10'
                  : 'border-neutral-100 dark:border-neutral-800/50 hover:border-neutral-200 dark:hover:border-neutral-700 bg-white dark:bg-neutral-900/30'
              )}
            >
              <div className="flex items-center gap-4 mb-4">
                <div className={cn(
                  "p-3 rounded-2xl transition-all",
                  (config.layout_config.action_interface_type || 'drawer') === opt.id ? 'bg-indigo-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'
                )}>
                  <opt.icon className="w-5 h-5" />
                </div>
                {(config.layout_config.action_interface_type || 'drawer') === opt.id && <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center text-white"><CheckCircle2 className="w-4 h-4" /></div>}
              </div>
              <h4 className="font-bold text-base text-neutral-900 dark:text-white">{opt.title}</h4>
              <p className="text-[10px] text-neutral-400 mt-2 leading-relaxed">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Exportação de Dados</label>
        
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => {
              const isExportVisible = config.buttons_config.find((b: any) => b.id === 'export')?.visible !== false;
              setConfig({
                ...config,
                buttons_config: config.buttons_config.map((b: any) => 
                  b.id === 'export' ? { ...b, visible: !isExportVisible } : b
                )
              });
            }}
            className={cn(
              "w-full p-6 rounded-[2rem] border-2 text-left transition-all relative group overflow-hidden flex items-center justify-between",
              (config.buttons_config.find((b: any) => b.id === 'export')?.visible !== false)
                ? 'border-indigo-600 bg-indigo-600/5 shadow-xl shadow-indigo-500/10'
                : 'border-neutral-100 dark:border-neutral-800/50 hover:border-neutral-200 dark:hover:border-neutral-700 bg-white dark:bg-neutral-900/30'
            )}
          >
            <div className="flex items-center gap-4">
              <div className={cn(
                "p-3 rounded-2xl transition-all",
                (config.buttons_config.find((b: any) => b.id === 'export')?.visible !== false) ? 'bg-indigo-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'
              )}>
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-base text-neutral-900 dark:text-white">Exportação de Dados (Background)</h4>
                <p className="text-[10px] text-neutral-400 mt-1 leading-relaxed">Permite que os usuários exportem os dados desta tela com processamento assíncrono.</p>
              </div>
            </div>
            <div className={cn(
              "w-12 h-6 rounded-full p-1 transition-all relative cursor-pointer flex items-center",
              (config.buttons_config.find((b: any) => b.id === 'export')?.visible !== false) ? 'bg-indigo-600' : 'bg-neutral-300 dark:bg-neutral-700'
            )}>
              <div className={cn(
                "w-4 h-4 bg-white rounded-full transition-all shadow-md transform",
                (config.buttons_config.find((b: any) => b.id === 'export')?.visible !== false) ? 'translate-x-6' : 'translate-x-0'
              )} />
            </div>
          </button>

          {(config.buttons_config.find((b: any) => b.id === 'export')?.visible !== false) && (
            <div className="p-6 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] space-y-4 animate-in slide-in-from-top-4 fade-in duration-300">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">Formatos Permitidos</label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { id: 'xlsx', label: 'Excel (XLSX)', icon: Table, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-500/20' },
                  { id: 'csv', label: 'CSV', icon: Table, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-500/10', border: 'border-indigo-200 dark:border-indigo-500/20' },
                  { id: 'json', label: 'JSON', icon: Database, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-200 dark:border-amber-500/20' },
                  { id: 'pdf', label: 'PDF', icon: Layout, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-200 dark:border-red-500/20' },
                  { id: 'ofx', label: 'OFX (Finance)', icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/20' }
                ].map(fmt => {
                  const isSelected = (config.layout_config.export_formats || ['xlsx', 'csv', 'json']).includes(fmt.id);
                  return (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => {
                        const current = config.layout_config.export_formats || ['xlsx', 'csv', 'json'];
                        const next = isSelected ? current.filter((f: string) => f !== fmt.id) : [...current, fmt.id];
                        setConfig({
                          ...config,
                          layout_config: { ...config.layout_config, export_formats: next }
                        });
                      }}
                      className={cn(
                        "p-3 rounded-2xl border transition-all flex flex-col items-center gap-2 text-center",
                        isSelected ? cn(fmt.border, fmt.bg) : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-transparent opacity-50 grayscale"
                      )}
                    >
                      <fmt.icon className={cn("w-5 h-5", isSelected ? fmt.color : "text-neutral-400")} />
                      <span className={cn("text-[9px] font-black uppercase tracking-wider", isSelected ? fmt.color : "text-neutral-500")}>{fmt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="h-px bg-neutral-100 dark:bg-neutral-800/50 w-full"></div>

      <div className="space-y-6">
        <div className="space-y-4">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.actions.data_strategy')}</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {strategies.map((s) => (
              <button
                key={s.id}
                onClick={() => setConfig({ ...config, query_type: s.id })}
                className={cn(
                  "p-6 rounded-[2rem] border-2 text-left transition-all relative group overflow-hidden",
                  config.query_type === s.id
                    ? 'border-indigo-600 bg-indigo-600/5 shadow-xl shadow-indigo-500/10'
                    : 'border-neutral-100 dark:border-neutral-800/50 hover:border-neutral-200 dark:hover:border-neutral-700 bg-white dark:bg-neutral-900/30'
                )}
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className={cn(
                    "p-3 rounded-2xl transition-all",
                    config.query_type === s.id ? 'bg-indigo-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'
                  )}>
                    <s.icon className="w-5 h-5" />
                  </div>
                  {config.query_type === s.id && <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center text-white"><CheckCircle2 className="w-4 h-4" /></div>}
                </div>
                <h4 className="font-bold text-base text-neutral-900 dark:text-white">{s.title}</h4>
                <p className="text-[10px] text-neutral-400 mt-2 leading-relaxed">{s.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {config.query_type === 'raw' && (
          <div className="space-y-4 animate-in zoom-in-95 duration-500 mt-6">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.actions.sql_editor')}</label>
            <div className="p-6 bg-neutral-900 rounded-[2rem] border border-neutral-800 shadow-2xl">
              <textarea
                value={config.raw_sql}
                onChange={e => setConfig({ ...config, raw_sql: e.target.value })}
                className="w-full h-40 bg-transparent text-indigo-400 font-mono text-sm outline-none resize-none"
                placeholder="SELECT * FROM table JOIN ..."
              />
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={isActionModalOpen}
        onClose={() => setIsActionModalOpen(false)}
        title={editingAction?.id ? 'Editar Ação Customizada' : 'Nova Ação Customizada'}
        size="2xl"
      >
        {editingAction && (
          <div className="space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar p-1">
            {/* Nav Tabs */}
            <div className="flex border-b border-neutral-200 dark:border-neutral-800 -mx-1 mb-4 shrink-0">
              <button
                type="button"
                onClick={() => setActiveModalTab('general')}
                className={cn(
                  "px-5 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2",
                  activeModalTab === 'general'
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                )}
              >
                <span className={cn(
                  "w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] border",
                  activeModalTab === 'general' ? "bg-indigo-600 border-indigo-600 text-white font-bold" : "border-neutral-300 dark:border-neutral-700"
                )}>1</span>
                Identificação & Aparência
              </button>
              <button
                type="button"
                onClick={() => setActiveModalTab('trigger')}
                className={cn(
                  "px-5 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2",
                  activeModalTab === 'trigger'
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                )}
              >
                <span className={cn(
                  "w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] border",
                  activeModalTab === 'trigger' ? "bg-indigo-600 border-indigo-600 text-white font-bold" : "border-neutral-300 dark:border-neutral-700"
                )}>2</span>
                Comportamento (Trigger)
              </button>
              <button
                type="button"
                onClick={() => setActiveModalTab('bpm')}
                className={cn(
                  "px-5 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2",
                  activeModalTab === 'bpm'
                    ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                    : "border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                )}
              >
                <span className={cn(
                  "w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] border",
                  activeModalTab === 'bpm' ? "bg-emerald-600 border-emerald-600 text-white font-bold" : "border-neutral-300 dark:border-neutral-700"
                )}>3</span>
                BPM / Automação
              </button>
            </div>

            {/* General Tab */}
            {activeModalTab === 'general' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* Left: Button properties */}
                <div className="lg:col-span-6 space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Nome do Botão</label>
                    <input
                      type="text"
                      value={editingAction.label}
                      onChange={e => setEditingAction({ ...editingAction, label: e.target.value })}
                      className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-2 relative">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Ícone</label>
                    <button
                      type="button"
                      onClick={() => setIsIconPickerOpen(true)}
                      className="w-full flex items-center justify-between bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 transition-all hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      <div className="flex items-center gap-3">
                        <DynamicIcon icon={editingAction.icon || 'Zap'} className="w-5 h-5 text-indigo-500" />
                        <span>{editingAction.icon || 'Selecione um ícone...'}</span>
                      </div>
                      <span className="text-[10px] uppercase text-neutral-400 font-bold">Trocar</span>
                    </button>
                    {isIconPickerOpen && (
                      <IconPicker 
                        currentIcon={editingAction.icon || 'Zap'} 
                        onSelect={icon => {
                          setEditingAction({ ...editingAction, icon })
                          setIsIconPickerOpen(false)
                        }}
                        onClose={() => setIsIconPickerOpen(false)}
                      />
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Cor</label>
                    <select
                      value={editingAction.color}
                      onChange={e => setEditingAction({ ...editingAction, color: e.target.value })}
                      className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 transition-all"
                    >
                      <option value="indigo">Índigo (Padrão)</option>
                      <option value="emerald">Verde (Sucesso/Aprovar)</option>
                      <option value="red">Vermelho (Perigo/Rejeitar)</option>
                      <option value="amber">Amarelo (Atenção)</option>
                      <option value="purple">Roxo (Especial)</option>
                    </select>
                  </div>
                </div>

                {/* Right: Context checkboxes */}
                <div className="lg:col-span-6 space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Contexto <span className="normal-case font-normal">(múltipla seleção)</span></label>
                  <div className="grid grid-cols-1 gap-1.5 p-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl">
                    {[
                      { value: 'row', label: 'Ação de Linha (Pesquisa)' },
                      { value: 'bulk', label: 'Ação Global (Topo da Pesquisa)' },
                      { value: 'master_top', label: 'Ação Global (Topo do Mestre)' },
                      { value: 'detail_top', label: 'Ação Global (Topo do Detalhe)' },
                      { value: 'detail_row', label: 'Ação de Linha (Detalhe)' },
                      { value: 'field_group', label: 'Agrupado ao Campo (Formulário)' },
                    ].map(opt => {
                      const activeContexts: string[] = editingAction.contexts
                        ? (Array.isArray(editingAction.contexts) ? editingAction.contexts : [editingAction.contexts])
                        : (editingAction.context ? [editingAction.context] : ['row'])
                      const isChecked = activeContexts.includes(opt.value)
                      return (
                        <label key={opt.value} className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                          <div
                            onClick={() => {
                              const current: string[] = editingAction.contexts
                                ? (Array.isArray(editingAction.contexts) ? editingAction.contexts : [editingAction.contexts])
                                : (editingAction.context ? [editingAction.context] : ['row'])
                              const next = isChecked
                                ? current.filter(c => c !== opt.value)
                                : [...current, opt.value]
                              const safeNext = next.length === 0 ? [opt.value] : next
                              setEditingAction({ ...editingAction, contexts: safeNext, context: safeNext[0] })
                            }}
                            className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all cursor-pointer flex-shrink-0 ${isChecked ? 'bg-indigo-600 border-indigo-600' : 'border-neutral-300 dark:border-neutral-700'}`}
                          >
                            {isChecked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                          </div>
                          <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">{opt.label}</span>
                        </label>
                      )
                    })}
                    
                    {(() => {
                      const activeContexts: string[] = editingAction.contexts
                        ? (Array.isArray(editingAction.contexts) ? editingAction.contexts : [editingAction.contexts])
                        : (editingAction.context ? [editingAction.context] : ['row'])
                      return activeContexts.includes('field_group') ? (
                        <div className="p-3 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-xl mt-2 space-y-3 animate-in fade-in slide-in-from-top-2">
                          <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase tracking-[0.1em] text-indigo-500">Campos Alvo (Selecione um ou mais)</label>
                            <div className="max-h-48 overflow-y-auto custom-scrollbar border border-indigo-100 dark:border-indigo-900/30 rounded-lg bg-white dark:bg-neutral-950 p-3 space-y-4">
                              {/* Filtros */}
                              {groupedFields.filterFields.length > 0 && (
                                <div className="space-y-1.5">
                                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Filtros (Argumentos)</span>
                                  {groupedFields.filterFields.map((f: any) => {
                                    const val = `filter:${f.db_column_name}`;
                                    const legacyVal = f.db_column_name;
                                    const current = editingAction.group_fields || (editingAction.group_field ? [editingAction.group_field] : []);
                                    const isChecked = current.includes(val) || (current.includes(legacyVal) && !current.some((c: string) => c.includes(':')));
                                    return (
                                      <label key={`flt-${f.id}`} className="flex items-center gap-2 cursor-pointer group">
                                        <input type="checkbox" checked={isChecked} onChange={(e) => {
                                          const next = e.target.checked ? [...current.filter((c: string) => c !== legacyVal), val] : current.filter((c: string) => c !== val && c !== legacyVal);
                                          setEditingAction({ ...editingAction, group_fields: next, group_field: next[0]?.split(':').pop() || '' });
                                        }} className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900" />
                                        <span className="text-xs text-neutral-700 dark:text-neutral-300 group-hover:text-indigo-600 transition-colors">{getFieldName(f.id)} ({f.db_column_name})</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                              {/* Grid */}
                              {groupedFields.gridFields.length > 0 && (
                                <div className="space-y-1.5">
                                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Grid (Listagem)</span>
                                  {groupedFields.gridFields.map((f: any) => {
                                    const val = `grid:${f.db_column_name}`;
                                    const legacyVal = f.db_column_name;
                                    const current = editingAction.group_fields || (editingAction.group_field ? [editingAction.group_field] : []);
                                    const isChecked = current.includes(val) || (current.includes(legacyVal) && !current.some((c: string) => c.includes(':')));
                                    return (
                                      <label key={`grd-${f.id}`} className="flex items-center gap-2 cursor-pointer group">
                                        <input type="checkbox" checked={isChecked} onChange={(e) => {
                                          const next = e.target.checked ? [...current.filter((c: string) => c !== legacyVal), val] : current.filter((c: string) => c !== val && c !== legacyVal);
                                          setEditingAction({ ...editingAction, group_fields: next, group_field: next[0]?.split(':').pop() || '' });
                                        }} className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900" />
                                        <span className="text-xs text-neutral-700 dark:text-neutral-300 group-hover:text-indigo-600 transition-colors">{getFieldName(f.id)} ({f.db_column_name})</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                              {/* Master */}
                              {groupedFields.masterFields.length > 0 && (
                                <div className="space-y-1.5">
                                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Mestre (Formulário)</span>
                                  {groupedFields.masterFields.map((f: any) => {
                                    const val = `master:${f.db_column_name}`;
                                    const legacyVal = f.db_column_name;
                                    const current = editingAction.group_fields || (editingAction.group_field ? [editingAction.group_field] : []);
                                    const isChecked = current.includes(val) || (current.includes(legacyVal) && !current.some((c: string) => c.includes(':')));
                                    return (
                                      <label key={`mst-${f.id}`} className="flex items-center gap-2 cursor-pointer group">
                                        <input type="checkbox" checked={isChecked} onChange={(e) => {
                                          const next = e.target.checked ? [...current.filter((c: string) => c !== legacyVal), val] : current.filter((c: string) => c !== val && c !== legacyVal);
                                          setEditingAction({ ...editingAction, group_fields: next, group_field: next[0]?.split(':').pop() || '' });
                                        }} className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900" />
                                        <span className="text-xs text-neutral-700 dark:text-neutral-300 group-hover:text-indigo-600 transition-colors">{getFieldName(f.id)} ({f.db_column_name})</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                              {/* Detail */}
                              {groupedFields.detailFields.length > 0 && (
                                <div className="space-y-1.5">
                                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Detalhes (Formulário)</span>
                                  {groupedFields.detailFields.map((f: any) => {
                                    const val = `detail:${f.db_column_name}`;
                                    const legacyVal = f.db_column_name;
                                    const current = editingAction.group_fields || (editingAction.group_field ? [editingAction.group_field] : []);
                                    const isChecked = current.includes(val) || (current.includes(legacyVal) && !current.some((c: string) => c.includes(':')));
                                    return (
                                      <label key={`dtl-${f.id}`} className="flex items-center gap-2 cursor-pointer group">
                                        <input type="checkbox" checked={isChecked} onChange={(e) => {
                                          const next = e.target.checked ? [...current.filter((c: string) => c !== legacyVal), val] : current.filter((c: string) => c !== val && c !== legacyVal);
                                          setEditingAction({ ...editingAction, group_fields: next, group_field: next[0]?.split(':').pop() || '' });
                                        }} className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900" />
                                        <span className="text-xs text-neutral-700 dark:text-neutral-300 group-hover:text-indigo-600 transition-colors">{getFieldName(f.id)} ({f.db_column_name})</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase tracking-[0.1em] text-indigo-500">Posição</label>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingAction({ ...editingAction, group_position: 'left' })}
                                className={cn("flex-1 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded-md transition-all border", (editingAction.group_position || 'right') === 'left' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-neutral-900 text-neutral-500 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50')}
                              >
                                Esquerda
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingAction({ ...editingAction, group_position: 'right' })}
                                className={cn("flex-1 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded-md transition-all border", (editingAction.group_position || 'right') === 'right' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-neutral-900 text-neutral-500 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50')}
                              >
                                Direita
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : null
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* Trigger Tab */}
            {activeModalTab === 'trigger' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Tipo de Ação (Trigger)</label>
                  <div className="flex p-1 bg-neutral-100 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
                    <button
                      type="button"
                      onClick={() => setEditingAction({ ...editingAction, trigger_type: 'sql' })}
                      className={cn("flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all", editingAction.trigger_type === 'sql' ? 'bg-white dark:bg-neutral-800 shadow text-indigo-600' : 'text-neutral-500')}
                    >
                      SQL / Procedure
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingAction({ ...editingAction, trigger_type: 'usecase' })}
                      className={cn("flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all", editingAction.trigger_type === 'usecase' ? 'bg-white dark:bg-neutral-800 shadow text-indigo-600' : 'text-neutral-500')}
                    >
                      Outra Tela
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingAction({ ...editingAction, trigger_type: 'rest' })}
                      className={cn("flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all", editingAction.trigger_type === 'rest' ? 'bg-white dark:bg-neutral-800 shadow text-indigo-600' : 'text-neutral-500')}
                    >
                      REST API
                    </button>
                  </div>
                </div>

                {editingAction.trigger_type === 'sql' && (
                  <div className="space-y-2 animate-in fade-in zoom-in-95 duration-300">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Comando SQL</label>
                    <p className="text-[9px] text-neutral-500 ml-1 mb-2">Você pode usar variáveis usando chaves duplas: {'{{id}}'}</p>
                    <textarea
                      value={editingAction.sql_query}
                      onChange={e => setEditingAction({ ...editingAction, sql_query: e.target.value })}
                      className="w-full h-32 bg-neutral-950 text-indigo-400 font-mono text-sm p-4 rounded-2xl outline-none resize-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                      placeholder="CALL sp_aprovar_pedido({{id}});"
                    />
                  </div>
                )}

                {editingAction.trigger_type === 'usecase' && (
                  <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300 bg-neutral-50 dark:bg-neutral-900/50 p-4 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Caso de Uso de Destino</label>
                        <select
                          value={editingAction.usecase_slug}
                          onChange={e => setEditingAction({ ...editingAction, usecase_slug: e.target.value })}
                          className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold focus:border-indigo-500 outline-none transition-all"
                        >
                          <option value="">Selecione um caso de uso...</option>
                          {isDownloadsActive && <option value="downloads">📁 Central de Downloads</option>}
                          {useCases?.filter((uc: any) => uc.slug !== config.slug).map((uc: any) => (
                            <option key={uc.slug} value={uc.slug}>{uc.name} ({uc.slug})</option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Modo de Abertura</label>
                        <select
                          value={editingAction.usecase_open_mode || 'page'}
                          onChange={e => setEditingAction({ ...editingAction, usecase_open_mode: e.target.value })}
                          className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold focus:border-indigo-500 outline-none transition-all"
                        >
                          <option value="page">Mesma Tela (Navegação Padrão)</option>
                          <option value="modal">Modal (Centralizado)</option>
                          <option value="drawer">Drawer (Lateral)</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Campos do Registro como Parâmetros</label>
                        <div className="space-y-4 p-4 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl max-h-48 overflow-y-auto custom-scrollbar">
                          {models?.filter((m: any) => config.selected_models?.includes(m.id)).map((model: any) => (
                            <div key={model.id} className="space-y-2">
                              <div className="flex items-center gap-2 mb-1">
                                <div className="w-1 h-3 bg-indigo-500 rounded-full"></div>
                                <span className="text-[9px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                                  {model.display_name || model.db_table_name}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {model.fields?.map((field: any) => {
                                  const isSelected = (editingAction.usecase_selected_fields || []).includes(field.db_column_name)
                                  return (
                                    <button
                                      key={field.id}
                                      type="button"
                                      onClick={() => {
                                        const current = editingAction.usecase_selected_fields || []
                                        const next = isSelected 
                                          ? current.filter((f: string) => f !== field.db_column_name)
                                          : [...current, field.db_column_name]
                                        setEditingAction({ ...editingAction, usecase_selected_fields: next })
                                      }}
                                      className={cn(
                                        "px-2.5 py-1.5 text-[10px] font-bold rounded-lg border transition-all",
                                        isSelected 
                                          ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-500/20" 
                                          : "bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-indigo-500"
                                      )}
                                    >
                                      {field.display_name || field.db_column_name}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                          {(!models || models.filter((m: any) => config.selected_models?.includes(m.id)).length === 0) && (
                            <p className="text-[10px] text-neutral-400 p-1">Nenhum modelo selecionado no passo 1.</p>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Parâmetros Adicionais Fixos (Filtros na URL)</label>
                        <p className="text-[9px] text-neutral-500 ml-1 mb-2">Ex: status=ativo&tipo=1</p>
                        <input
                          type="text"
                          value={editingAction.usecase_params}
                          onChange={e => setEditingAction({ ...editingAction, usecase_params: e.target.value })}
                          className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-mono focus:border-indigo-500 outline-none transition-all"
                          placeholder="status=ativo"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {editingAction.trigger_type === 'rest' && (
                  <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300 bg-neutral-50 dark:bg-neutral-900/50 p-4 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                    <div className="flex gap-4">
                      <div className="space-y-2 w-1/3">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Método</label>
                        <select
                          value={editingAction.rest_method}
                          onChange={e => setEditingAction({ ...editingAction, rest_method: e.target.value })}
                          className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 transition-all"
                        >
                          <option value="GET">GET</option>
                          <option value="POST">POST</option>
                          <option value="PUT">PUT</option>
                          <option value="DELETE">DELETE</option>
                        </select>
                      </div>
                      <div className="space-y-2 flex-1">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">URL da API / Webhook</label>
                        <input
                          type="text"
                          value={editingAction.rest_url}
                          onChange={e => setEditingAction({ ...editingAction, rest_url: e.target.value })}
                          className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-mono focus:border-indigo-500 outline-none transition-all"
                          placeholder="https://api.exemplo.com/hook/{{id}}"
                        />
                      </div>
                    </div>
                    {['POST', 'PUT', 'PATCH'].includes(editingAction.rest_method) && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Body (JSON Payload)</label>
                        <textarea
                          value={editingAction.rest_body}
                          onChange={e => setEditingAction({ ...editingAction, rest_body: e.target.value })}
                          className="w-full h-32 bg-neutral-950 text-indigo-400 font-mono text-xs p-4 rounded-2xl outline-none resize-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                          placeholder={'{\n  "id": "{{id}}",\n  "status": "aprovado"\n}'}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* BPM / Automação Tab */}
            {activeModalTab === 'bpm' && (
              <div className="grid grid-cols-1 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="space-y-4">
                  <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-4 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-800/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                      <Workflow className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-1">Integração com BPM</h4>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300/80 leading-relaxed">
                        Selecione quais fluxos automatizados (BPM) serão disparados quando o usuário clicar neste botão. Você também pode configurar esta ligação diretamente na tela de Automações.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Workflows Disponíveis</label>
                    <div className="grid grid-cols-1 gap-2 p-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl max-h-[300px] overflow-y-auto custom-scrollbar">
                      {bpmWorkflows.length === 0 ? (
                        <div className="text-center py-6">
                          <p className="text-xs text-neutral-500">Nenhum fluxo de automação criado neste projeto.</p>
                          <Link href={`/admin/${workspace_slug}/${project_slug}/automations`} target="_blank" className="text-xs text-emerald-600 hover:underline font-bold mt-2 inline-block">
                            Criar Primeiro Fluxo
                          </Link>
                        </div>
                      ) : (
                        bpmWorkflows.map((workflow: any) => {
                          const linkedWorkflows = editingAction.linked_bpm_workflows || [];
                          const isChecked = linkedWorkflows.includes(workflow.id);
                          return (
                            <label key={workflow.id} className={cn(
                              "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border-2",
                              isChecked 
                                ? "bg-white dark:bg-neutral-800 border-emerald-500 shadow-sm" 
                                : "bg-white dark:bg-neutral-800 border-transparent hover:border-emerald-200 dark:hover:border-emerald-800"
                            )}>
                              <div className={cn(
                                "w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all",
                                isChecked ? "bg-emerald-500 text-white" : "border-2 border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-900"
                              )}>
                                {isChecked && <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={cn("text-sm font-bold truncate transition-colors", isChecked ? "text-emerald-700 dark:text-emerald-400" : "text-neutral-700 dark:text-neutral-300")}>
                                  {workflow.name}
                                </p>
                              </div>
                              <input 
                                type="checkbox" 
                                className="hidden"
                                checked={isChecked}
                                onChange={(e) => {
                                  const next = e.target.checked 
                                    ? [...linkedWorkflows, workflow.id] 
                                    : linkedWorkflows.filter((id: string) => id !== workflow.id);
                                  setEditingAction({ ...editingAction, linked_bpm_workflows: next });
                                }}
                              />
                            </label>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-6 border-t border-neutral-100 dark:border-neutral-800 mt-6">
              <button type="button" onClick={() => setIsActionModalOpen(false)} className="flex-1 px-4 py-3 bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all">Cancelar</button>
              <button type="button" onClick={() => handleSaveAction(editingAction)} className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-500 shadow-xl shadow-indigo-500/20 transition-all active:scale-95">Salvar Ação</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Button Properties Modal */}
      <Modal
        isOpen={isButtonPropertiesOpen}
        onClose={() => setIsButtonPropertiesOpen(false)}
        title={`Propriedades do Botão: ${selectedButtonConfig ? (selectedButtonConfig.id === 'search' ? 'Pesquisar' : selectedButtonConfig.id === 'clear' ? 'Limpar' : selectedButtonConfig.id === 'view' ? 'Visualizar' : selectedButtonConfig.id === 'add' ? 'Novo Registro' : selectedButtonConfig.id === 'edit' ? 'Editar' : selectedButtonConfig.id === 'delete' ? 'Excluir' : selectedButtonConfig.label) : ''}`}
        size="md"
      >
        {selectedButtonConfig && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Texto de Exibição</label>
              <input
                type="text"
                value={selectedButtonConfig.custom_label}
                onChange={e => setSelectedButtonConfig({ ...selectedButtonConfig, custom_label: e.target.value })}
                className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold focus:border-indigo-500 outline-none transition-all"
                placeholder={t(selectedButtonConfig.labelKey) || selectedButtonConfig.label}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Fonte</label>
                <select
                  value={selectedButtonConfig.font_family}
                  onChange={e => setSelectedButtonConfig({ ...selectedButtonConfig, font_family: e.target.value })}
                  className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 transition-all"
                >
                  <option value="Inter">Inter (Padrão)</option>
                  <option value="Roboto">Roboto</option>
                  <option value="Outfit">Outfit</option>
                  <option value="JetBrains Mono">Mono (JetBrains)</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Tamanho</label>
                <input
                  type="text"
                  value={selectedButtonConfig.font_size}
                  onChange={e => setSelectedButtonConfig({ ...selectedButtonConfig, font_size: e.target.value })}
                  className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold focus:border-indigo-500 outline-none transition-all"
                  placeholder="Ex: 10px"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Transformação do Texto</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: 'none', label: 'Normal', example: 'Aa' },
                  { value: 'uppercase', label: 'UPPER', example: 'AA' },
                  { value: 'capitalize', label: 'Iniciais', example: 'Aa' },
                  { value: 'lowercase', label: 'lower', example: 'aa' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedButtonConfig({ ...selectedButtonConfig, text_transform: opt.value })}
                    className={cn(
                      "flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all",
                      (selectedButtonConfig.text_transform || 'capitalize') === opt.value
                        ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600"
                        : "border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:border-indigo-300"
                    )}
                  >
                    <span
                      className="text-base font-black"
                      style={{ textTransform: opt.value as any, fontStyle: opt.value === 'none' ? 'italic' : 'normal' }}
                    >
                      {opt.example}
                    </span>
                    <span className="text-[8px] font-black uppercase tracking-wider">{opt.label}</span>
                  </button>
                ))}
              </div>
              {/* Live preview */}
              <div className="mt-3 flex items-center justify-center p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl">
                <span
                  className="text-sm font-bold text-neutral-700 dark:text-neutral-300"
                  style={{
                    textTransform: ((selectedButtonConfig.text_transform || 'capitalize') !== 'none' ? selectedButtonConfig.text_transform : undefined) as any,
                    fontFamily: (selectedButtonConfig.font_family && selectedButtonConfig.font_family !== 'Inter (Padrão)') ? selectedButtonConfig.font_family : undefined,
                    fontSize: selectedButtonConfig.font_size || undefined,
                    color: selectedButtonConfig.text_color || undefined,
                    backgroundColor: selectedButtonConfig.bg_color || undefined,
                  }}
                >
                  {selectedButtonConfig.custom_label || 'Preview do Botão'}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Cor do Texto</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={selectedButtonConfig.text_color || '#ffffff'}
                  onChange={e => setSelectedButtonConfig({ ...selectedButtonConfig, text_color: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer overflow-hidden border-none p-0 shrink-0"
                />
                <input
                  type="text"
                  value={selectedButtonConfig.text_color}
                  onChange={e => setSelectedButtonConfig({ ...selectedButtonConfig, text_color: e.target.value })}
                  placeholder="Hexadecimal da cor do texto (ex: #ffffff)"
                  className="flex-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-xs font-mono font-bold outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Cor do Botão (Fundo)</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={selectedButtonConfig.bg_color || '#6366f1'}
                  onChange={e => setSelectedButtonConfig({ ...selectedButtonConfig, bg_color: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer overflow-hidden border-none p-0 shrink-0"
                />
                <input
                  type="text"
                  value={selectedButtonConfig.bg_color}
                  onChange={e => setSelectedButtonConfig({ ...selectedButtonConfig, bg_color: e.target.value })}
                  placeholder="Hexadecimal da cor de fundo (ex: #6366f1)"
                  className="flex-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-xs font-mono font-bold outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-6 border-t border-neutral-100 dark:border-neutral-800 mt-6">
              <button
                type="button"
                onClick={() => setIsButtonPropertiesOpen(false)}
                className="flex-1 px-4 py-3 bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 rounded-2xl font-black text-[10px] capitalize tracking-wider hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfig({
                    ...config,
                    buttons_config: config.buttons_config.map((b: any) =>
                      b.id === selectedButtonConfig.id ? selectedButtonConfig : b
                    )
                  });
                  setIsButtonPropertiesOpen(false);
                }}
                className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] capitalize tracking-wider hover:bg-indigo-500 shadow-xl shadow-indigo-500/20 transition-all active:scale-95"
              >
                Confirmar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function DraggableFieldCard({ field }: { field: any }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `source-${field.id}`,
    data: { fieldId: field.id }
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "py-2.5 px-4 bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-2xl flex items-center justify-between group cursor-grab active:cursor-grabbing hover:border-indigo-200 dark:hover:border-indigo-800/50 hover:shadow-md transition-all",
        isDragging && "opacity-20 grayscale"
      )}
    >
      <div className="flex items-center justify-between w-full">
        <span className="text-xs font-bold text-neutral-700 dark:text-neutral-200">{field.display_name || field.db_column_name}</span>
        <span className="text-[8px] font-black font-mono text-neutral-400 bg-neutral-100 dark:bg-neutral-900 px-2 py-0.5 rounded-md opacity-60 uppercase">{field.data_type}</span>
      </div>
    </div>
  )
}

function DroppableZone({ id, children, className }: any) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div 
      ref={setNodeRef} 
      className={cn(
        className, 
        "transition-all duration-300 relative",
        isOver && "bg-indigo-100/50 dark:bg-indigo-900/30 border-indigo-500 border-solid scale-[1.02] shadow-[0_0_40px_rgba(99,102,241,0.15)] ring-4 ring-indigo-500/10"
      )}
    >
      {isOver && (
        <div className="absolute inset-0 bg-indigo-500/5 pointer-events-none rounded-[inherit] animate-pulse"></div>
      )}
      {children}
    </div>
  )
}

function DraggableTableHeader({ model, isCollapsed, onToggle }: any) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `table-source-${model.id}`,
    data: { tableId: model.id, isTable: true }
  })

  return (
    <div 
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // Se estiver arrastando, não ativa o toggle
        if (isDragging) return;
        onToggle();
      }}
      className={cn(
        "sticky top-0 z-20 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md px-5 py-4 flex items-center justify-between cursor-pointer group/header border-b border-neutral-100 dark:border-neutral-800/50 shadow-sm transition-all",
        isDragging && "opacity-20 grayscale"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-4 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
        <div className="flex flex-col">
          <span className="text-[11px] font-black text-neutral-900 dark:text-white uppercase tracking-[0.15em]">{model.display_name || model.db_table_name}</span>
          <span className="text-[8px] font-bold text-indigo-500/0 group-hover:text-indigo-500 transition-all uppercase tracking-widest leading-none mt-1">Arraste para add tudo</span>
        </div>
      </div>
      <div className="p-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-400 group-hover/header:text-indigo-500 group-hover/header:bg-indigo-50 dark:group-hover/header:bg-indigo-500/10 transition-all">
        {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
      </div>
    </div>
  )
}

function SortableFieldChip({ id, itemValue, toggleField, onEdit, children, zoneType }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { 
    transform: CSS.Transform.toString(transform), 
    transition,
    ...(isDragging ? { opacity: 0.5, zIndex: 50, position: 'relative' } : {})
  }

  const colorClasses = {
    filter: 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20',
    grid: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20',
    form: 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/20'
  }

  const activeColor = colorClasses[zoneType as keyof typeof colorClasses] || colorClasses.filter

  return (
    <div
      ref={setNodeRef}
      style={style as any}
      {...attributes}
      {...listeners}
      onClick={onEdit}
      className={cn(
        "flex items-center justify-between gap-2 px-3 py-2 text-white rounded-xl shadow-lg group cursor-pointer transition-all select-none w-full min-w-0",
        activeColor
      )}
    >
      <div className="flex-1 min-w-0 truncate">
        {children}
      </div>
      <Trash2
        className="w-3.5 h-3.5 flex-shrink-0 cursor-pointer hover:text-red-200 transition-colors"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); toggleField(itemValue, `${zoneType}_fields`); }}
      />
    </div>
  )
}

function SortableWidgetCard({ widget, onEdit, onDelete, getFieldName }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `widget-${widget.id}` })
  const style = { 
    transform: CSS.Transform.toString(transform), 
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1
  }

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[1.5rem] flex items-center justify-between group shadow-sm hover:border-indigo-300 transition-all relative overflow-hidden"
    >
      <div className="flex items-center gap-3 relative z-10">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1.5 text-neutral-300 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all">
          <GripVertical className="w-4 h-4" />
        </div>
        <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
          {widget.type === 'kpi' ? <Activity className="w-5 h-5" /> : widget.type === 'gauge' ? <Gauge className="w-5 h-5" /> : <BarChart3 className="w-5 h-5" />}
        </div>
        <div>
          <h5 className="text-xs font-black uppercase tracking-tight text-neutral-900 dark:text-white">{widget.title}</h5>
          <p className="text-[9px] text-neutral-400 uppercase font-black tracking-widest">{widget.type} • {widget.calc} ({getFieldName(widget.field) || 'Toda Tabela'})</p>
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all relative z-10">
        <button onClick={onEdit} className="p-2 text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all"><Pencil className="w-3.5 h-3.5" /></button>
        <button onClick={onDelete} className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  )
}

function DraggableItem({ id, children, className }: any) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: id
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(className, isDragging && "opacity-20 grayscale")}
    >
      {children}
    </div>
  )
}
