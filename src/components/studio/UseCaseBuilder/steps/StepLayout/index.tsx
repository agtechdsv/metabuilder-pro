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
import { StepLayoutModelZone } from './StepLayoutModelZone'
import { MultiLevelPathBuilder } from '../StepPersonalizado'
import { FieldDrawer } from './FieldDrawer'
import { AnalyticsSection } from './AnalyticsSection'
import { SpecialLayouts } from './SpecialLayouts'
import { FieldSourcePanel } from './FieldSourcePanel'
import { FieldZones } from './FieldZones'
export function StepLayout({ config, setConfig, models, enumerations = [], relations = [], useCases = [], orderedModels = [], virtualFields = [], byocComponents = [] }: any) {
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
    if (id.startsWith('byoc_')) {
      const parts = id.split('_')
      return `[BYOC] ${parts.slice(2).join('_')}`
    }
    for (const m of models) {
      const f = m.fields?.find((f: any) => f.id === id)
      if (f) {
        return formatLabelText(f.display_name || f.db_column_name)
      }
    }
    return formatLabelText(id)
  }



  // ââ€â‚¬ââ€â‚¬ââ€â‚¬ Santo Graal helpers para Personalizado ââ€â‚¬ââ€â‚¬ââ€â‚¬ââ€â‚¬ââ€â‚¬ââ€â‚¬ââ€â‚¬ââ€â‚¬ââ€â‚¬ââ€â‚¬ââ€â‚¬ââ€â‚¬ââ€â‚¬ââ€â‚¬ââ€â‚¬ââ€â‚¬ââ€â‚¬ââ€â‚¬ââ€â‚¬ââ€â‚¬ââ€â‚¬ââ€â‚¬ââ€â‚¬ââ€â‚¬ââ€â‚¬ââ€â‚¬ââ€â‚¬ââ€â‚¬ââ€â‚¬ââ€â‚¬ââ€â‚¬ââ€â‚¬ââ€â‚¬ââ€â‚¬ââ€â‚¬
  // Retorna todos os models alcançáveis a partir de um model_id via BFS do Santo Graal.
  // Usa max_relation_depth definido na etapa 2 do wizard.
  function getSlotRelatedFieldGroups(slotModelId: string) {
    const slotModel = models.find((m: any) => m.id === slotModelId)
    if (!slotModel) return []
    const maxDepth = config.layout_config?.max_relation_depth ?? 2
    return getModelsWithRelations([slotModel], relations, models, maxDepth)
  }

  // Retorna a lista de modelos alcançáveis a partir da tabela raiz do caso de uso (para o combo TABELA MODEL)
  function getRootRelatedModels() {
    const rootId = config.layout_config?.master_model_id || config.selected_models?.[0]
    const rootModel = models.find((m: any) => m.id === rootId)
    if (!rootModel) return []
    const maxDepth = config.layout_config?.max_relation_depth ?? 2
    return getModelsWithRelations([rootModel], relations, models, maxDepth)
  }

  // Renderiza <optgroup>/<option> agrupados por tabela, compatível com a imagem 3.
  // noneLabel: texto da opção vazia (e.g. "Selecione o campo...")
  // includeNone: se true, adiciona opção vazia no início
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
          const isVirtualTool = id === 'virtual_calc_tool';
          const isSavedVirtualField = id.startsWith('virtdef_');
          const isByoc = id.startsWith('byoc_');
          
          let fieldId = id;
          if (isVirtualTool || isSavedVirtualField) {
            fieldId = `virt_${Math.random().toString(36).substring(2, 10)}`;
          } else if (isByoc) {
            // id is byoc_{db_id}_{ComponentName}
            const byocName = id.split('_').slice(2).join('_');
            fieldId = `byoc_${Math.random().toString(36).substring(2, 10)}_${byocName}`;
          }

          // Achar o campo no modelo para validar
          let fieldObj: any = null
          if (!isVirtualTool && !isSavedVirtualField && !isByoc) {
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
          }

          const currentFields = [...config.layout_config[targetZone]]
          if (!currentFields.includes(fieldId)) {
            if (targetZone === 'filter_fields' && (!config.has_arguments || config.logic_type === 'cadastro')) return
            if (targetZone === 'form_fields' && config.logic_type === 'pesquisa') return

            currentFields.push(fieldId)

            const newMetadata = { ...(config.layout_config.fields_metadata || {}) }
            
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
              if (!assignedModelId && droppedOnFieldId.startsWith('virt_')) {
                assignedModelId = config.layout_config.fields_metadata?.[droppedOnFieldId]?.virtual_model_id || null;
              }
              if (!assignedModelId && droppedOnFieldId.startsWith('byoc_')) {
                assignedModelId = config.layout_config.fields_metadata?.[droppedOnFieldId]?.byoc_model_id || null;
              }
            } else if (targetZone === 'grid_fields' || targetZone === 'filter_fields') {
              assignedModelId = config.model_id || (models[0]?.id ?? null);
            }

            if (isVirtualTool || isSavedVirtualField) {
              let labelText = 'Campo Calculado';
              let formulaTokens: any[] = [];

              if (isSavedVirtualField) {
                const defId = id.replace('virtdef_', '');
                const savedDef = virtualFields.find((v: any) => v.id === defId);
                if (savedDef) {
                  labelText = savedDef.display_name || savedDef.name;
                  formulaTokens = [...(savedDef.formula_tokens || [])];

                  // SMART RESOLUTION
                  if (assignedModelId) {
                    const targetModel = models.find((m: any) => m.id === assignedModelId);
                    if (targetModel) {
                      formulaTokens = formulaTokens.map(token => {
                        if (token.type === 'field' && !token.value.startsWith('virt:')) {
                          const originalColName = token.value; 
                          if (originalColName) {
                            const targetField = targetModel.fields?.find((f: any) => f.db_column_name === originalColName);
                            if (targetField) {
                              return {
                                ...token,
                                value: targetField.db_column_name,
                                label: `[${targetModel.display_name || targetModel.db_table_name}] ${targetField.display_name || targetField.db_column_name}`
                              };
                            }
                          }
                        }
                        return token;
                      });
                    }
                  }
                }
              }

              newMetadata[fieldId] = {
                label: { text: labelText, show: true, position: 'top', width: 'auto' },
                content: { readonly: true, formula_tokens: formulaTokens },
                component: { type: 'virtual_calc', rel_table: '', rel_value: '', rel_label: '', fixed_options: '' },
                viacep: { enabled: false },
                virtual_model_id: assignedModelId
              }
            } else if (isByoc) {
              newMetadata[fieldId] = {
                label: { text: getFormattedFieldName(fieldId), show: true, position: 'top', width: 'auto' },
                component: { type: 'byoc' },
                byoc_model_id: assignedModelId
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

  // BFS from the root table through the relations graph to discover all reachable tables.
  // This replaces the old join-config-based tree ââ‚¬â€ the dev only selects the root table now.
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

      // NOVO: Expansão via Santo Graal (Relacionamentos)
      // Se este campo for uma FK (chave estrangeira) formal ou por heurística
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
              value: `${f.db_column_name}.${rf.db_column_name}`, // Padrão: produto_id.nome
              label: `${f.display_name || f.db_column_name} -> ${rf.display_name || rf.db_column_name}`,
              isJoined: true,
              modelName: relatedModel.display_name || relatedModel.db_table_name
            });
          });
        }
      }
    });

    // Joined fields estáticos (se existirem na config)
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


  const toggleField = (fieldId: string, zone: string) => {
    const currentFields = [...config.layout_config[zone]]
    const index = currentFields.indexOf(fieldId)

    if (index > -1) {
      currentFields.splice(index, 1)
    } else {
      currentFields.push(fieldId)
      
      const isAnywhere = 
        (config.layout_config.form_fields || []).includes(fieldId) || 
        (config.layout_config.grid_fields || []).includes(fieldId) || 
        (config.layout_config.filter_fields || []).includes(fieldId);
      
      if (!isAnywhere) {
        const newMetadata = { ...(config.layout_config.fields_metadata || {}) }
        newMetadata[fieldId] = createDefaultFieldMeta(fieldId, models)
        setConfig({
          ...config,
          layout_config: {
            ...config.layout_config,
            [zone]: currentFields,
            fields_metadata: newMetadata
          }
        })
        return
      }
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
    const meta = config.layout_config?.fields_metadata?.[id]
    if (meta && meta.label && meta.label.text) {
      return meta.label.text
    }
    return id
  }

  const getFieldMeta = (fid: string, zone?: string | null) => {
    const specificKey = zone ? `${zone}-${fid}` : null
    const meta = (specificKey ? config.layout_config.fields_metadata[specificKey] : null) || config.layout_config.fields_metadata[fid]

    if (meta) return meta

    return createDefaultFieldMeta(fid, models)
  }

  const reloadFieldDefaults = (fid: string) => {
    const newFieldsMetadata = { ...(config.layout_config.fields_metadata || {}) }
    newFieldsMetadata[fid] = createDefaultFieldMeta(fid, models)
    setConfig({
      ...config,
      layout_config: {
        ...config.layout_config,
        fields_metadata: newFieldsMetadata
      }
    })
    toast(t('common.success', 'Padrões restaurados com sucesso!'), 'success')
  }

  const currentFieldMeta = editingFieldId ? getFieldMeta(editingFieldId, editingFieldZone) : null

  const updateMeta = (section: 'label' | 'content' | 'component' | 'viacep', key: string, value: any) => {
    if (!editingFieldId) return

    const baseMeta = getFieldMeta(editingFieldId, null) // get current base meta or default
    const currentMetaInZone = getFieldMeta(editingFieldId, editingFieldZone)

    const newMetaForZone = { ...currentMetaInZone }
    newMetaForZone[section] = { ...newMetaForZone[section], [key]: value }

    const newFieldsMetadata = { ...config.layout_config.fields_metadata }

    const isLayoutProp = section === 'component' && ['gridSpan', 'modalGridSpan', 'width', 'modalWidth'].includes(key)

    if (isLayoutProp) {
      if (editingFieldZone) {
        newFieldsMetadata[`${editingFieldZone}-${editingFieldId}`] = newMetaForZone
      } else {
        newFieldsMetadata[editingFieldId] = newMetaForZone
      }
    } else {
      const newMeta = { ...currentFieldMeta } // current meta being edited
      newMeta[section] = { ...newMeta[section], [key]: value }

      // 1. Atualizar a chave base (para servir de herança quando arrastar para uma nova zona)
      newFieldsMetadata[editingFieldId] = newMeta

      // 2. Atualizar as zonas existentes
      const zones = ['form', 'grid', 'filter']
      zones.forEach(z => {
        const zKey = `${z}-${editingFieldId}`
        if (newFieldsMetadata[zKey] !== undefined || editingFieldZone === z) {
          newFieldsMetadata[zKey] = {
            ...(newFieldsMetadata[zKey] || newMeta),
            [section]: {
              ...((newFieldsMetadata[zKey] || newMeta)[section] || {}),
              [key]: value
            }
          }
        }
      })
    }

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
                  newFieldsMeta[fid] = createDefaultFieldMeta(fid, models)
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
            virtualFields={virtualFields || []}
            byocComponents={byocComponents || []}
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
            <FieldZones
              config={config}
              setConfig={setConfig}
              models={models}
              toggleZone={toggleZone}
              hiddenZones={hiddenZones}
              setHiddenZones={setHiddenZones}
              expandedZones={expandedZones}
              t={t}
              toggleField={toggleField}
              setEditingFieldId={setEditingFieldId}
              setEditingFieldZone={setEditingFieldZone}
              setIsDrawerOpen={setIsDrawerOpen}
              getFieldMeta={getFieldMeta}
              getFieldName={getFieldName}
              formTree={formTree}
              relations={relations}
              hiddenDetails={hiddenDetails}
              setHiddenDetails={setHiddenDetails}
              retractedModels={retractedModels}
              setRetractedModels={setRetractedModels}
              setEditingTabId={setEditingTabId}
              setDrawerActiveTab={setDrawerActiveTab}
            />
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
        reloadFieldDefaults={reloadFieldDefaults}
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








