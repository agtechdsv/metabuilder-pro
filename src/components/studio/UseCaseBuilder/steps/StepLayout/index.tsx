import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import FormulaBuilder from '../../../FormulaBuilder'
import {
  Settings2, Database, Layout, MousePointer2, Plus, Trash2,
  CheckCircle2, AlertCircle, Loader2, Search, Pencil, RefreshCcw,
  Table, GripVertical, SlidersHorizontal, ArrowRightLeft, ArrowRight,
  Type, Palette, Maximize2, Lock, Type as FontIcon, Share2, Columns,
  Settings, LayoutGrid, Wand2, Terminal, RotateCcw, Link as LinkIcon, Layers,
  Activity, History, Gauge, BarChart3, BarChartHorizontal, Calendar,
  Download, Zap, Globe, Copy, FileText, FileSpreadsheet, Workflow,
  Check, X, Eye, EyeOff, ChevronDown, ChevronUp
} from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'
import { getModelsWithRelations } from '@/lib/relationPathFinder'
import { Drawer } from '@/components/ui/Drawer'
import { Modal } from '@/components/ui/Modal'
import { IconPicker } from '../../../IconPicker'
import { BIWidgetEditor as BIWidgetConfigEditor } from '@/components/shared/BIWidgetEditor'
import {
  DndContext, rectIntersection, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent, DragOverlay
} from '@dnd-kit/core'
import {
  SortableContext, rectSortingStrategy, horizontalListSortingStrategy, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates
} from '@dnd-kit/sortable'
import { motion, useDragControls } from 'framer-motion'
import { createDefaultFieldMeta } from '../../utils'
import { DroppableZone, SortableFieldChip, DraggableItem, SortableWidgetCard, DraggableFieldCard, DraggableTableHeader } from './dnd'
import { MultiLevelPathBuilder } from '../StepPersonalizado'
import { FieldDrawer } from './FieldDrawer'
import { AnalyticsSection } from './AnalyticsSection'
import { SpecialLayouts } from './SpecialLayouts'
import { FieldSourcePanel } from './FieldSourcePanel'

