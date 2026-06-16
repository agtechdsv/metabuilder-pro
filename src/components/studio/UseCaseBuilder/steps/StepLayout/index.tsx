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
                  {[1, 2, 3].map(i => <div key={i} className="w-1 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700 group-hover:bg-indigo-400"></div>)}
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
                {/* Ferramentas Virtuais */}
                <div className="border-b border-neutral-100 dark:border-neutral-800">
                  <div className="flex items-center gap-2 px-4 py-3 bg-neutral-50/50 dark:bg-neutral-900/20">
                    <div className="w-1.5 h-3.5 bg-indigo-500 rounded-full"></div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-800 dark:text-neutral-200">
                      Ferramentas Virtuais
                    </h4>
                  </div>
                  <div className="p-4 pt-2">
                    <DraggableItem id="source-virtual_calc_tool" className="bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/50 p-3 rounded-xl flex items-center justify-between group cursor-grab active:cursor-grabbing hover:border-indigo-400 dark:hover:border-indigo-500 transition-all shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                          <span className="text-indigo-600 dark:text-indigo-400 font-black text-[10px]">fx</span>
                        </div>
                        <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                          Campo Calculado
                        </span>
                      </div>
                      <Plus className="w-3.5 h-3.5 text-indigo-300 group-hover:text-indigo-500 transition-all" />
                    </DraggableItem>
                  </div>
                </div>

                {(() => {
                  const formTreeIds = new Set<string>()
                  const traverse = (nodes: any[]) => {
                    nodes.forEach(n => {
                      formTreeIds.add(n.id)
                      if (n.children) traverse(n.children)
                    })
                  }
                  traverse(formTree)

                  const inTree = orderedModels.filter((m: any) => formTreeIds.has(m.id))
                  const outTree = orderedModels.filter((m: any) => !formTreeIds.has(m.id))
                  const sidebarModels = [...inTree, ...outTree]

                  return sidebarModels
                    .filter((m: any) => {
                      if (!fieldSearchTerm) return true
                      const term = fieldSearchTerm.toLowerCase()
                      const tableMatch = (m.display_name || m.db_table_name || '').toLowerCase().includes(term)
                      const fieldMatch = m.fields.some((f: any) => (f.display_name || f.db_column_name || '').toLowerCase().includes(term))
                      return tableMatch || fieldMatch
                    })
                    .map((m: any) => {
                      const isCollapsed = collapsedTables[m.id] ?? !formTreeIds.has(m.id)
                      // Se houver busca e a tabela der match via campo, forÃƒÂ§amos a expansÃƒÂ£o para mostrar os campos
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
                              <DraggableItem id={`table-source-${m.id}`} className="bg-indigo-50/30 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 p-2.5 rounded-xl flex items-center justify-center gap-2 group cursor-grab active:cursor-grabbing hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-all mb-2">
                                <Table className="w-3.5 h-3.5 text-indigo-500" />
                                <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">{t('wizard.layout.drag_to_add_all', 'Arrastar Todos')}</span>
                              </DraggableItem>

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
                    })
                })()}
              </div>
            </motion.div>
          </div>

          <div className="flex-1 space-y-10 min-w-0">
            {/* ZONA: CONFIGURAÃƒâ€¡Ãƒâ€¢ES GERAIS */}
            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-[1.5rem] space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/20">
                    <Database className="w-4 h-4" />
                  </div>
                  <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em]">ConfiguraÃƒÂ§ÃƒÂ£o de PadrÃƒÂµes</h4>
                </div>
              </div>

              <div className={cn("grid grid-cols-1 gap-4", config.logic_type === 'timeline' ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Registros por PÃƒÂ¡gina (LIMIT)</label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    placeholder="Ex: 50"
                    value={config.layout_config.items_per_page || ''}
                    onChange={e => setConfig({
                      ...config,
                      layout_config: { ...config.layout_config, items_per_page: e.target.value ? parseInt(e.target.value, 10) : undefined }
                    })}
                    className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
                  />
                  <p className="text-[10px] text-neutral-400 font-medium italic ml-1">Deixe em branco para usar o padrÃƒÂ£o do sistema.</p>
                </div>

                {config.logic_type === 'timeline' && (
                  <>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Ordem (Horizontal)</label>
                      <select
                        value={(config.layout_config as any).timeline_config?.timeline_order_horizontal || 'asc'}
                        onChange={e => setConfig({
                          ...config,
                          layout_config: {
                            ...config.layout_config,
                            timeline_config: { ...(config.layout_config as any).timeline_config, timeline_order_horizontal: e.target.value }
                          }
                        })}
                        className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
                      >
                        <option value="asc">Mais Antigo Primeiro (ASC)</option>
                        <option value="desc">Mais Recente Primeiro (DESC)</option>
                      </select>
                      <p className="text-[10px] text-neutral-400 font-medium italic ml-1">Ordem ao exibir em tela horizontal.</p>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Ordem (Vertical)</label>
                      <select
                        value={(config.layout_config as any).timeline_config?.timeline_order_vertical || 'asc'}
                        onChange={e => setConfig({
                          ...config,
                          layout_config: {
                            ...config.layout_config,
                            timeline_config: { ...(config.layout_config as any).timeline_config, timeline_order_vertical: e.target.value }
                          }
                        })}
                        className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
                      >
                        <option value="asc">Mais Antigo Primeiro (ASC)</option>
                        <option value="desc">Mais Recente Primeiro (DESC)</option>
                      </select>
                      <p className="text-[10px] text-neutral-400 font-medium italic ml-1">Ordem ao exibir em tela vertical.</p>
                    </div>
                  </>
                )}
              </div>
            </div>

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
                    {renderFieldOptions(orderedModels)}
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
                    <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em]">ConfiguraÃƒÂ§ÃƒÂ£o do CalendÃƒÂ¡rio</h4>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Campo do TÃƒÂ­tulo</label>
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
                      <option value="">Selecione o campo de tÃƒÂ­tulo...</option>
                      {renderFieldOptions(orderedModels)}
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Campo de Data de InÃƒÂ­cio</label>
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
                      <option value="">Selecione o campo de data de inÃƒÂ­cio...</option>
                      {renderFieldOptions(orderedModels, (f: any) => f.data_type.includes('date') || f.data_type.includes('timestamp'))}
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
                      <option value="">Nenhum (Evento de data ÃƒÂºnica)</option>
                      {renderFieldOptions(orderedModels, (f: any) => f.data_type.includes('date') || f.data_type.includes('timestamp'))}
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
                      <option value="">Nenhum (Cor padrÃƒÂ£o indigo)</option>
                      {renderFieldOptions(orderedModels)}
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
                    <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em]">{t('wizard.layout.timeline.title', 'ConfiguraÃƒÂ§ÃƒÂ£o da Linha do Tempo')}</h4>
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
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.timeline.title_field', 'Campo de TÃƒÂ­tulo')}</label>
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
                        <option value="">Selecione o campo de tÃƒÂ­tulo...</option>
                        {renderFieldOptions(orderedModels)}
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
                        {renderFieldOptions(orderedModels, (f: any) => f.data_type.includes('date') || f.data_type.includes('timestamp'))}
                      </select>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.timeline.desc_field', 'Campo de DescriÃƒÂ§ÃƒÂ£o (Opcional)')}</label>
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
                        {renderFieldOptions(orderedModels)}
                      </select>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.timeline.icon_field', 'Campo de ÃƒÂcone/Status (Opcional)')}</label>
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
                        {renderFieldOptions(orderedModels)}
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
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.timeline.direction', 'DireÃƒÂ§ÃƒÂ£o da Linha')}</label>
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
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.timeline.mode', 'Modo de ExibiÃƒÂ§ÃƒÂ£o')}</label>
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
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.timeline.animated', 'AnimaÃƒÂ§ÃƒÂ£o de Desenho')}</label>
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
                        <option value="false">Sem AnimaÃƒÂ§ÃƒÂ£o (EstÃƒÂ¡tico)</option>
                        <option value="true">Com AnimaÃƒÂ§ÃƒÂ£o (Desenho DinÃƒÂ¢mico)</option>
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
                        <option value="cards">Cards (PadrÃƒÂ£o)</option>
                        <option value="infographic">InfogrÃƒÂ¡fico (Minimalista)</option>
                      </select>
                    </div>

                    <div className="space-y-3 col-span-1 sm:col-span-2 border-t border-neutral-100 dark:border-neutral-800/50 pt-4">
                      <div className="flex justify-between items-center ml-1">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">Escala de ExibiÃƒÂ§ÃƒÂ£o (Cards e Textos)</label>
                        <span className="text-[10px] font-extrabold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-md">
                          {((config.layout_config as any).timeline_config?.card_scale ?? 1.0).toFixed(1)}x
                          {((config.layout_config as any).timeline_config?.card_scale ?? 1.0) === 1.0 ? ' (PadrÃƒÂ£o)' : ''}
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
                      <p className="text-[9px] text-neutral-400 italic ml-1">Arraste para ajustar proporcionalmente o tamanho dos cards, fontes e espaÃƒÂ§amentos da linha do tempo.</p>
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
                  <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em]">{t('wizard.layout.gantt.title', 'ConfiguraÃƒÂ§ÃƒÂ£o do GrÃƒÂ¡fico de Gantt')}</h4>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.gantt.title_field', 'Campo de TÃƒÂ­tulo (ObrigatÃƒÂ³rio)')}</label>
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
                      <option value="">Selecione o campo de tÃƒÂ­tulo...</option>
                      {renderFieldOptions(orderedModels)}
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.gantt.start_date_field', 'Data Inicial (ObrigatÃƒÂ³rio)')}</label>
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
                      {renderFieldOptions(orderedModels, (f: any) => f.data_type.includes('date') || f.data_type.includes('timestamp'))}
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.gantt.end_date_field', 'Data Final (ObrigatÃƒÂ³rio)')}</label>
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
                      {renderFieldOptions(orderedModels, (f: any) => f.data_type.includes('date') || f.data_type.includes('timestamp'))}
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
                      <option value="">Nenhum (Progresso nÃƒÂ£o exibido)</option>
                      {renderFieldOptions(orderedModels, (f: any) => f.data_type.includes('int') || f.data_type.includes('float') || f.data_type.includes('numeric'))}
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
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Campo de TÃƒÂ­tulo do NÃƒÂ³ (ObrigatÃƒÂ³rio)</label>
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
                        <option value="">Selecione o tÃƒÂ­tulo...</option>
                        {renderFieldOptions(orderedModels)}
                      </select>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Campo NÃƒÂ³ Anterior / Predecessora (ObrigatÃƒÂ³rio)</label>
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
                        <option value="">Selecione o campo de relaÃƒÂ§ÃƒÂ£o...</option>
                        {renderFieldOptions(orderedModels)}
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
                        {renderFieldOptions(orderedModels)}
                      </select>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Campo de DescriÃƒÂ§ÃƒÂ£o (Opcional)</label>
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
                        <option value="">Selecione a descriÃƒÂ§ÃƒÂ£o...</option>
                        {renderFieldOptions(orderedModels)}
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
                    {/* DireÃƒÂ§ÃƒÂ£o da Linha */}
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">DireÃƒÂ§ÃƒÂ£o da Linha</label>
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

                    {/* AnimaÃƒÂ§ÃƒÂ£o */}
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">AnimaÃƒÂ§ÃƒÂ£o de Desenho</label>
                      <select
                        value={(config.layout_config as any).blueprint_config?.animated_edges !== false ? 'true' : 'false'}
                        onChange={e => setConfig({
                          ...config,
                          layout_config: { ...config.layout_config, blueprint_config: { ...(config.layout_config as any).blueprint_config, animated_edges: e.target.value === 'true' } }
                        })}
                        className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
                      >
                        <option value="true">Com AnimaÃƒÂ§ÃƒÂ£o (Desenho DinÃƒÂ¢mico)</option>
                        <option value="false">Sem AnimaÃƒÂ§ÃƒÂ£o (EstÃƒÂ¡tico)</option>
                      </select>
                    </div>
                  </div>

                  {/* Slider de Escala */}
                  <div className="space-y-3 pt-4 border-t border-neutral-100 dark:border-neutral-800/50">
                    <div className="flex justify-between items-center text-xs font-bold text-neutral-500 mb-2 uppercase tracking-wider">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Escala de exibiÃƒÂ§ÃƒÂ£o (Cards e textos)</label>
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
                    <p className="text-[10px] text-neutral-400 mt-2 italic px-2">Arraste para ajustar proporcionalmente o tamanho dos cards, fontes e espaÃƒÂ§amentos do fluxograma.</p>
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
                  <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em]">{t('wizard.layout.map.title', 'ConfiguraÃƒÂ§ÃƒÂ£o do Mapa (Leaflet)')}</h4>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.map.title_field', 'Campo de TÃƒÂ­tulo (ObrigatÃƒÂ³rio)')}</label>
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
                      <option value="">Selecione o tÃƒÂ­tulo...</option>
                      {renderFieldOptions(orderedModels)}
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.map.desc_field', 'Campo de DescriÃƒÂ§ÃƒÂ£o (Opcional)')}</label>
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
                      <option value="">Selecione a descriÃƒÂ§ÃƒÂ£o...</option>
                      {renderFieldOptions(orderedModels)}
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.map.lat_field', 'Latitude (Y) - ObrigatÃƒÂ³rio')}</label>
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
                      {renderFieldOptions(orderedModels)}
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.map.lng_field', 'Longitude (X) - ObrigatÃƒÂ³rio')}</label>
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
                      {renderFieldOptions(orderedModels)}
                    </select>
                  </div>
                </div>
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
                      <p className="text-[10px] text-neutral-400 font-medium mt-1">Configure os widgets e grÃƒÂ¡ficos do seu dashboard.</p>
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
                      EdiÃƒÂ§ÃƒÂ£o no Runtime: {config.layout_config.analytics_config.allow_runtime_edit ? 'ON' : 'OFF'}
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
                    <h4 className="text-[10px] font-black uppercase text-purple-600 tracking-[0.3em]">Hierarquia Relacional do Mapa</h4>
                  </div>
                </div>

                <div className="space-y-4">
                  {(config.layout_config.mindmap_levels || []).map((level: any, lIdx: number) => {
                    const levelModel = models.find((m: any) => m.id === level.model_id);
                    const isRoot = lIdx === 0;
                    return (
                      <div key={level.id || lIdx} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 space-y-3 relative">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-black uppercase text-neutral-400">NÃƒÂ­vel {lIdx + 1} {isRoot && '(Raiz)'}</span>
                          {!isRoot && (
                            <button onClick={() => {
                              setConfig((prev: any) => {
                                const newLevels = prev.layout_config.mindmap_levels.filter((_: any, i: number) => i !== lIdx);
                                return { ...prev, layout_config: { ...prev.layout_config, mindmap_levels: newLevels } };
                              });
                            }} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded-lg transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[9px] font-black uppercase text-neutral-400">Tabela (Model)</label>
                            <select
                              value={level.model_id || ''}
                              onChange={e => {
                                setConfig((prev: any) => {
                                  const newLevels = [...(prev.layout_config.mindmap_levels || [])];
                                  newLevels[lIdx].model_id = e.target.value;
                                  newLevels[lIdx].title_field = '';
                                  newLevels[lIdx].desc_field = '';
                                  newLevels[lIdx].foreign_key = '';
                                  return { ...prev, layout_config: { ...prev.layout_config, mindmap_levels: newLevels } };
                                });
                              }}
                              disabled={isRoot}
                              className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-200 outline-none disabled:opacity-50"
                            >
                              <option value="">Selecione...</option>
                              {orderedModels.map((m: any) => <option key={m.id} value={m.id}>{m.display_name || m.db_table_name}</option>)}
                            </select>
                            {isRoot && <p className="text-[9px] text-neutral-400 mt-1 italic">Tabela base do Use Case.</p>}
                          </div>

                          {!isRoot && (
                            <div className="space-y-3 col-span-full bg-neutral-50 dark:bg-neutral-800/30 p-3 rounded-lg border border-neutral-100 dark:border-neutral-800">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <label className="text-[9px] font-black uppercase text-neutral-400">Tipo de RelaÃƒÂ§ÃƒÂ£o com o NÃƒÂ­vel Anterior</label>
                                  <select
                                    value={level.relation_type || 'direct'}
                                    onChange={e => {
                                      setConfig((prev: any) => {
                                        const newLevels = [...(prev.layout_config.mindmap_levels || [])];
                                        newLevels[lIdx].relation_type = e.target.value;
                                        // Reset fields
                                        newLevels[lIdx].foreign_key = '';
                                        newLevels[lIdx].through_table = '';
                                        newLevels[lIdx].through_local_fk = '';
                                        newLevels[lIdx].through_target_fk = '';
                                        return { ...prev, layout_config: { ...prev.layout_config, mindmap_levels: newLevels } };
                                      });
                                    }}
                                    className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-200 outline-none mt-1"
                                  >
                                    <option value="direct">Direta (1:N)</option>
                                    <option value="indirect">Indireta (N:M - Via Tabela IntermediÃƒÂ¡ria)</option>
                                    <option value="multilevel">AvanÃƒÂ§ada (Multi-NÃƒÂ­veis - MÃƒÂºltiplos Joins)</option>
                                  </select>
                                </div>

                                {level.relation_type === 'indirect' ? (
                                  <div>
                                    <label className="text-[9px] font-black uppercase text-neutral-400">Tabela IntermediÃƒÂ¡ria (N:M)</label>
                                    <select
                                      value={level.through_table || ''}
                                      onChange={e => {
                                        setConfig((prev: any) => {
                                          const newLevels = [...(prev.layout_config.mindmap_levels || [])];
                                          newLevels[lIdx].through_table = e.target.value;
                                          newLevels[lIdx].through_local_fk = '';
                                          newLevels[lIdx].through_target_fk = '';
                                          return { ...prev, layout_config: { ...prev.layout_config, mindmap_levels: newLevels } };
                                        });
                                      }}
                                      className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-200 outline-none mt-1"
                                    >
                                      <option value="">Selecione a Tabela...</option>
                                      {orderedModels.map((m: any) => <option key={`through-${m.id}`} value={m.db_table_name}>{m.display_name || m.db_table_name}</option>)}
                                    </select>
                                  </div>
                                ) : level.relation_type === 'direct' ? (
                                  <div>
                                    <label className="text-[9px] font-black uppercase text-neutral-400">Chave Estrangeira (Aponta pro Pai)</label>
                                    <select
                                      value={level.foreign_key || ''}
                                      onChange={e => {
                                        setConfig((prev: any) => {
                                          const newLevels = [...(prev.layout_config.mindmap_levels || [])];
                                          newLevels[lIdx].foreign_key = e.target.value;
                                          return { ...prev, layout_config: { ...prev.layout_config, mindmap_levels: newLevels } };
                                        });
                                      }}
                                      className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-200 outline-none mt-1"
                                    >
                                      <option value="">Selecione o Campo...</option>
                                      {levelModel?.fields?.map((f: any) => <option key={f.id} value={f.db_column_name}>{f.display_name || f.db_column_name}</option>)}
                                    </select>
                                  </div>
                                ) : null}

                                {level.relation_type === 'indirect' && level.through_table && (() => {
                                  const throughModel = models.find((m: any) => m.db_table_name === level.through_table);
                                  return (
                                    <>
                                      <div>
                                        <label className="text-[9px] font-black uppercase text-neutral-400">FK para o Pai (Na Tabela IntermediÃƒÂ¡ria)</label>
                                        <select
                                          value={level.through_local_fk || ''}
                                          onChange={e => {
                                            setConfig((prev: any) => {
                                              const newLevels = [...(prev.layout_config.mindmap_levels || [])];
                                              newLevels[lIdx].through_local_fk = e.target.value;
                                              return { ...prev, layout_config: { ...prev.layout_config, mindmap_levels: newLevels } };
                                            });
                                          }}
                                          className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-200 outline-none mt-1"
                                        >
                                          <option value="">Selecione o Campo...</option>
                                          {throughModel?.fields?.map((f: any) => <option key={f.id} value={f.db_column_name}>{f.display_name || f.db_column_name}</option>)}
                                        </select>
                                      </div>
                                      <div>
                                        <label className="text-[9px] font-black uppercase text-neutral-400">FK para o Filho (Na Tabela IntermediÃƒÂ¡ria)</label>
                                        <select
                                          value={level.through_target_fk || ''}
                                          onChange={e => {
                                            setConfig((prev: any) => {
                                              const newLevels = [...(prev.layout_config.mindmap_levels || [])];
                                              newLevels[lIdx].through_target_fk = e.target.value;
                                              return { ...prev, layout_config: { ...prev.layout_config, mindmap_levels: newLevels } };
                                            });
                                          }}
                                          className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-200 outline-none mt-1"
                                        >
                                          <option value="">Selecione o Campo...</option>
                                          {throughModel?.fields?.map((f: any) => <option key={f.id} value={f.db_column_name}>{f.display_name || f.db_column_name}</option>)}
                                        </select>
                                      </div>
                                    </>
                                  );
                                })()}

                                {level.relation_type === 'multilevel' && (
                                  <div className="col-span-full">
                                    <MultiLevelPathBuilder
                                      level={level}
                                      models={models}
                                      parentModelId={lIdx === 0 ? config.selected_models?.[0] : config.layout_config.mindmap_levels[lIdx - 1]?.model_id}
                                      onChange={(newPath: any) => {
                                        setConfig((prev: any) => {
                                          const newLevels = [...(prev.layout_config.mindmap_levels || [])];
                                          newLevels[lIdx].relation_path = newPath;
                                          return { ...prev, layout_config: { ...prev.layout_config, mindmap_levels: newLevels } };
                                        });
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          <div>
                            <label className="text-[9px] font-black uppercase text-neutral-400">Campo de TÃƒÂ­tulo do Card</label>
                            <select
                              value={level.title_field || ''}
                              onChange={e => {
                                setConfig((prev: any) => {
                                  const newLevels = [...(prev.layout_config.mindmap_levels || [])];
                                  newLevels[lIdx].title_field = e.target.value;
                                  return { ...prev, layout_config: { ...prev.layout_config, mindmap_levels: newLevels } };
                                });
                              }}
                              className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-200 outline-none"
                            >
                              <option value="">AutomÃƒÂ¡tico</option>
                              {levelModel?.fields?.map((f: any) => <option key={f.id} value={f.db_column_name}>{f.display_name || f.db_column_name}</option>)}
                            </select>
                          </div>

                          <div>
                            <label className="text-[9px] font-black uppercase text-neutral-400">Campo de DescriÃƒÂ§ÃƒÂ£o / SubtÃƒÂ­tulo</label>
                            <select
                              value={level.desc_field || ''}
                              onChange={e => {
                                setConfig((prev: any) => {
                                  const newLevels = [...(prev.layout_config.mindmap_levels || [])];
                                  newLevels[lIdx].desc_field = e.target.value;
                                  return { ...prev, layout_config: { ...prev.layout_config, mindmap_levels: newLevels } };
                                });
                              }}
                              className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-200 outline-none"
                            >
                              <option value="">Nenhum</option>
                              {levelModel?.fields?.map((f: any) => <option key={f.id} value={f.db_column_name}>{f.display_name || f.db_column_name}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {(!config.layout_config.mindmap_levels || config.layout_config.mindmap_levels.length === 0) && (
                    <div className="p-4 border-2 border-dashed border-purple-200 dark:border-purple-900/50 rounded-xl text-center bg-white dark:bg-neutral-900">
                      <p className="text-xs text-neutral-500">Nenhuma hierarquia definida. O mapa agruparÃƒÂ¡ os dados base do modelo atual.</p>
                      <button
                        onClick={() => {
                          setConfig((prev: any) => ({
                            ...prev,
                            layout_config: {
                              ...prev.layout_config,
                              mindmap_levels: [{
                                id: Math.random().toString(36).substr(2, 9),
                                model_id: config.selected_models?.[0] || '',
                                foreign_key: '',
                                relation_type: 'direct',
                                through_table: '',
                                through_local_fk: '',
                                through_target_fk: '',
                                title_field: '',
                                desc_field: ''
                              }]
                            }
                          }));
                        }}
                        className="mt-3 px-4 py-2 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-[10px] font-black uppercase rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
                      >
                        ComeÃƒÂ§ar Hierarquia Relacional
                      </button>
                    </div>
                  )}

                  {(config.layout_config.mindmap_levels && config.layout_config.mindmap_levels.length > 0) && (
                    <button
                      onClick={() => {
                        setConfig((prev: any) => {
                          const newLevels = [...(prev.layout_config.mindmap_levels || [])];
                          newLevels.push({
                            id: Math.random().toString(36).substr(2, 9),
                            model_id: '',
                            foreign_key: '',
                            relation_type: 'direct',
                            through_table: '',
                            through_local_fk: '',
                            through_target_fk: '',
                            title_field: '',
                            desc_field: ''
                          });
                          return { ...prev, layout_config: { ...prev.layout_config, mindmap_levels: newLevels } };
                        });
                      }}
                      className="w-full py-3 border-2 border-dashed border-neutral-200 dark:border-neutral-800 hover:border-purple-300 dark:hover:border-purple-700/50 rounded-xl text-neutral-500 hover:text-purple-600 dark:hover:text-purple-400 text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar NÃƒÂ­vel Abaixo
                    </button>
                  )}
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
                    <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em]">ConfiguraÃƒÂ§ÃƒÂ£o da Galeria</h4>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">VisualizaÃƒÂ§ÃƒÂ£o de Imagem</label>
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
                      Ver no prÃƒÂ³prio Thumbnail
                    </button>
                  </div>
                  <p className="text-[10px] text-neutral-400 font-medium italic ml-1">
                    Selecione "Ver no prÃƒÂ³prio Thumbnail" para exibir a imagem inteira (sem cortes) diretamente no card, desabilitando a modal de visualizaÃƒÂ§ÃƒÂ£o ao clicar.
                  </p>
                </div>

                {/* CAMPOS DO CARD DA GALERIA */}
                <div className="space-y-3 border-t border-neutral-100 dark:border-neutral-800 pt-4 mt-6">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Campos do Card da Galeria</label>
                    <p className="text-[10px] text-neutral-500 ml-1 mt-0.5">Selecione quais campos aparecerÃƒÂ£o no corpo do card (opcional). Deixe vazio para usar apenas TÃƒÂ­tulo e Arquivo.</p>
                  </div>
                  <div className="flex gap-2 items-center">
                    <select
                      id="main_gallery_card_fields_select"
                      className="flex-1 px-4 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-[10px] font-bold outline-none focus:border-indigo-500"
                    >
                      <option value="">Adicionar campo...</option>
                      {(() => {
                        const rootId = config.selected_models[0];
                        const rootModel = models.find((m: any) => m.id === rootId);

                        const orderedModels = [
                          rootModel,
                          ...models.filter((m: any) => m.id !== rootId)
                        ].filter(Boolean);

                        return orderedModels.map((m: any) => {
                          const isMain = m.id === rootId;
                          const tName = m.db_table_name;
                          return (
                            <optgroup key={`opt-${m.id}`} label={`Tabela: ${tName}`} className="text-[10px] font-bold text-blue-600 dark:text-blue-400 normal-case">
                              {m.fields
                                .filter((f: any) => !(config.layout_config.gallery_config?.card_fields || []).includes(isMain ? f.db_column_name : `${tName}.${f.db_column_name}`))
                                .map((f: any) => (
                                  <option
                                    key={`${tName}-${f.id}`}
                                    value={isMain ? f.db_column_name : `${tName}.${f.db_column_name}`}
                                    className="text-neutral-800 dark:text-neutral-200 font-normal normal-case"
                                  >
                                    {String(f.db_column_name).toLowerCase()}
                                  </option>
                                ))}
                            </optgroup>
                          );
                        });
                      })()}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const select = document.getElementById('main_gallery_card_fields_select') as HTMLSelectElement;
                        if (select && select.value) {
                          const currentFields = config.layout_config.gallery_config?.card_fields || [];
                          setConfig({
                            ...config,
                            layout_config: {
                              ...config.layout_config,
                              gallery_config: {
                                ...(config.layout_config.gallery_config || {}),
                                card_fields: [...currentFields, select.value]
                              }
                            }
                          });
                          select.value = '';
                        }
                      }}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors"
                    >
                      + Add
                    </button>
                  </div>

                  {((config.layout_config.gallery_config?.card_fields?.length || 0) > 0) && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {config.layout_config.gallery_config?.card_fields.map((fieldCol: string, i: number) => {
                        let defaultLabel = fieldCol;
                        if (fieldCol.includes('.')) {
                          const [tName, cName] = fieldCol.split('.');
                          defaultLabel = `${tName} -> ${cName}`;
                        } else {
                          const fDef = models.find((m: any) => m.id === config.selected_models[0])?.fields.find((f: any) => f.db_column_name === fieldCol);
                          if (fDef) defaultLabel = fDef.display_name || fieldCol;
                        }

                        const currentLabel = config.layout_config.gallery_config?.card_fields_labels?.[fieldCol] || defaultLabel;

                        return (
                          <div key={`gcf-${i}`} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                            <input
                              type="text"
                              value={currentLabel}
                              onChange={(e) => {
                                setConfig({
                                  ...config,
                                  layout_config: {
                                    ...config.layout_config,
                                    gallery_config: {
                                      ...(config.layout_config.gallery_config || {}),
                                      card_fields_labels: {
                                        ...(config.layout_config.gallery_config?.card_fields_labels || {}),
                                        [fieldCol]: e.target.value
                                      }
                                    }
                                  }
                                });
                              }}
                              className="bg-transparent text-[10px] font-bold text-neutral-600 dark:text-neutral-400 focus:outline-none focus:border-indigo-500 border-b border-transparent hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors w-auto min-w-[80px]"
                              title="Clique para editar o label deste campo"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newFields = [...(config.layout_config.gallery_config?.card_fields || [])];
                                newFields.splice(i, 1);

                                const newLabels = { ...(config.layout_config.gallery_config?.card_fields_labels || {}) };
                                delete newLabels[fieldCol];

                                setConfig({
                                  ...config,
                                  layout_config: {
                                    ...config.layout_config,
                                    gallery_config: {
                                      ...(config.layout_config.gallery_config || {}),
                                      card_fields: newFields,
                                      card_fields_labels: newLabels
                                    }
                                  }
                                });
                              }}
                              className="text-neutral-400 hover:text-rose-500 transition-colors p-0.5 rounded-md hover:bg-rose-500/10"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}


            {/* ZONA: FILTROS */}
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




