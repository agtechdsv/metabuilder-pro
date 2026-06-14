'use client'

import React, { useState, useCallback } from 'react'
import { Layout, Table, CheckSquare, X, Activity, Plus, List, Grid, Calendar, Clock, Maximize2, ChevronRight, Minimize2, MoreVertical, Settings, BarChart3, Image as ImageIcon, Pencil, Trash2, Save } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import RecordForm from './RecordForm'
import dynamic from 'next/dynamic'
import { createClient } from '@/utils/supabase/client'
import AnalyticsDashboard from './AnalyticsDashboard'
import { resolveRelations, resolveAllJoins } from '@/lib/relations'
import DynamicIcon from '@/components/runtime/DynamicIcon'
import { useToast } from '@/components/ui/Toast'
import { wrapChannelWithChunking } from '@/lib/chunkedChannel'

// Use dynamic import for ViewContainer to avoid SSR issues
const ViewContainer = dynamic(() => import('./ViewContainer'), { ssr: false })

interface CustomUseCaseRendererProps {
  mode: 'create' | 'edit' | 'view'
  initialData?: any
  customSlots: any[]
  logicType?: string
  masterModelId?: string
  masterModelName?: string
  projectId?: string
  secretToken?: string
  tunnelChannel?: any
  isTunnelReady?: boolean
  project?: any
  onClose: () => void
  onSave: (data: any) => Promise<void>
  isLoading?: boolean
  fields?: any[]
  dictionary?: Record<string, string>
  joins?: any[]
  customActions?: any[]
  onCustomAction?: (action: any, row?: any) => void
  refreshTrigger?: number
  detailsInterfaceTypes?: Record<string, string>
  detailsInlineTypes?: Record<string, boolean>
  detailsItemTitles?: Record<string, string>
  onEditDetail?: (detail: any) => void
  onDeleteDetail?: (detail: any) => void
  onAddDetail?: (tableName: string, parentId?: any) => void
  autoOpenSlotConfig?: { id: string, type: 'modal' | 'drawer' } | null
  projectRelations?: any[]
}