export function StepLayout({ config, setConfig, models, enumerations = [], relations = [], useCases = [], orderedModels = [] }: any) {
  const { t } = useI18n()
  const { toast } = useToast()
  const [expandedCustomSlot, setExpandedCustomSlot] = useState<number | null>(null)
  const [tabToDelete, setTabToDelete] = useState<number | null>(null)
  const [editingSlotTabIconIndex, setEditingSlotTabIconIndex] = useState<number | null>(null)

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
      component: { type: 'text', rows: 3, width: '100%', options_type: 'relational', fixed_options: '', rel_table: '', rel_label: '', rel_value: '' },
      viacep: { enabled: false, logradouro: '', bairro: '', cidade: '', uf: '' }
    }
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Santo Graal helpers para Personalizado Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  // Retorna todos os models alcanÃƒÂ§ÃƒÂ¡veis a partir de um model_id via BFS do Santo Graal.
  // Usa max_relation_depth definido na etapa 2 do wizard.
  function getSlotRelatedFieldGroups(slotModelId: string) {
    const slotModel = models.find((m: any) => m.id === slotModelId)
    if (!slotModel) return []
    const maxDepth = config.layout_config?.max_relation_depth ?? 2
    return getModelsWithRelations([slotModel], relations, models, maxDepth)
  }

  // Retorna a lista de modelos alcanÃƒÂ§ÃƒÂ¡veis a partir da tabela raiz do caso de uso (para o combo TABELA MODEL)
  function getRootRelatedModels() {
    const rootId = config.layout_config?.master_model_id || config.selected_models?.[0]
    const rootModel = models.find((m: any) => m.id === rootId)
    if (!rootModel) return []
    const maxDepth = config.layout_config?.max_relation_depth ?? 2
    return getModelsWithRelations([rootModel], relations, models, maxDepth)
  }

  // Renderiza <optgroup>/<option> agrupados por tabela, compatÃƒÂ­vel com a imagem 3.
  // noneLabel: texto da opÃƒÂ§ÃƒÂ£o vazia (e.g. "Selecione o campo...")
  // includeNone: se true, adiciona opÃƒÂ§ÃƒÂ£o vazia no inÃƒÂ­cio
  function renderSlotFieldOptions(slotModelId: string, includeNone = true, noneLabel = 'Selecione o campo...') {
    const groups = getSlotRelatedFieldGroups(slotModelId)
    return (
      <>
        {includeNone && <option value="">{noneLabel}</option>}
        {groups.map((g: any) => (
          <optgroup key={`grp-${g.model.id}-${g.prefix}`} label={g.label} className="text-[10px] font-bold text-blue-600 dark:text-blue-400 normal-case">
            {(g.model.fields || []).map((f: any) => (
              <option
                key={`${g.model.id}-${f.id}`}
                value={g.prefix ? `${g.prefix}${f.db_column_name}` : f.db_column_name}
                className="text-neutral-800 dark:text-neutral-200 normal-case"
              >
                {String(f.db_column_name).toLowerCase()}
              </option>
            ))}
          </optgroup>
        ))}
      </>
    )
  }
  const [expandedZones, setExpandedZones] = useState<Record<string, boolean>>({
    masterDetail: true,
    joins: true,
    zone01: true,
    zone02: true,
    zone03: true
  })
  const toggleZone = (zone: string) => setExpandedZones(prev => ({ ...prev, [zone]: !prev[zone] }))
  const [hiddenDetails, setHiddenDetails] = useState<Set<string>>(new Set())
  const [retractedModels, setRetractedModels] = useState<Set<string>>(new Set())
  const hasInitializedRetractedRef = useRef(false)

  useEffect(() => {
    if (models.length > 0 && !hasInitializedRetractedRef.current) {
      const rootId = config.layout_config?.master_model_id || config.selected_models?.[0]
      const newRetracted = new Set<string>()
      models.forEach((m: any) => {
        if (m.id !== rootId) {
          newRetracted.add(m.id)
        }
      })
      setRetractedModels(newRetracted)
      hasInitializedRetractedRef.current = true
    }
  }, [models, config.layout_config])

  const [hiddenZones, setHiddenZones] = useState<Set<string>>(new Set())
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null)
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editingFieldZone, setEditingFieldZone] = useState<string | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [drawerActiveTab, setDrawerActiveTab] = useState<'geral' | 'estilos' | 'logica'>('geral')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [collapsedTables, setCollapsedTables] = useState<Record<string, boolean>>({})
  const [fieldSearchTerm, setFieldSearchTerm] = useState('')
  const dragControls = useDragControls()

  const [editingWidget, setEditingWidget] = useState<any>(null)
  const [isWidgetModalOpen, setIsWidgetModalOpen] = useState(false)
  const [editingSlotBIWidget, setEditingSlotBIWidget] = useState<{ slotIdx: number, widget: any } | null>(null)
  const [isSlotWidgetModalOpen, setIsSlotWidgetModalOpen] = useState(false)
  const [editingSlotIconIndex, setEditingSlotIconIndex] = useState<number | null>(null)

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

          // Filtra os campos que possuem permissÃƒÂ£o para entrar na zona correspondente
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
            toast('Nenhum novo campo permitido pÃƒÂ´de ser adicionado a esta zona.', 'info')
          }
        } else {
          const isVirtualTool = id === 'virtual_calc_tool';
          const fieldId = isVirtualTool ? `virt_${Math.random().toString(36).substring(2, 10)}` : id;

          // Achar o campo no modelo para validar
          let fieldObj: any = null
          if (!isVirtualTool) {
            for (const m of models) {
              fieldObj = m.fields.find((f: any) => f.id === fieldId)
              if (fieldObj) break
            }

            if (fieldObj) {
              if (targetZone === 'grid_fields' && fieldObj.is_visible_in_list === false) {
                toast(`O campo "${fieldObj.display_name || fieldObj.db_column_name}" estÃƒÂ¡ configurado como nÃƒÂ£o visÃƒÂ­vel no grid.`, 'error')
                return
              }
              if (targetZone === 'form_fields' && fieldObj.is_visible_in_form === false) {
                toast(`O campo "${fieldObj.display_name || fieldObj.db_column_name}" estÃƒÂ¡ configurado como nÃƒÂ£o visÃƒÂ­vel no formulÃƒÂ¡rio.`, 'error')
                return
              }
              if (targetZone === 'filter_fields' && fieldObj.is_searchable === false) {
                toast(`O campo "${fieldObj.display_name || fieldObj.db_column_name}" estÃƒÂ¡ configurado como nÃƒÂ£o pesquisÃƒÂ¡vel (nÃƒÂ£o visÃƒÂ­vel no filtro).`, 'error')
                return
              }
            }
          }

          const currentFields = [...config.layout_config[targetZone]]
          if (!currentFields.includes(fieldId)) {
            if (targetZone === 'filter_fields' && (!config.has_arguments || config.logic_type === 'cadastro')) return
            if (targetZone === 'form_fields' && config.logic_type === 'pesquisa') return

            currentFields.push(fieldId)

            const newMetadata = { ...(config.layout_config.fields_metadata || {}) }
            if (isVirtualTool) {
              let assignedModelId = null;
              if (targetZone === 'form_fields' && overIdStr.startsWith('droppable-form-')) {
                assignedModelId = overIdStr.replace('droppable-form-', '');
              } else if (targetZone === 'form_fields' && overIdStr.startsWith('form-')) {
                const droppedOnFieldId = overIdStr.replace('form-', '');
                for (const m of models) {
                  if (m.fields.some((f: any) => f.id === droppedOnFieldId)) {
                    assignedModelId = m.id;
                    break;
                  }
                }
                // Herda a zona caso tenha sido solto em cima de outro campo virtual
                if (!assignedModelId && droppedOnFieldId.startsWith('virt_')) {
                  assignedModelId = config.layout_config.fields_metadata?.[droppedOnFieldId]?.virtual_model_id || null;
                }
              }

              newMetadata[fieldId] = {
                label: { text: 'Campo Calculado', show: true, position: 'top', width: 'auto' },
                content: { readonly: true, formula_tokens: [] },
                component: { type: 'virtual_calc', rel_table: '', rel_value: '', rel_label: '', fixed_options: '' },
                viacep: { enabled: false },
                virtual_model_id: assignedModelId
              }
            }

            setConfig({
              ...config,
              layout_config: {
                ...config.layout_config,
                [targetZone]: currentFields,
                fields_metadata: newMetadata
              }
            })
            toast(t('common.success', 'Campo adicionado com sucesso!'), 'success')
          } else {
            toast(t('common.info', 'Este campo jÃƒÂ¡ estÃƒÂ¡ nesta zona.'), 'info')
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

  // BFS from the root table through the relations graph to discover all reachable tables.
  // This replaces the old join-config-based tree Ã¢â‚¬â€ the dev only selects the root table now.
  const renderFieldOptions = (models: any[], filterFn?: (f: any) => boolean) => {
    return models.map((m: any) => {
      const fields = filterFn ? m.fields.filter(filterFn) : m.fields;
      if (!fields || fields.length === 0) return null;
      return (
        <optgroup key={`group-${m.id}`} label={m.display_name || m.db_table_name} className="text-[10px] font-bold text-blue-600 dark:text-blue-400 normal-case">
          {fields.map((f: any) => (
            <option key={`opt-${f.id}`} value={f.id} className="text-neutral-800 dark:text-neutral-200 normal-case">
              {String(f.db_column_name).toLowerCase()}
            </option>
          ))}
        </optgroup>
      );
    });
  };



  const formTree = (() => {
    if (config.logic_type === 'analytics') return models

    const rootId = config.layout_config.master_model_id || config.selected_models[0]
    const rootModel = models.find((m: any) => m.id === rootId)
    if (!rootModel) return models.filter((m: any) => config.selected_models.includes(m.id))

    const maxDepth = config.layout_config?.max_relation_depth || 2

    const buildTree = (modelId: string, depth: number, visited: Set<string>): any[] => {
      if (depth >= maxDepth + 1) return [] // depth is 0-indexed. If max_relation_depth is 1, depth 0 is root, depth 1 is detail. So max allowed depth is max_relation_depth.

      const childRelations = relations.filter((r: any) => r.to_model_id === modelId && !visited.has(r.from_model_id))

      return childRelations.map((r: any) => {
        const childModel = models.find((m: any) => m.id === r.from_model_id)
        if (!childModel) return null

        const newVisited = new Set(visited)
        newVisited.add(r.from_model_id)

        return {
          ...childModel,
          children: buildTree(childModel.id, depth + 1, newVisited)
        }
      }).filter(Boolean)
    }

    return [{
      ...rootModel,
      children: buildTree(rootId, 1, new Set([rootId]))
    }]
  })()

  const getAvailableSlotFields = (modelIdOrName: string) => {
    const slotModel = models.find((m: any) => m.id === modelIdOrName || m.db_table_name === modelIdOrName);
    if (!slotModel) return [];

    const fields: { id: string, value: string, label: string, isJoined: boolean, modelName: string }[] = [];

    // Base fields
    (slotModel.fields || []).forEach((f: any) => {
      fields.push({
        id: f.id,
        value: f.db_column_name,
        label: f.display_name || f.db_column_name,
        isJoined: false,
        modelName: slotModel.display_name || slotModel.db_table_name
      });

      // NOVO: ExpansÃƒÂ£o via Santo Graal (Relacionamentos)
      // Se este campo for uma FK (chave estrangeira) formal ou por heurÃƒÂ­stica
      const isFK = (relations || []).find((r: any) => r.foreign_column_id === f.id) ||
        (f.foreign_key_table && models.find((m: any) => m.db_table_name === f.foreign_key_table));

      let heuristicRelatedModel = null;
      if (!isFK && f.db_column_name.toLowerCase().endsWith('_id')) {
        const baseName = f.db_column_name.toLowerCase().replace(/_id$/, '');
        const potentialTableNames = [baseName, `${baseName}s`, `${baseName}es`];
        heuristicRelatedModel = models.find((m: any) => potentialTableNames.includes(m.db_table_name?.toLowerCase()));
      }

      if (isFK || heuristicRelatedModel) {
        const relatedModelId = isFK?.referenced_table_id || models.find((m: any) => m.db_table_name === f.foreign_key_table)?.id || heuristicRelatedModel?.id;
        const relatedModel = models.find((m: any) => m.id === relatedModelId);

        if (relatedModel) {
          (relatedModel.fields || []).forEach((rf: any) => {
            fields.push({
              id: `${f.id}_${rf.id}`,
              value: `${f.db_column_name}.${rf.db_column_name}`, // PadrÃƒÂ£o: produto_id.nome
              label: `${f.display_name || f.db_column_name} -> ${rf.display_name || rf.db_column_name}`,
              isJoined: true,
              modelName: relatedModel.display_name || relatedModel.db_table_name
            });
          });
        }
      }
    });

    // Joined fields estÃƒÂ¡ticos (se existirem na config)
    const layout = config.layout_config || {};
    const joins = layout.joins || [];

    if (joins.length > 0) {
      const joinedTables = new Set<string>();
      joins.forEach((j: any) => {
        if (j.from || j.table) joinedTables.add((j.from || j.table).toLowerCase());
        if (j.to || j.toTable) joinedTables.add((j.to || j.toTable).toLowerCase());
      });

      models.forEach((m: any) => {
        const mTable = m.db_table_name?.toLowerCase();
        if (mTable && slotModel.db_table_name && mTable !== slotModel.db_table_name.toLowerCase() && joinedTables.has(mTable)) {
          (m.fields || []).forEach((f: any) => {
            const val = `${mTable}.${f.db_column_name}`;
            if (!fields.find(existing => existing.value === val)) {
              fields.push({
                id: `${mTable}_${f.id}`,
                value: val,
                label: `${m.display_name || m.db_table_name} -> ${f.display_name || f.db_column_name}`,
                isJoined: true,
                modelName: m.display_name || m.db_table_name
              });
            }
          });
        }
      });
    }

    return fields;
  };

  const renderModelZone = (model: any, depth: number = 0, index: number = 0) => {
    const isMaster = depth === 0 && index === 0
    const fieldsOfThisModel = config.layout_config.form_fields.filter((fid: string) => {
      if (fid.startsWith('virt_')) {
        const meta = (config.layout_config.fields_metadata || {})[fid] || {};
        return meta.virtual_model_id === model.id || (!meta.virtual_model_id && isMaster);
      }
      return model.fields.some((f: any) => f.id === fid)
    })

    const tabsMeta = (config.layout_config as any).fields_metadata?.['form-TABS'] || (config.layout_config as any).fields_metadata?.['TABS']
    const tabStyles = {
      fontFamily: tabsMeta?.label?.font?.replace(' (PadrÃƒÂ£o)', ''),
      fontSize: tabsMeta?.label?.size ? (tabsMeta.label.size.includes('px') ? tabsMeta.label.size : `${tabsMeta.label.size}px`) : undefined,
      color: tabsMeta?.label?.color || undefined,
    }

    return (
      <div key={`${model.id}-${depth}-${index}`} className={cn("space-y-4", depth > 0 && "ml-8 border-l-2 border-dashed border-amber-200 dark:border-amber-900/30 pl-6 pb-4")}>
        <div className="flex items-center justify-between ml-1 pr-6">
          <div className="flex items-center gap-2">
            <div className={cn("w-1.5 h-4 rounded-full shadow-sm transition-colors duration-300", fieldsOfThisModel.length > 0 ? "bg-emerald-500 shadow-emerald-500/30" : (isMaster ? "bg-amber-600" : "bg-amber-400"))}></div>
            <div className="flex items-center gap-2 group relative">
              <span className={cn(
                "px-2 py-0.5 rounded-[4px] text-[8px] font-black uppercase tracking-widest",
                isMaster ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
              )}>
                {isMaster ? t('wizard.layout.master', 'Mestre') : depth === 1 ? t('wizard.layout.detail', 'Detalhe') : t('wizard.layout.subdetail', 'Sub-Detalhe')}
              </span>
              {isMaster ? (
                <input
                  type="text"
                  placeholder={model.display_name || model.db_table_name}
                  value={(config.layout_config as any).master_tab_title ?? (model.display_name || model.db_table_name)}
                  onChange={e => setConfig({
                    ...config,
                    layout_config: {
                      ...config.layout_config,
                      master_tab_title: e.target.value
                    }
                  })}
                  style={tabStyles}
                  className="bg-transparent border-none outline-none font-black tracking-widest text-neutral-600 dark:text-neutral-400 placeholder:text-neutral-300 dark:placeholder:text-neutral-700 w-[200px] hover:bg-neutral-100 dark:hover:bg-neutral-900 focus:bg-white dark:focus:bg-neutral-900 focus:ring-2 focus:ring-amber-500/20 rounded px-1.5 py-0.5 transition-all"
                />
              ) : (
                <input
                  type="text"
                  placeholder={model.display_name || model.db_table_name}
                  value={(config.layout_config as any).details_tab_titles?.[model.id] ?? (model.display_name || model.db_table_name)}
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

            <button
              title={hiddenDetails.has(model.id) ? "Exibir formulÃƒÂ¡rio" : "Ocultar formulÃƒÂ¡rio"}
              onClick={() => {
                if (!hiddenDetails.has(model.id)) {
                  const fieldsToKeep = config.layout_config.form_fields.filter((fid: string) => !model.fields.some((f: any) => f.id === fid))
                  setConfig({
                    ...config,
                    layout_config: { ...config.layout_config, form_fields: fieldsToKeep }
                  })
                }
                setHiddenDetails(prev => {
                  const next = new Set(prev)
                  if (next.has(model.id)) next.delete(model.id)
                  else next.add(model.id)
                  return next
                })
              }}
              className="ml-2 p-1.5 text-neutral-400 hover:text-amber-600 dark:hover:text-amber-500 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-sm transition-all"
            >
              {hiddenDetails.has(model.id) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>

            {!isMaster && (
              <button
                type="button"
                title={retractedModels.has(model.id) ? "Expandir" : "Retrair"}
                onClick={() => {
                  setRetractedModels(prev => {
                    const next = new Set(prev)
                    if (next.has(model.id)) next.delete(model.id)
                    else next.add(model.id)
                    return next
                  })
                }}
                className="ml-2 p-1.5 text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-500 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-sm transition-all"
              >
                {retractedModels.has(model.id) ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>

          {!isMaster && !hiddenDetails.has(model.id) && (
            <div className="flex items-center gap-1">
              {/* Abas/SeÃƒÂ§ÃƒÂµes Toggle */}
              <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-950 p-0.5 rounded-lg border border-neutral-200 dark:border-neutral-800">
                {[
                  { id: 'tabs', label: 'Aba', tooltip: 'Exibe os registros deste detalhe em uma aba superior' },
                  { id: 'sections', label: 'SeÃƒÂ§ÃƒÂ£o', tooltip: 'Exibe os registros deste detalhe em uma seÃƒÂ§ÃƒÂ£o empilhada na pÃƒÂ¡gina' }
                ].map(opt => {
                  const currentMode = (config.layout_config as any).details_display_mode?.[model.id] || 'sections'
                  const isActive = currentMode === opt.id
                  return (
                    <button
                      key={opt.id}
                      title={opt.tooltip}
                      onClick={() => {
                        const currentModes = (config.layout_config as any).details_display_mode || {}
                        setConfig({
                          ...config,
                          layout_config: {
                            ...config.layout_config,
                            details_display_mode: {
                              ...currentModes,
                              [model.id]: opt.id
                            }
                          }
                        })
                      }}
                      className={cn(
                        "px-3 py-1 rounded-md text-[8px] font-black uppercase tracking-widest transition-all",
                        isActive
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                          : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'
                      )}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>

              {/* Modal/Drawer Toggle */}
              <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-950 p-0.5 rounded-lg border border-neutral-200 dark:border-neutral-800 ml-1">
                {[
                  { id: 'modal', label: 'Modal', icon: Maximize2, tooltip: 'Abre o formulÃƒÂ¡rio deste detalhe em uma janela central' },
                  { id: 'drawer', label: 'Drawer', icon: Layout, tooltip: 'Abre o formulÃƒÂ¡rio deste detalhe em uma gaveta lateral' }
                ].map(opt => {
                  const currentType = (config.layout_config as any).details_interface_types?.[model.id] || 'modal'
                  const isActive = currentType === opt.id
                  return (
                    <button
                      key={opt.id}
                      title={opt.tooltip}
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

              {((config.layout_config as any).details_interface_types?.[model.id] || 'modal') === 'modal' && (
                <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-950 p-0.5 rounded-lg border border-neutral-200 dark:border-neutral-800 ml-1">
                  <select
                    value={(config.layout_config as any).details_modal_sizes?.[model.id] || 'md'}
                    onChange={(e) => {
                      const currentSizes = (config.layout_config as any).details_modal_sizes || {}
                      setConfig({
                        ...config,
                        layout_config: {
                          ...config.layout_config,
                          details_modal_sizes: {
                            ...currentSizes,
                            [model.id]: e.target.value
                          }
                        }
                      })
                    }}
                    className="bg-transparent border-none outline-none text-[8px] font-black uppercase tracking-wider text-neutral-600 dark:text-neutral-400 px-2 h-full cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800"
                    title="Tamanho da Modal"
                  >
                    <option value="sm" title="Pequeno (max. 384px)">SM</option>
                    <option value="md" title="MÃƒÂ©dio (max. 672px) - PadrÃƒÂ£o">MD</option>
                    <option value="lg" title="Grande (max. 896px)">LG</option>
                    <option value="full" title="Tela Cheia (95% da tela)">FULL</option>
                    <option value="custom" title="Personalizado (em pixels ou %)">CUST</option>
                  </select>

                  {((config.layout_config as any).details_modal_sizes?.[model.id] === 'custom') && (
                    <div className="flex items-center gap-1 ml-1 px-1 border-l border-neutral-200 dark:border-neutral-800">
                      <input
                        type="text"
                        placeholder="Largura"
                        value={(config.layout_config as any).details_modal_widths?.[model.id] || ''}
                        onChange={(e) => {
                          const currentWidths = (config.layout_config as any).details_modal_widths || {}
                          setConfig({
                            ...config,
                            layout_config: {
                              ...config.layout_config,
                              details_modal_widths: {
                                ...currentWidths,
                                [model.id]: e.target.value
                              }
                            }
                          })
                        }}
                        className="w-14 bg-transparent border-none outline-none text-[8px] font-bold text-neutral-600 dark:text-neutral-400 placeholder-neutral-400 dark:placeholder-neutral-600"
                        title="Ex: 800px, 90%"
                      />
                      <span className="text-[8px] font-black text-neutral-400">x</span>
                      <input
                        type="text"
                        placeholder="Altura"
                        value={(config.layout_config as any).details_modal_heights?.[model.id] || ''}
                        onChange={(e) => {
                          const currentHeights = (config.layout_config as any).details_modal_heights || {}
                          setConfig({
                            ...config,
                            layout_config: {
                              ...config.layout_config,
                              details_modal_heights: {
                                ...currentHeights,
                                [model.id]: e.target.value
                              }
                            }
                          })
                        }}
                        className="w-14 bg-transparent border-none outline-none text-[8px] font-bold text-neutral-600 dark:text-neutral-400 placeholder-neutral-400 dark:placeholder-neutral-600"
                        title="Ex: 600px, auto"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-950 p-0.5 rounded-lg border border-neutral-200 dark:border-neutral-800 ml-2">
                <button
                  title="Lista os registros deste detalhe de forma expandida diretamente na mesma pÃƒÂ¡gina"
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

              {((config.layout_config as any).details_inline_types?.[model.id] !== false) && (
                <div className="flex items-center ml-2 border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden h-6 bg-white dark:bg-neutral-900">
                  <select
                    value={(config.layout_config as any).details_item_titles?.[model.id] || ''}
                    onChange={(e) => {
                      const currentItemTitles = (config.layout_config as any).details_item_titles || {}
                      setConfig({
                        ...config,
                        layout_config: {
                          ...config.layout_config,
                          details_item_titles: {
                            ...currentItemTitles,
                            [model.id]: e.target.value
                          }
                        }
                      })
                    }}
                    className="bg-transparent border-none outline-none text-[8px] font-black uppercase tracking-wider text-neutral-600 dark:text-neutral-400 px-2 h-full cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800"
                    title="Campo usado como tÃƒÂ­tulo do item recolhido"
                  >
                    <option value="">TÃƒÂ­tulo AutomÃƒÂ¡tico</option>
                    {getModelsWithRelations([model], relations, models, config.layout_config?.max_relation_depth || 2).map((g: any, i: number) => (
                      <optgroup key={i} label={g.label} className="text-[10px] font-bold text-blue-600 dark:text-blue-400 normal-case">
                        {g.model.fields?.map((f: any) => {
                          const val = g.prefix ? `${g.prefix}${f.db_column_name}` : f.db_column_name;
                          return (
                            <option key={f.id} value={val} className="text-neutral-800 dark:text-neutral-200 normal-case">
                              {String(f.db_column_name).toLowerCase()}
                            </option>
                          )
                        })}
                      </optgroup>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {!hiddenDetails.has(model.id) && !retractedModels.has(model.id) && (
          <DroppableZone
            id={`droppable-form-${model.id}`}
            className="grid grid-cols-7 gap-3 min-h-[100px] p-6 bg-neutral-50 dark:bg-neutral-950/30 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] items-start transition-all hover:bg-neutral-100/50 dark:hover:bg-neutral-900/40"
          >
            {fieldsOfThisModel.length === 0 ? (
              <div className="col-span-7 flex flex-col items-center justify-center py-4 space-y-2 opacity-50">
                <Plus className="w-4 h-4 text-neutral-400" />
                <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Arraste campos de "{model.display_name || model.db_table_name}" para cÃƒÂ¡</p>
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
        )}
        {(!hiddenDetails.has(model.id)) && !retractedModels.has(model.id) && model.children && model.children.length > 0 && (
          <div className="pt-2">
            {model.children.map((child: any, cIdx: number) => renderModelZone(child, depth + 1, cIdx))}
          </div>
        )}
      </div>
    )
  }

  const toggleField = (fieldId: string, zone: string) => {
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

    // O usuÃƒÂ¡rio solicitou que todas as instÃƒÂ¢ncias do mesmo campo compartilhem as configuraÃƒÂ§ÃƒÂµes.
    // EntÃƒÂ£o, ao atualizar uma propriedade, atualizamos todas as chaves deste field.

    const baseMeta = getFieldMeta(editingFieldId, null) // get current base meta or default
    const newMeta = { ...currentFieldMeta } // current meta being edited
    newMeta[section] = { ...newMeta[section], [key]: value }

    const newFieldsMetadata = { ...config.layout_config.fields_metadata }

    // 1. Atualizar a chave base (para servir de heranÃƒÂ§a quando arrastar para uma nova zona)
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
    delete stylesToCopyLabel.text // NÃƒÂ£o sobrescrever o texto de exibiÃƒÂ§ÃƒÂ£o

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
          <FieldSourcePanel
            dragControls={dragControls}
            t={t}
            fieldSearchTerm={fieldSearchTerm}
            setFieldSearchTerm={setFieldSearchTerm}
            formTree={formTree}
            orderedModels={orderedModels}
            collapsedTables={collapsedTables}
            setCollapsedTables={setCollapsedTables}
          />
          <div className="flex-1 space-y-10 min-w-0">
            <SpecialLayouts
              config={config}
              setConfig={setConfig}
              models={models}
              renderFieldOptions={renderFieldOptions}
              orderedModels={orderedModels}
              t={t}
            />

            {/* ZONA: ANALYTICS (BI) CONFIG */}
            <AnalyticsSection
              config={config}
              setConfig={setConfig}
              models={models}
              relations={relations}
              setEditingWidget={setEditingWidget}
              setIsWidgetModalOpen={setIsWidgetModalOpen}
              getFieldName={getFieldName}
              t={t}
              orderedModels={orderedModels}
            />
            {(config.logic_type.includes('pesquisa') ||
              config.logic_type === 'kanban' ||
              config.logic_type === 'mapa_mental' ||
              config.logic_type === 'master_detail' ||
              config.logic_type === 'scheduler' ||
              config.logic_type === 'galeria' ||
              config.logic_type === 'timeline' ||
              config.logic_type === 'gantt' ||
              config.logic_type === 'blueprint' ||
              config.logic_type === 'map' ||
              config.logic_type === 'personalizado' ||
              config.logic_type === 'analytics') && (
                <div className="p-4 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-[1.5rem] space-y-3 shadow-sm overflow-hidden transition-all duration-300">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => toggleZone('zone01')}
                  >
                    <div className="flex items-center gap-3">
                      <h4 className={cn("text-[9px] font-black uppercase tracking-[0.3em] transition-all", hiddenZones.has('zone01') ? "text-neutral-400" : "text-indigo-600")}>{t('wizard.layout.zones.zone_01')}: {t('wizard.layout.zones.filter')}</h4>
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
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!hiddenZones.has('zone01')) {
                            setConfig({ ...config, layout_config: { ...config.layout_config, filter_fields: [] } })
                          }
                          setHiddenZones(prev => { const n = new Set(prev); n.has('zone01') ? n.delete('zone01') : n.add('zone01'); return n; })
                        }}
                        className="p-1.5 text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-500 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-sm transition-all"
                        title={hiddenZones.has('zone01') ? "Exibir Zona" : "Ocultar Zona"}
                      >
                        {hiddenZones.has('zone01') ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <div className="p-1 text-indigo-600">
                        {expandedZones.zone01 ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {expandedZones.zone01 && !hiddenZones.has('zone01') && (
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
                <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleZone('zone02')}>
                  <div className="space-y-1">
                    <h4 className={cn("text-[9px] font-black uppercase tracking-[0.3em] transition-all", hiddenZones.has('zone02') ? "text-neutral-400" : "text-emerald-600")}>
                      {config.logic_type === 'kanban' ? t('wizard.layout.zones.kanban_card', 'Campos do Card') : config.logic_type === 'mapa_mental' ? t('wizard.layout.zones.mindmap_nodes', 'Campos do Mapa (NÃƒÂ­veis)') : `${t('wizard.layout.zones.zone_02')}: ${t('wizard.layout.zones.grid')}`}
                    </h4>
                    {config.logic_type !== 'kanban' && config.logic_type !== 'mapa_mental' && config.logic_type !== 'galeria' && (
                      <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-950 p-0.5 rounded-lg w-fit" onClick={e => e.stopPropagation()}>
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
                        onClick={(e) => { e.stopPropagation(); setConfig({ ...config, layout_config: { ...config.layout_config, grid_fields: [] } }) }}
                        className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                        title={t('common.clear_all', 'Limpar Tudo')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!hiddenZones.has('zone02')) {
                          setConfig({ ...config, layout_config: { ...config.layout_config, grid_fields: [] } })
                        }
                        setHiddenZones(prev => { const n = new Set(prev); n.has('zone02') ? n.delete('zone02') : n.add('zone02'); return n; })
                      }}
                      className="p-1.5 text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-500 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-sm transition-all"
                      title={hiddenZones.has('zone02') ? "Exibir Zona" : "Ocultar Zona"}
                    >
                      {hiddenZones.has('zone02') ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <div className="p-1 text-emerald-600">
                      {expandedZones.zone02 ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {expandedZones.zone02 && !hiddenZones.has('zone02') && (
                  <div className="pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
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
              </div>
            )}

            {/* ZONA: FORMULÃƒÂRIO (RECURSIVO) */}
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
                      <h4 className={cn("text-[9px] font-black uppercase tracking-[0.3em] transition-all", hiddenZones.has('zone03') ? "text-neutral-400" : "text-amber-600")}>{config.logic_type === 'cadastro' ? t('wizard.layout.zones.zone_01') : t('wizard.layout.zones.zone_03')}: {t('wizard.layout.zones.form')}</h4>
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
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!hiddenZones.has('zone03')) {
                            setConfig({ ...config, layout_config: { ...config.layout_config, form_fields: [] } })
                          }
                          setHiddenZones(prev => { const n = new Set(prev); n.has('zone03') ? n.delete('zone03') : n.add('zone03'); return n; })
                        }}
                        className="p-1.5 text-neutral-400 hover:text-amber-600 dark:hover:text-amber-500 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-sm transition-all"
                        title={hiddenZones.has('zone03') ? "Exibir Zona" : "Ocultar Zona"}
                      >
                        {hiddenZones.has('zone03') ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <div className="p-1 text-amber-600">
                        {expandedZones.zone03 ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {expandedZones.zone03 && !hiddenZones.has('zone03') && (
                    <div className="space-y-6 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                      {formTree.map((node: any, nIdx: number) => renderModelZone(node, 0, nIdx))}
                    </div>
                  )}
                </div>
              )}

            <div className="space-y-6 mt-8">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">ConfiguraÃƒÂ§ÃƒÂµes do FormulÃƒÂ¡rio</label>
              <div className="p-6 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] space-y-4 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">TÃƒÂ­tulo do FormulÃƒÂ¡rio (Opcional)</label>
                    <input
                      type="text"
                      placeholder="Ex: Editar Registro"
                      value={(config.layout_config as any).form_header_title || ''}
                      onChange={e => setConfig({
                        ...config,
                        layout_config: { ...config.layout_config, form_header_title: e.target.value }
                      })}
                      className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-[10px] font-bold outline-none focus:border-indigo-500 transition-all"
                    />
                    <p className="text-[9px] text-neutral-400 mt-1 italic">Sobrescreve o tÃƒÂ­tulo padrÃƒÂ£o do formulÃƒÂ¡rio (ex: "Editar", "Novo"). Suporta traduÃƒÂ§ÃƒÂ£o se usar chaves de dicionÃƒÂ¡rio.</p>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Campo de SubtÃƒÂ­tulo (Opcional)</label>
                    <select
                      value={(config.layout_config as any).form_header_subtitle_field || ''}
                      onChange={e => setConfig({
                        ...config,
                        layout_config: { ...config.layout_config, form_header_subtitle_field: e.target.value }
                      })}
                      className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-[10px] font-bold outline-none focus:border-indigo-500 transition-all"
                    >
                      <option value="">PadrÃƒÂ£o (Exibe o ID do registro)</option>
                      {models.filter((m: any) => config.selected_models.includes(m.id)).flatMap((m: any) => m.fields).map((f: any) => (
                        <option key={`opt-sub-${f.id}`} value={f.db_column_name}>
                          {getFieldName(f.id)} ({f.data_type})
                        </option>
                      ))}
                    </select>
                    <p className="text-[9px] text-neutral-400 mt-1 italic">Substitui a exibiÃƒÂ§ÃƒÂ£o do ID do registro pelo valor deste campo no formulÃƒÂ¡rio.</p>
                  </div>
                </div>
              </div>
            </div>
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

      <FieldDrawer
        isDrawerOpen={isDrawerOpen}
        setIsDrawerOpen={setIsDrawerOpen}
        editingFieldId={editingFieldId}
        getFieldName={getFieldName}
        currentFieldMeta={currentFieldMeta}
        drawerActiveTab={drawerActiveTab}
        setDrawerActiveTab={setDrawerActiveTab}
        updateMeta={updateMeta}
        config={config}
        setConfig={setConfig}
        models={models}
        relations={relations}
        enumerations={enumerations}
        editingTabId={editingTabId}
        editingFieldZone={editingFieldZone}
        handleApplyStylesToZone={handleApplyStylesToZone}
        t={t}
      />

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

      {/* Slot Widget Editor Modal */}
      <Modal
        isOpen={isSlotWidgetModalOpen}
        onClose={() => setIsSlotWidgetModalOpen(false)}
        title="Configurar Indicador"
      >
        <div className="space-y-6">
          <BIWidgetConfigEditor
            editingWidget={editingSlotBIWidget?.widget}
            setEditingWidget={(widget) => setEditingSlotBIWidget(prev => prev ? { ...prev, widget } : null)}
            models={models}
            joins={editingSlotBIWidget?.slotIdx !== undefined ? config.layout_config.custom_slots?.[editingSlotBIWidget.slotIdx]?.joins || [] : []}
            t={t}
          />
          <div className="flex gap-3 pt-6 border-t border-neutral-100 dark:border-neutral-800">
            <button onClick={() => setIsSlotWidgetModalOpen(false)} className="flex-1 px-4 py-3.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">Cancelar</button>
            <button
              onClick={() => {
                if (editingSlotBIWidget) {
                  const newSlots = [...(config.layout_config.custom_slots || [])];
                  const slotIdx = editingSlotBIWidget.slotIdx;
                  const currentWidgets = newSlots[slotIdx].analytics_config?.widgets || [];
                  const exists = currentWidgets.find((w: any) => w.id === editingSlotBIWidget.widget.id);
                  const newWidgets = exists
                    ? currentWidgets.map((w: any) => w.id === editingSlotBIWidget.widget.id ? editingSlotBIWidget.widget : w)
                    : [...currentWidgets, editingSlotBIWidget.widget];

                  newSlots[slotIdx].analytics_config = {
                    ...newSlots[slotIdx].analytics_config,
                    widgets: newWidgets
                  };
                  setConfig({ ...config, layout_config: { ...config.layout_config, custom_slots: newSlots } });
                  setIsSlotWidgetModalOpen(false);
                  setEditingSlotBIWidget(null);
                }
              }}
              className="flex-1 px-4 py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-500 shadow-xl shadow-indigo-500/20 transition-all active:scale-95"
            >
              Salvar Indicador
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}