export default function CustomUseCaseRenderer({
  mode,
  initialData,
  customSlots = [],
  logicType,
  masterModelId,
  masterModelName,
  projectId,
  secretToken,
  tunnelChannel,
  isTunnelReady,
  project,
  onClose,
  onSave,
  isLoading,
  fields = [],
  dictionary = {},
  joins = [],
  customActions = [],
  onCustomAction,
  refreshTrigger,
  detailsInterfaceTypes = {},
  detailsInlineTypes = {},
  detailsItemTitles,
  onEditDetail,
  onDeleteDetail,
  onAddDetail,
  autoOpenSlotConfig,
  projectRelations = []
}: CustomUseCaseRendererProps) {
  const [activeTabId, setActiveTabId] = useState<string>(customSlots[0]?.id || '')
  const [openSlotConfig, setOpenSlotConfig] = useState<{ id: string, type: 'modal' | 'drawer', recordId?: any } | null>(autoOpenSlotConfig || null)

  // Inline edit/add modal for ViewContainer-based slots (Kanban, Timeline, Gallery, Scheduler)
  const [inlineModalState, setInlineModalState] = useState<{
    isOpen: boolean
    mode: 'create' | 'edit'
    slotId: string
    slotModelName: string
    formFields: any[]
    rowData: any
    isSaving: boolean
  } | null>(null)
  const [inlineRefreshKey, setInlineRefreshKey] = useState(0)
  const { toast } = useToast()

  React.useEffect(() => {
    if (autoOpenSlotConfig) {
      setOpenSlotConfig({ ...autoOpenSlotConfig, recordId: initialData?.id })
    }
  }, [autoOpenSlotConfig, initialData?.id])

  if (!customSlots || customSlots.length === 0) {
    return (
      <div className="p-8 text-center text-neutral-500">
        Nenhuma aba configurada para este Layout Personalizado.
      </div>
    )
  }

  const visibleSlots = customSlots.filter(s => s.render_mode !== 'button')
  const activeSlot = visibleSlots.find(s => s.id === activeTabId) || visibleSlots[0] || customSlots[0]
  const isMasterSlot = activeSlot?.id === customSlots[0]?.id
  
  // The first slot is considered the Master. Other slots are Details.
  // For details, we need to pass the parent ID to filter the grid/kanban.
  const parentId = initialData?.id

  const getSlotIcon = (type: string) => {
    switch (type) {
      case 'form': return <List className="w-4 h-4 mr-2" />
      case 'grid': return <Grid className="w-4 h-4 mr-2" />
      case 'kanban': return <Activity className="w-4 h-4 mr-2" />
      case 'timeline': return <Clock className="w-4 h-4 mr-2" />
      case 'mapa_mental': return <Settings className="w-4 h-4 mr-2" />
      case 'analytics': return <BarChart3 className="w-4 h-4 mr-2" />
      case 'galeria': return <ImageIcon className="w-4 h-4 mr-2" />
      default: return <List className="w-4 h-4 mr-2" />
    }
  }

  const renderSlotContent = (slot: any) => {
    const slotModelName = project?.models?.find((m: any) => m.id === slot.model_id)?.db_table_name

    // Se for o slot mestre, ou se for um formulário, usamos o RecordForm
    if (slot.type === 'form') {
      // Filtra os campos que pertencem a este modelo
      const slotFields = fields.filter(f => String(f.model_id) === String(slot.model_id) || f.model_name?.toLowerCase() === slotModelName?.toLowerCase())
      
      // Se for slot detalhe, o formulário deve ser de criação/edição do detalhe
      // Como simplificação da Fase 1, o formulário no Personalizado renderiza os campos.
      // A submissão do RecordForm principal já salva o `initialData` do mestre.
      
      return (
        <div key={slot.id} className="p-6">
          <RecordForm
            mode={isMasterSlot ? mode : 'view'} // Por enquanto, formulários de detalhe ficam como view, ou precisariam de gestão de estado próprio
            fields={slotFields.length > 0 ? slotFields : fields} // Fallback se não filtrar bem
            initialData={initialData}
            onSave={onSave}
            onCancel={onClose}
            isLoading={isLoading}
            logicType="cadastro"
            masterModelId={slot.model_id}
            masterModelName={slotModelName}
            projectId={projectId}
            secretToken={secretToken}
            tunnelChannel={tunnelChannel}
            isTunnelReady={isTunnelReady}
            project={project}
            joins={joins}
            dictionary={dictionary}
            customActions={customActions}
            onCustomAction={onCustomAction}
            detailsItemTitles={detailsItemTitles}
            hideHeader={true}
          />
        </div>
      )
    }
    if (slot.type === 'analytics') {
      return (
        <div key={slot.id} className="h-full bg-neutral-50 dark:bg-neutral-950">
          <AnalyticsDashboard 
            config={slot.analytics_config || { widgets: [], allow_runtime_edit: false }}
            project={project}
            joins={joins || []}
            filters={{}}
            onEditWidget={() => {}}
            onAddWidget={() => {}}
            onDeleteWidget={() => {}}
            onSaveLayout={async (newConfig: any) => {}}
            tunnelChannel={tunnelChannel}
            isTunnelReady={isTunnelReady}
            projectRelations={projectRelations}
          />
        </div>
      )
    }

    if (['grid', 'kanban', 'timeline', 'mapa_mental', 'galeria', 'scheduler', 'gantt', 'map', 'blueprint'].includes(slot.type)) {
      const useMasterId = slot.use_master_id !== false;
      const hasStaticFilters = slot.static_filters && slot.static_filters.some((f: any) => f.field && f.value);
      const slotModel = project?.models?.find((m: any) => m.id === slot.model_id || m.db_table_name === slotModelName);
      
      // Busca a view original (Kanban/Pesquisa) para herdar configs de exibição
      const modelViews = project?.views?.filter((v: any) => String(v.model_id) === String(slot.model_id)) || [];
      const referenceView = modelViews.find((v: any) => v.logic_type === 'kanban') || modelViews.find((v: any) => v.logic_type === 'pesquisa');

      // ⚠️ CRITICAL: slotDisplayFields MUST include all slotModel.fields so that
      // DynamicTimeline/DynamicKanban/DynamicGallery/DynamicScheduler can resolve
      // field IDs (stored in timeline_config.title_field etc.) to db_column_names.
      // We merge: slotModel.fields (all fields, for ID resolution) +
      //           referenceView.display_fields (for display config/zone overrides)
      // Deduplicated by field ID, with referenceView config taking precedence.
      const allModelFields = slotModel?.fields || [];
      const refViewFields = referenceView?.display_fields || [];
      const refViewFieldMap = new Map(refViewFields.map((f: any) => [String(f.id), f]));
      // Build merged list: start with all model fields, overlay referenceView config
      const slotDisplayFields = allModelFields.map((mf: any) => {
        return refViewFieldMap.get(String(mf.id)) || mf;
      });
      // Append any referenceView fields not in the model (e.g. computed/virtual)
      refViewFields.forEach((rf: any) => {
        if (!allModelFields.some((mf: any) => String(mf.id) === String(rf.id))) {
          slotDisplayFields.push(rf);
        }
      });

      // ⚠️ CRITICAL STEP 2: Extract ALL fields configured in specific views (Timeline, Kanban, etc)
      // Some of these fields might belong to RELATED tables (e.g. 'clientes.nome_empresa').
      // They are not in slotModel.fields, and if the user didn't explicitly add them to referenceView,
      // they would be missing from the SELECT query, causing them not to display.
      const usedFields = new Set<string>();

      if (slot.kanban_card_fields) {
        slot.kanban_card_fields.forEach((f: string) => usedFields.add(f));
      }
      if (slot.kanban_group_display_field) usedFields.add(slot.kanban_group_display_field);
      if (slot.timeline_config) {
        const tc = slot.timeline_config;
        if (tc.title_field) usedFields.add(tc.title_field);
        if (tc.date_field) usedFields.add(tc.date_field);
        if (tc.desc_field) usedFields.add(tc.desc_field);
        if (tc.icon_field) usedFields.add(tc.icon_field);
      }
      if (slot.scheduler_config) {
        const sc = slot.scheduler_config;
        if (sc.title_field) usedFields.add(sc.title_field);
        if (sc.start_date_field) usedFields.add(sc.start_date_field);
        if (sc.end_date_field) usedFields.add(sc.end_date_field);
        if (sc.color_field) usedFields.add(sc.color_field);
      }
      if (slot.gallery_config) {
        const gc = slot.gallery_config;
        if (gc.title_field) usedFields.add(gc.title_field);
        if (gc.image_field) usedFields.add(gc.image_field);
        if (gc.description_field) usedFields.add(gc.description_field);
        if (gc.category_field) usedFields.add(gc.category_field);
        if (gc.card_fields && Array.isArray(gc.card_fields)) {
          gc.card_fields.forEach((f: string) => usedFields.add(f));
        }
      }

      // Resolve those fields from any model in the project and add to slotDisplayFields if missing
      usedFields.forEach(fieldIdentifier => {
        // Skip if already in slotDisplayFields by ID or db_column_name
        if (slotDisplayFields.some((f: any) => String(f.id) === fieldIdentifier || f.db_column_name === fieldIdentifier)) return;

        let searchTable = null;
        let searchCol = fieldIdentifier;
        if (fieldIdentifier.includes('.')) {
          const parts = fieldIdentifier.split('.');
          searchTable = parts[0];
          searchCol = parts[1];
        }

        for (const m of project?.models || []) {
          if (searchTable && m.db_table_name !== searchTable) continue;
          
          const found = m.fields?.find((f: any) => String(f.id) === fieldIdentifier || f.db_column_name === searchCol);
          if (found) {
             let colName = found.db_column_name;
             if (m.id !== slotModel?.id) {
               colName = `${m.db_table_name}.${found.db_column_name}`;
             }
             slotDisplayFields.push({ ...found, db_column_name: colName });
             break;
          }
        }
      });

      let slotFilterFields: any[] = [];
      if (slot.dynamic_filters && slot.dynamic_filters.length > 0) {
        slotFilterFields = slot.dynamic_filters.map((filterItem: any) => {
          const isObject = typeof filterItem === 'object' && filterItem !== null;
          let colName = isObject ? filterItem.field : filterItem;
          let label = isObject ? filterItem.label : '';

          let f = slotModel?.fields?.find((f:any) => f.db_column_name === colName);
          if (!f) {
            const parts = colName.split('.');
            if (parts.length === 2) {
              const tableName = parts[0];
              const fieldName = parts[1];
              const relModel = project?.models?.find((m: any) => m.db_table_name === tableName);
              if (relModel) {
                const foundField = relModel.fields?.find((f: any) => f.db_column_name === fieldName);
                if (foundField) {
                  f = JSON.parse(JSON.stringify(foundField)); // Deep clone
                  const compType = f.config?.filter_config?.component?.type || f.config?.component?.type;
                  const isAlreadyRelational = ['select', 'radio', 'checkbox', 'Combo (Select)'].includes(compType);
                  
                  if (!isAlreadyRelational) {
                    // Transforma automaticamente campos de texto de outras tabelas em combo boxes
                    if (!f.config) f.config = {};
                    if (!f.config.filter_config) f.config.filter_config = {};
                    f.config.filter_config.component = {
                      type: 'select',
                      options_type: 'relational',
                      rel_table: tableName,
                      rel_value: fieldName,
                      rel_label: fieldName
                    };
                  }
                }
              }
            } else {
              for (const m of project?.models || []) {
                f = m.fields?.find((f:any) => f.db_column_name === colName);
                if (f) break;
              }
            }
          }
          if (f) {
            return { ...f, db_column_name: colName, display_name: label || f.display_name || f.db_column_name };
          }
          return { db_column_name: colName, display_name: label || colName };
        }).filter(Boolean);
      }
      
      let slotFormFields = referenceView?.form_fields || [];
      if (!slotFormFields || slotFormFields.length === 0) {
        slotFormFields = allModelFields.filter((f: any) => !f.db_column_name.includes('id') && f.db_column_name !== 'criado_em').map((f: any) => ({
          ...f,
          visible: true,
          editable: true,
          required: false
        }));
      }

      const slotButtonsConfig = [...(referenceView?.buttons_config || [])];
      if (slot.can_add !== undefined) {
        const btn = slotButtonsConfig.find(b => b.id === 'add');
        if (btn) btn.visible = slot.can_add;
        else slotButtonsConfig.push({ id: 'add', visible: slot.can_add });
      }
      if (slot.can_edit !== undefined) {
        const btn = slotButtonsConfig.find(b => b.id === 'edit');
        if (btn) btn.visible = slot.can_edit;
        else slotButtonsConfig.push({ id: 'edit', visible: slot.can_edit });
      }
      if (slot.can_delete !== undefined) {
        const btn = slotButtonsConfig.find(b => b.id === 'delete');
        if (btn) btn.visible = slot.can_delete;
        else slotButtonsConfig.push({ id: 'delete', visible: slot.can_delete });
      }

      if (useMasterId && (mode === 'create' || !parentId)) {
        return (
          <div key={slot.id} className="p-8 text-center text-neutral-500 bg-neutral-50 dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 m-6">
            Salve o registro principal primeiro para visualizar os dados relacionados.
          </div>
        )
      }

      // Descobre a chave estrangeira (join) entre o mestre e este modelo de detalhe
      const join = (joins || []).find(j => {
        const fromT = (j.from || j.table)?.toLowerCase()
        const toT = (j.to || j.toTable)?.toLowerCase()
        return (fromT === masterModelName?.toLowerCase() && toT === slotModelName?.toLowerCase()) ||
               (toT === masterModelName?.toLowerCase() && fromT === slotModelName?.toLowerCase())
      })

      let foreignKey: string | undefined = undefined;
      if (join) {
        const fromT = (join.from || join.table)?.toLowerCase()
        if (fromT === slotModelName?.toLowerCase()) {
          foreignKey = join.from_column || join.localKey || join.local_field
        } else {
          foreignKey = join.to_column || join.foreignKey || join.foreign_field
        }
      }

      // Tenta inferir a chave estrangeira automaticamente se não encontrar no join explícito
      if (!foreignKey && useMasterId && project?.models) {
        if (slotModelName?.toLowerCase() === masterModelName?.toLowerCase()) {
          // O Mestre e o Detalhe são a mesma tabela! O vínculo é o próprio ID do registro.
          foreignKey = 'id';
        } else {
          const slotModelDef = project.models.find((m: any) => m.db_table_name?.toLowerCase() === slotModelName?.toLowerCase());
          const masterModelDef = project.models.find((m: any) => m.db_table_name?.toLowerCase() === masterModelName?.toLowerCase());
          if (slotModelDef && masterModelDef) {
            const masterTableBase = masterModelDef.db_table_name?.toLowerCase() || '';
            const singularMasterTable = masterTableBase.endsWith('s') ? masterTableBase.slice(0, -1) : masterTableBase;
            
            const fkField = slotModelDef.fields?.find((f: any) => 
              f.foreign_key_table?.toLowerCase() === masterTableBase ||
              f.db_column_name?.toLowerCase() === `${masterTableBase}_id` ||
              f.db_column_name?.toLowerCase() === `id_${masterTableBase}` ||
              f.db_column_name?.toLowerCase() === `${singularMasterTable}_id` ||
              f.db_column_name?.toLowerCase() === `id_${singularMasterTable}` ||
              (masterModelDef.name && f.db_column_name?.toLowerCase() === `${masterModelDef.name.toLowerCase()}_id`)
            );
            if (fkField) {
              foreignKey = fkField.db_column_name;
            }
          }
        }
      }

      let generatedJoins = joins ? [...joins] : [];
      let isJoinedIndirectly = false;
      if (useMasterId && !foreignKey) {
        if (generatedJoins.length > 0) {
          const hasMaster = generatedJoins.some((j: any) => (j.from || j.table)?.toLowerCase() === masterModelName?.toLowerCase() || (j.to || j.toTable)?.toLowerCase() === masterModelName?.toLowerCase());
          if (hasMaster) {
            isJoinedIndirectly = true;
          }
        }
        
      if (!isJoinedIndirectly && projectRelations && projectRelations.length > 0 && masterModelName && slotModelName) {
          const resolvedRelations = resolveRelations(projectRelations, project?.models || [])
          const steps = resolveAllJoins(resolvedRelations, slotModelName, [masterModelName])
          if (steps.length > 0) {
            isJoinedIndirectly = true
            const bfsJoins = steps.map(step => ({
              type: 'LEFT',
              from: step.sourceTable,
              localField: step.sourceColumn,
              to: step.targetTable,
              foreignField: step.targetColumn
            }))
            generatedJoins = [...generatedJoins, ...bfsJoins]
          }
        }
      }

      if (useMasterId && !foreignKey && !isJoinedIndirectly) {
        return (
          <div key={slot.id} className="p-8 text-center text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-500 rounded-xl border border-amber-200 dark:border-amber-800 m-6 flex flex-col items-center gap-2">
            <span className="font-bold text-lg">⚠️ Atenção: Ligação com o Mestre Falhou</span>
            <span>A aba está configurada para &quot;Vincular ao Mestre&quot;, mas não foi possível encontrar a chave estrangeira na tabela <strong>{slotModelName}</strong> que aponte para <strong>{masterModelName}</strong> e não existem joins configurados.</span>
            <span className="text-sm opacity-80 mt-2">Certifique-se de que a tabela possui uma coluna de ligação (ex: {masterModelName?.endsWith('s') ? masterModelName.slice(0, -1) : masterModelName}_id) ou configure o relacionamento manualmente no Studio.</span>
          </div>
        )
      }

      // Monta os filtros externos básicos (para relacionamentos simples)
      let externalFilters: Record<string, any> = {};
      if (useMasterId && foreignKey && parentId) {
        externalFilters[foreignKey] = parentId;
      }
      
      let advancedStaticFilters: any[] = [];
      
      // Se tiver parentId mas não tiver foreignKey direta (porém está indiretamente joinada)
      if (useMasterId && !foreignKey && isJoinedIndirectly && parentId) {
        advancedStaticFilters.push({
          field: `${masterModelName}.id`,
          operator: '=',
          value: parentId,
          logic: 'AND'
        });
      }
      if (hasStaticFilters) {
        slot.static_filters.forEach((filter: any) => {
          if (filter.field && filter.value) {
            advancedStaticFilters.push({
              field: filter.field,
              operator: filter.operator || '=',
              value: filter.value,
              value2: filter.value2,
              logic: filter.logic || 'AND'
            });
          }
        });
      }

      // Fix 3: Auto-add joins for dynamic_filters fields that reference related tables
      if (slotFilterFields.length > 0 && projectRelations && projectRelations.length > 0 && slotModelName) {
        const resolvedRelationsForFilters = resolveRelations(projectRelations, project?.models || [])
        for (const filterField of slotFilterFields) {
          const colName = filterField.db_column_name || ''
          // Check if the field references a different table (format: "table.field" or field found in related model)
          const dotParts = colName.split('.')
          const relatedTableName = dotParts.length === 2 ? dotParts[0] : null
          if (relatedTableName && relatedTableName !== slotModelName) {
            // Only add join if not already present
            const alreadyJoined = generatedJoins.some((j: any) =>
              (j.from || j.table) === relatedTableName || (j.to || j.toTable) === relatedTableName
            )
            if (!alreadyJoined) {
              const steps = resolveAllJoins(resolvedRelationsForFilters, slotModelName, [relatedTableName])
              if (steps.length > 0) {
                const filterJoins = steps.map(step => ({
                  type: 'LEFT',
                  from: step.sourceTable,
                  localField: step.sourceColumn,
                  to: step.targetTable,
                  foreignField: step.targetColumn
                }))
                generatedJoins = [...generatedJoins, ...filterJoins]
              }
            }
          }
        }
      }

      // Se for GRID, usar Master Id, e não tiver filtros customizados, usamos o RecordForm
      // para preservar a interface de "Cortina" nativa do Mestre Detalhe.
      if (slot.type === 'grid' && useMasterId && !hasStaticFilters) {
        return (
          <div key={slot.id} className="p-6 h-[calc(100vh-150px)] overflow-y-auto custom-scrollbar">
            <RecordForm
              mode={mode}
              fields={fields}
              initialData={initialData}
              onSave={onSave}
              onCancel={onClose}
              isLoading={isLoading}
              hideHeader={true}
              logicType="master_detail"
              masterModelId={masterModelId}
              masterModelName={masterModelName}
              renderOnlyDetail={slotModelName}
              detailsInterfaceTypes={detailsInterfaceTypes}
              detailsInlineTypes={detailsInlineTypes}
              detailsItemTitles={detailsItemTitles}
              onEditDetail={onEditDetail}
              onDeleteDetail={onDeleteDetail}
              onAddDetail={onAddDetail}
              joins={generatedJoins}
              dictionary={dictionary}
              customActions={customActions}
              onCustomAction={onCustomAction}
              projectId={projectId}
              secretToken={secretToken}
              tunnelChannel={tunnelChannel}
              isTunnelReady={isTunnelReady}
              project={project}
              refreshTrigger={refreshTrigger}
            />
          </div>
        )
      }

      // Handlers locais que abrem modal inline (sem depender do ViewPageContent pai)
      const canAdd = slot.can_add !== false
      const canEdit = slot.can_edit !== false
      const canDelete = slot.can_delete !== false

      const handleLocalEdit = (row: any) => {
        setInlineModalState({
          isOpen: true,
          mode: 'edit',
          slotId: slot.id,
          slotModelName: slotModelName!,
          formFields: slotFormFields,
          rowData: row,
          isSaving: false
        })
      }

      const handleLocalAdd = () => {
        // pre-fill FK to master if applicable
        const preData: any = {}
        if (foreignKey && parentId && foreignKey !== 'id') {
          preData[foreignKey] = parentId
        }
        setInlineModalState({
          isOpen: true,
          mode: 'create',
          slotId: slot.id,
          slotModelName: slotModelName!,
          formFields: slotFormFields,
          rowData: preData,
          isSaving: false
        })
      }

      const handleLocalDelete = (row: any) => {
        onDeleteDetail?.(row)
      }

      // Para KANBAN ou quando as regras exigirem, usamos o poderoso ViewContainer
      return (
        <div key={slot.id} className="flex flex-col h-[calc(100vh-150px)]">
          {/* Botão Novo dentro da aba */}
          {canAdd && (
            <div className="px-6 pt-4 flex justify-end">
              <button
                onClick={handleLocalAdd}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs tracking-wider transition-all shadow-lg shadow-indigo-500/20"
              >
                <Plus className="w-3.5 h-3.5" />
                Novo Registro
              </button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <ViewContainer
            externalRefreshTrigger={refreshTrigger || 0 + inlineRefreshKey}
            projectId={projectId!}
            modelName={slotModelName!}
            displayFields={slotDisplayFields}
            filterFields={slotFilterFields}
            formFields={slotFormFields}
            displayType="list"
            logicType={['kanban', 'timeline', 'mapa_mental', 'galeria', 'scheduler'].includes(slot.type) ? slot.type : 'pesquisa'}
            kanbanGroupField={slot.kanban_group_field}
            kanbanGroupDisplayField={slot.kanban_group_display_field}
            kanbanCardFields={(() => {
              const rawCardFields = slot.kanban_card_fields || [];
              if (!rawCardFields.length) return rawCardFields;
              // Translate field IDs to db_column_names if they look like UUIDs
              return rawCardFields.map((idOrName: string) => {
                // If it already looks like a db_column_name (no hyphens/long UUID), keep as-is
                const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(idOrName);
                if (!isUuid) return idOrName;
                const found = slotModel?.fields?.find((f: any) => String(f.id) === idOrName);
                return found?.db_column_name || idOrName;
              });
            })()}
            timelineConfig={slot.timeline_config ? {
                ...slot.timeline_config,
                // Merge style_defaults set by developer in Studio
                ...(slot.timeline_config.style_defaults ? {
                  layout_direction: slot.timeline_config.style_defaults.direction || slot.timeline_config.layout_direction,
                  animated: slot.timeline_config.style_defaults.animation !== 'off',
                  layout_mode: slot.timeline_config.style_defaults.mode === 'zigzag' ? 'alternating'
                    : slot.timeline_config.style_defaults.mode === 'alternado' ? 'same_side'
                    : slot.timeline_config.style_defaults.mode || slot.timeline_config.layout_mode,
                  layout_style: slot.timeline_config.style_defaults.appearance === 'minimal' ? 'infographic'
                    : slot.timeline_config.style_defaults.appearance === 'compact' ? 'infographic'
                    : slot.timeline_config.style_defaults.appearance || slot.timeline_config.layout_style,
                } : {})
              } : undefined}
            schedulerConfig={slot.scheduler_config}
            mindmapCentralField={slot.mindmap_central_field}
            mindmapLevels={slot.mindmap_levels}
            externalFilters={externalFilters}
            advancedStaticFilters={advancedStaticFilters}
            buttonsConfig={slotButtonsConfig}
            locale="pt-BR"
            tunnelChannel={tunnelChannel}
            isTunnelReady={isTunnelReady}
            dictionary={dictionary}
            project={project}
            onEdit={canEdit ? handleLocalEdit : undefined}
            onDelete={canDelete ? handleLocalDelete : undefined}
            onAdd={canAdd ? handleLocalAdd : undefined}
          />
          </div>
        </div>
      )
    }

    return null
  }

  // Salvar registro do slot inline (edit ou create)
  const handleInlineSave = async (formData: any) => {
    if (!inlineModalState) return
    setInlineModalState(prev => prev ? { ...prev, isSaving: true } : null)

    const { mode: saveMode, slotModelName, rowData } = inlineModalState
    const supabase = createClient()
    const queryId = crypto.randomUUID()

    const slotModel = project?.models?.find((m: any) => m.db_table_name === slotModelName)
    const pkField = inlineModalState.formFields.find((f: any) => f.is_primary_key) || { db_column_name: 'id' }
    const pkName = pkField.db_column_name.split('.').pop() || 'id'
    const pkValue = rowData?.[pkName] || rowData?.id || rowData?.ID

    const SKIP_KEYS = new Set(['_details', 'model_name', 'display_model_name'])
    const sanitized: any = {}
    for (const [k, v] of Object.entries(formData)) {
      const lk = k.toLowerCase()
      if (
        SKIP_KEYS.has(lk) || k.startsWith('_') || k.startsWith('virt_') || k.includes('.') ||
        (saveMode === 'edit' && (lk === pkName.toLowerCase() || lk === 'created_at' || lk === 'updated_at')) ||
        v === undefined || typeof v === 'object'
      ) continue
      if (saveMode === 'edit') {
        const origRaw = rowData?.[k] ?? rowData?.[lk] ?? rowData?.[k.toUpperCase()]
        const orig = origRaw === null || origRaw === '' ? null : String(origRaw)
        const cur = v === null || v === '' ? null : String(v)
        if (cur === orig) continue
      }
      sanitized[k] = (v === null || v === '') ? null : String(v)
    }

    // Ensure FK to parent is set on create
    if (saveMode === 'create' && parentId) {
      const slot = customSlots.find(s => s.id === inlineModalState.slotId)
      const fk = slot?.foreign_key
      if (fk && fk !== 'id') {
        sanitized[fk] = String(parentId)
      }
    }

    if (saveMode === 'edit' && Object.keys(sanitized).length === 0) {
      toast('Nenhuma alteração detectada.', 'info')
      setInlineModalState(null)
      return
    }

    const schemaName = slotModel?.db_schema_name || project?.slug || 'public'
    let rawQuery = ''
    if (saveMode === 'edit') {
      const setClause = Object.entries(sanitized)
        .map(([k, v]) => v === null ? `"${k}" = NULL` : `"${k}" = '${String(v).replace(/'/g, "''")}'`)
        .join(', ')
      rawQuery = `UPDATE "${slotModelName}" SET ${setClause} WHERE "${pkName}" = '${String(pkValue).replace(/'/g, "''")}'`
    } else {
      const keys = Object.keys(sanitized).map(k => `"${k}"`).join(', ')
      const vals = Object.values(sanitized)
        .map(v => v === null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`)
        .join(', ')
      rawQuery = `INSERT INTO "${slotModelName}" (${keys}) VALUES (${vals})`
    }

    try {
      const isTemporary = !tunnelChannel || !isTunnelReady
      const channelName = `tunnel:${projectId}`
      const channel = isTemporary ? wrapChannelWithChunking(supabase.channel(channelName)) : tunnelChannel

      const result = await new Promise<{ success: boolean; error?: string }>((resolve) => {
        let settled = false
        const handleResult = (payload: any) => {
          if (payload.payload?.queryId === queryId) {
            settled = true
            cleanup()
            resolve({ success: payload.payload.success, error: payload.payload.error })
          }
        }
        const cleanup = () => {
          try {
            const bindings = channel.bindings?.broadcast
            if (Array.isArray(bindings)) {
              channel.bindings.broadcast = bindings.filter((b: any) => b.callback !== handleResult)
            }
            if (isTemporary) { channel.unsubscribe(); supabase.removeChannel(channel) }
          } catch (_) {}
        }
        channel.on('broadcast', { event: `query_result_${queryId}` }, handleResult)
        channel.on('broadcast', { event: 'sql_result' }, handleResult)
        const doSend = () => channel.send({
          type: 'broadcast',
          event: 'sql_query',
          payload: {
            queryId,
            table: slotModelName,
            action: saveMode === 'edit' ? 'update' : 'insert',
            data: sanitized,
            sql: rawQuery,
            idColumn: pkName,
            idValue: pkValue,
            token: project?.secret_token || 'test-token',
            schemaName,
            slug: project?.slug
          }
        })
        if (isTemporary) {
          channel.subscribe((status: string) => { if (status === 'SUBSCRIBED') doSend() })
        } else {
          doSend()
        }
        setTimeout(() => { if (!settled) { settled = true; cleanup(); resolve({ success: false, error: 'Timeout' }) } }, 9000)
      })

      if (result.success) {
        toast(saveMode === 'create' ? 'Registro criado com sucesso!' : 'Registro atualizado com sucesso!', 'success')
        setInlineModalState(null)
        setInlineRefreshKey(prev => prev + 1)
      } else {
        toast(result.error || 'Erro ao salvar registro.', 'error')
        setInlineModalState(prev => prev ? { ...prev, isSaving: false } : null)
      }
    } catch (err: any) {
      toast('Erro inesperado: ' + err.message, 'error')
      setInlineModalState(prev => prev ? { ...prev, isSaving: false } : null)
    }
  }

  const renderTopActions = () => {
    const slotButtons = customSlots.filter(s => {
      if (s.render_mode !== 'button' && s.render_mode !== 'both') return false;
      const config = s.button_config || {};
      const location = config.location || 'master_top';
      
      if (isMasterSlot && location === 'master_top') return true;
      if (!isMasterSlot && location === 'specific_tab_top' && config.target_tab_id === activeSlot?.id) return true;
      
      return false;
    });

    if (slotButtons.length === 0) return null;

    return (
      <div className="flex items-center gap-2 px-6 pt-4">
        {slotButtons.map(s => {
          const config = s.button_config || {};
          return (
            <button
              key={`btn-${s.id}`}
              onClick={() => setOpenSlotConfig({ id: s.id, type: config.action_type || 'modal', recordId: parentId })}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-wider rounded-xl border border-indigo-100 dark:border-indigo-800/50 transition-all"
            >
              {config.label || s.title}
            </button>
          )
        })}
      </div>
    );
  }

  // Se tem um slot aberto como Modal ou Drawer, precisamos encontrar ele
  const openedSlot = openSlotConfig ? customSlots.find(s => s.id === openSlotConfig.id) : null;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#050505]">
      {/* Custom Tabs Header */}
      <div className="px-6 pt-2">
        <div className="flex border-b border-neutral-100 dark:border-neutral-800">
          {visibleSlots.map((slot) => (
            <button
              key={slot.id}
              onClick={() => setActiveTabId(slot.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap",
                activeTabId === slot.id
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
              )}
            >
              {slot.icon ? <DynamicIcon icon={slot.icon} className="w-4 h-4 mr-2" /> : getSlotIcon(slot.type)}
              {slot.title}
            </button>
          ))}
        </div>
      </div>

      {renderTopActions()}

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeSlot && renderSlotContent(activeSlot)}
      </div>

      <AnimatePresence>
        {openedSlot && openSlotConfig && openSlotConfig.type === 'modal' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 bg-neutral-900/40 backdrop-blur-sm"
            onClick={() => {
              setOpenSlotConfig(null)
              if (autoOpenSlotConfig) onClose?.()
            }}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full max-w-5xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden" 
              style={{ maxHeight: '90vh' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-800">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider">{openedSlot.title}</h3>
                <button 
                  onClick={() => {
                    setOpenSlotConfig(null)
                    if (autoOpenSlotConfig) {
                      onClose?.()
                    }
                  }}
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 bg-neutral-50 dark:bg-neutral-950/50">
                {renderSlotContent(openedSlot)}
              </div>
            </motion.div>
          </motion.div>
        )}

        {openedSlot && openSlotConfig && openSlotConfig.type === 'drawer' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[200] flex justify-end bg-neutral-900/40 backdrop-blur-sm"
            onClick={() => {
              setOpenSlotConfig(null)
              if (autoOpenSlotConfig) onClose?.()
            }}
          >
            <motion.div 
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-full max-w-2xl bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 shadow-2xl flex flex-col h-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-100 dark:border-neutral-800">
                <h3 className="text-base font-bold text-neutral-900 dark:text-white uppercase tracking-wider">{openedSlot.title}</h3>
                <button 
                  onClick={() => {
                    setOpenSlotConfig(null)
                    if (autoOpenSlotConfig) {
                      onClose?.()
                    }
                  }}
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 bg-neutral-50 dark:bg-neutral-950/50">
                {renderSlotContent(openedSlot)}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal inline para Editar / Novo registro de slot ── */}
      <AnimatePresence>
        {inlineModalState?.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[300] flex items-center justify-center bg-neutral-900/60 backdrop-blur-sm"
            onClick={() => setInlineModalState(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-neutral-200 dark:border-neutral-800 mx-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-100 dark:border-neutral-800">
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  {inlineModalState.mode === 'create' ? 'Novo Registro' : 'Editar Registro'}
                </h3>
                <button
                  onClick={() => setInlineModalState(null)}
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <RecordForm
                  mode={inlineModalState.mode}
                  fields={inlineModalState.formFields}
                  initialData={inlineModalState.rowData}
                  onSave={handleInlineSave}
                  onCancel={() => setInlineModalState(null)}
                  isLoading={inlineModalState.isSaving}
                  logicType="cadastro"
                  masterModelId={project?.models?.find((m: any) => m.db_table_name === inlineModalState.slotModelName)?.id || ''}
                  masterModelName={inlineModalState.slotModelName}
                  projectId={projectId}
                  secretToken={secretToken}
                  tunnelChannel={tunnelChannel}
                  isTunnelReady={isTunnelReady}
                  project={project}
                  joins={[]
                  }
                  dictionary={dictionary}
                  hideHeader={true}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
