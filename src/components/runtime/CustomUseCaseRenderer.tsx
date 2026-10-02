'use client'

import React, { useState, useCallback } from 'react'
import { getPkColumn, findModelByTable, getRecordPk, readCol, resolveRecordLabel } from '@/lib/schemaResolver'
import { isNumericDbType, parseNumericLoose } from '@/lib/valueCoercion'
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
import DeleteConfirmModal from './DeleteConfirmModal'

// Um slot do tipo "group" contém vários casos de uso (children), exibidos como subabas ou como quadros (grade).
// Esta função devolve todos os slots, incluindo os filhos dos grupos (usada para buscas por id/slug).
const flattenSlots = (slots: any[] = []): any[] =>
  slots.flatMap((s: any) => (s?.type === 'group' ? [s, ...(s.children || [])] : [s]))

// Largura do quadro na grade de 12 colunas (classes literais para o Tailwind enxergar); em telas pequenas empilha
const GROUP_COL_CLASS: Record<string, string> = {
  '1/4': 'md:col-span-3',
  '1/3': 'md:col-span-4',
  '1/2': 'md:col-span-6',
  '2/3': 'md:col-span-8',
  '3/4': 'md:col-span-9',
  'full': 'md:col-span-12',
}
const GROUP_HEIGHT_PX: Record<string, number> = { compact: 320, medium: 480, large: 640 }
const getPanelHeight = (child: any): number | undefined => {
  if (child?.height === 'auto') return undefined
  if (child?.height === 'custom') return Math.min(2000, Math.max(120, Number(child.height_px) || 480))
  return GROUP_HEIGHT_PX[child?.height as string] ?? GROUP_HEIGHT_PX.medium
}

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
  onEditDetail?: (detail: any, uiOverride?: any) => void
  onDeleteDetail?: (detail: any) => void
  onAddDetail?: (tableName: string, parentId?: any) => void
  autoOpenSlotConfig?: { id: string, type: 'modal' | 'drawer' } | null
  projectRelations?: any[]
  // Mantêm a aba interna (Dados Principais / detalhes) e forçam recarga após salvar, como no caso de uso original
  initialTab?: string
  onTabChange?: (tab: string) => void
  relationalRefreshTrigger?: number
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
  projectRelations = [],
  initialTab,
  onTabChange,
  relationalRefreshTrigger
}: CustomUseCaseRendererProps) {
  const getSlotId = (slot: any, idx: number) => slot?.id || slot?.use_case_slug || `slot-${idx}`;
  const [activeTabId, setActiveTabId] = useState<string>(customSlots && customSlots.length > 0 ? getSlotId(customSlots[0], 0) : '')
  // Subaba ativa de cada grupo (modo "tabs"), keyed pelo id do grupo
  const [subTabIds, setSubTabIds] = useState<Record<string, string>>({})
  // slotProps: props completas vindas do servidor para cada slot, keyed by use_case_slug
  const [slotProps, setSlotProps] = useState<Record<string, any>>({})

  React.useEffect(() => {
    async function fetchAllSlotProps() {
      if (!customSlots || !projectId) return;
      const slugsToFetch = Array.from(new Set(flattenSlots(customSlots).map((s: any) => s.use_case_slug).filter(Boolean))) as string[];
      if (slugsToFetch.length === 0) return;

      // Busca props de todos os slots em paralelo via API Route server-side
      const results = await Promise.all(
        slugsToFetch.map(async (slug: string) => {
          try {
            const res = await fetch(`/api/runtime/slot-props?projectId=${projectId}&slug=${encodeURIComponent(slug)}`);
            if (!res.ok) return { slug, props: null };
            const props = await res.json();
            return { slug, props };
          } catch (e) {
            console.error(`[CustomUseCaseRenderer] Erro ao buscar props para slug "${slug}":`, e);
            return { slug, props: null };
          }
        })
      );

      const mapping: Record<string, any> = {};
      results.forEach(({ slug, props }) => {
        if (props) mapping[slug] = props;
      });
      setSlotProps(mapping);
    }
    fetchAllSlotProps();
  }, [customSlots, projectId]);
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
    joins?: any[]
    useCaseSlug?: string
  } | null>(null)
  
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean
    rowData: any
    slotModelName: string
    pkField: any
    pkName: string
    pkValue: any
    isDeleting: boolean
    recordName?: string
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
  const activeSlot = visibleSlots.find((s, idx) => getSlotId(s, idx) === activeTabId) || visibleSlots[0] || customSlots[0]
  const isMasterSlot = activeSlot?.id === customSlots[0]?.id
  
  // The first slot is considered the Master. Other slots are Details.
  // For details, we need to pass the parent ID to filter the grid/kanban.
  // Oracle uses UPPERCASE column names (e.g. ID instead of id), so we resolve
  // the PK by checking lowercase first, then uppercase, then any key matching /^id$/i.
  const parentId = initialData?.id ?? initialData?.ID ?? (
    initialData
      ? Object.entries(initialData).find(([k]) => /^id$/i.test(k))?.[1]
      : undefined
  )

  const getSlotIcon = (type: string) => {
    switch (type) {
      case 'form': return <List className="w-4 h-4 mr-2" />
      case 'grid': return <Grid className="w-4 h-4 mr-2" />
      case 'kanban': return <Activity className="w-4 h-4 mr-2" />
      case 'timeline': return <Clock className="w-4 h-4 mr-2" />
      case 'mapa_mental': return <Settings className="w-4 h-4 mr-2" />
      case 'analytics': return <BarChart3 className="w-4 h-4 mr-2" />
      case 'galeria': return <ImageIcon className="w-4 h-4 mr-2" />
      case 'group': return <Layout className="w-4 h-4 mr-2" />
      default: return <List className="w-4 h-4 mr-2" />
    }
  }

  // Renderiza um grupo: subabas (um caso de uso por vez) ou quadros (todos visíveis, em grade)
  const renderGroup = (group: any) => {
    const children = (group.children || []).filter((c: any) => c.render_mode !== 'button')
    if (children.length === 0) {
      return (
        <div key={group.id} className="p-8 text-center text-neutral-500">
          Nenhum caso de uso configurado neste grupo.
        </div>
      )
    }

    if ((group.group_mode || 'tabs') === 'grid') {
      return (
        <div key={group.id} className="p-4 lg:p-6 grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          {children.map((child: any) => {
            const height = getPanelHeight(child)
            return (
              <div key={child.id} className={cn('col-span-1 min-w-0', GROUP_COL_CLASS[child.col_span || '1/2'] || 'md:col-span-6')}>
                <div className="flex flex-col rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden shadow-sm">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800 text-[10px] font-black uppercase tracking-widest text-neutral-500">
                    {child.icon ? <DynamicIcon icon={child.icon} className="w-4 h-4" /> : getSlotIcon(child.type)}
                    {child.title}
                  </div>
                  <div className="relative overflow-hidden" style={height ? { height } : { minHeight: 200 }}>
                    {renderSlotContent(child)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )
    }

    const activeChild = children.find((c: any) => c.id === subTabIds[group.id]) || children[0]
    return (
      <div key={group.id} className="flex flex-col h-full">
        <div className="px-6 pt-4">
          <div className="inline-flex flex-wrap gap-1 p-1 bg-neutral-100 dark:bg-neutral-800/60 rounded-xl">
            {children.map((child: any) => (
              <button
                key={child.id}
                onClick={() => setSubTabIds(prev => ({ ...prev, [group.id]: child.id }))}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap',
                  activeChild.id === child.id
                    ? 'bg-white dark:bg-neutral-900 text-indigo-600 shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
                )}
              >
                {child.icon ? <DynamicIcon icon={child.icon} className="w-3.5 h-3.5" /> : null}
                {child.title}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 min-h-0">
          {renderSlotContent(activeChild)}
        </div>
      </div>
    )
  }

  const renderSlotContent = (slot: any) => {
    if (slot?.type === 'group') return renderGroup(slot)
    const uc = slotProps[slot.use_case_slug];
    if (!uc) {
      return (
        <div className="p-8 text-center text-neutral-500 flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-4"></div>
          Carregando Caso de Uso...
        </div>
      );
    }

    const useMasterId = slot.use_master_id !== false;

    // Props vindas do servidor via /api/runtime/slot-props
    // São idênticas às que page.tsx monta — garantindo paridade 100% com o original
    const ucDisplayFields = uc.displayFields || [];
    const ucFormFields = uc.formFields || [];
    
    // Oculta a Zona 1 (filtros) por padrão em abas, a não ser que o dev ative no Studio
    const showFilters = slot.show_filters === true;
    const ucFilterFields = showFilters ? (uc.filterFields || []) : [];
    
    const ucModelName = uc.modelName || '';
    const ucLogicType = uc.logicType || 'grid';
    const ucPrimaryKeyName = uc.primaryKeyName || 'id';
    const ucJoins = uc.joins || [];
    const ucDictionary = uc.dictionary || {};
    const ucProjectRelations = uc.projectRelations || projectRelations;
    const tConfig = uc.timelineConfig;
    const sConfig = uc.schedulerConfig;
    const gConfig = uc.galleryConfig;
    const mConfig = uc.mapConfig;
    const ganttConfig = uc.ganttConfig;
    const blueprintConfig = uc.blueprintConfig;
    const kGroup = uc.kanbanGroupField;
    const kCards = uc.kanbanCardFields;
    const kGroupDisplay = uc.kanbanGroupDisplayField;

    // Se a aba exige vínculo com o Mestre e não temos o ID do mestre (ainda não foi salvo)
    if (useMasterId && (mode === 'create' || !parentId)) {
      return (
        <div key={slot.id} className="p-8 text-center text-neutral-500 bg-neutral-50 dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 m-6">
          Salve o registro principal primeiro para visualizar os dados relacionados.
        </div>
      )
    }

    // Resolve o modelId do slot a partir dos dados retornados pela API
    const ucModelId = uc.modelId;

    let externalFilters: Record<string, any> = {};
    let advancedStaticFilters: any[] = [];
    let customJoins: any[] = [];
    let customJoinsResolved = false;

    // Lógica de Vínculo com o Mestre
    if (useMasterId && parentId) {
      const targetModelName = ucModelName;
      const mModelName = masterModelName || project?.models?.find((m: any) => m.id === masterModelId)?.db_table_name;
      
      // Lógica de Joins Dinâmicos (Santo Graal)
      if (slot.relation_path && Array.isArray(slot.relation_path) && slot.relation_path.length > 0 && projectRelations) {
        let hasError = false;
        slot.relation_path.forEach((relId: string) => {
          if (!relId) return;
          const rel = projectRelations.find((r: any) => r.id === relId);
          if (rel) {
            const fromModel = project?.models?.find((m: any) => m.id === (rel.from_model_id || rel.detail_model_id));
            const toModel = project?.models?.find((m: any) => m.id === (rel.to_model_id || rel.master_model_id));
            if (fromModel && toModel) {
              const fieldId = rel.from_field_id || rel.foreign_column_id;
              const linkField = fromModel.fields?.find((f: any) => f.id === fieldId);
              
              customJoins.push({
                from: fromModel.db_table_name,
                to: toModel.db_table_name,
                localKey: linkField?.db_column_name || 'id', 
                foreignKey: linkField?.foreign_key_column || getPkColumn(project?.models, toModel.db_table_name) || 'id'
              });
            } else {
              hasError = true;
            }
          }
        });
        
        if (!hasError && customJoins.length > 0) {
          customJoinsResolved = true;
          // Apply filter on the MASTER table instead of the local table!
          // This forces the query to traverse the JOIN graph to find matches.
          // Resolve the actual PK column name from the master model (Oracle may use uppercase "ID")
          const masterModel = project?.models?.find((m: any) => m.db_table_name?.toLowerCase() === mModelName?.toLowerCase());
          const masterPkColName = getPkColumn(project?.models, masterModel?.db_table_name) || 'id';
          advancedStaticFilters.push({
            field: `${mModelName}.${masterPkColName}`,
            operator: '=',
            value: parentId,
            logic: 'AND'
          });
          console.log(`[MetaBuilder:CustomSlot] Joins dinâmicos resolvidos! ${customJoins.length} joins aplicados. PK mestre: ${masterPkColName}`);
        }
      }

      if (!customJoinsResolved) {
        let foreignKey = '';
        if (joins) {
          const directJoin = joins.find((j: any) => 
            (j.from === targetModelName && j.to === mModelName) || 
            (j.from === mModelName && j.to === targetModelName)
          );
          if (directJoin) {
            const isTargetFrom = directJoin.from === targetModelName;
            const targetRawKey = isTargetFrom ? (directJoin.localKey || directJoin.local_field) : (directJoin.foreignKey || directJoin.foreign_field);
            const cleanKey = targetRawKey?.includes('.') ? targetRawKey.split('.').pop() : targetRawKey;
            
            // Procurar o campo no targetModel (tabela filha)
            const targetModel = project?.models?.find((m: any) => m.db_table_name?.toLowerCase() === targetModelName?.toLowerCase());
            if (targetModel && targetModel.fields) {
              const fieldDef = targetModel.fields.find((f: any) => 
                String(f.id) === String(cleanKey) || f.db_column_name === cleanKey
              );
              if (fieldDef) {
                foreignKey = `${targetModelName}.${fieldDef.db_column_name}`;
              } else {
                const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanKey || '');
                foreignKey = isUuid ? '' : targetRawKey;
              }
            } else {
              const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanKey || '');
              foreignKey = isUuid ? '' : targetRawKey;
            }
          }
        }

        if (!foreignKey && ucProjectRelations && ucProjectRelations.length > 0) {
          const rel = ucProjectRelations.find((r: any) => 
            (r.table_from === mModelName && r.table_to === targetModelName) || 
            (r.table_from === targetModelName && r.table_to === mModelName)
          );
          if (rel) {
            const isTargetFrom = rel.table_from === targetModelName;
            const targetCol = isTargetFrom ? rel.column_from : rel.column_to;
            foreignKey = `${targetModelName}.${targetCol}`;
            console.log(`[MetaBuilder:CustomSlot] Chave estrangeira resolvida via projectRelations: ${foreignKey}`);
          }
        }

        if (!foreignKey && project?.models && targetModelName && mModelName) {
          const targetModel = project.models.find((m: any) => m.db_table_name?.toLowerCase() === targetModelName.toLowerCase());
          if (targetModel && targetModel.fields) {
            const relField = targetModel.fields.find((f: any) => {
              const rel = (f.config?.rel_table || '').toLowerCase();
              return f.field_type === 'relation' && (rel === mModelName.toLowerCase() || mModelName.toLowerCase().includes(rel));
            });
            if (relField) {
              foreignKey = `${targetModelName}.${relField.db_column_name}`;
              console.log(`[MetaBuilder:CustomSlot] Chave estrangeira resolvida via heuristic rel_table: ${foreignKey}`);
            } else {
              // Fallback heurístico pelo nome da coluna se não houver config rel_table explícita
              const singularName = mModelName.toLowerCase().endsWith('s') ? mModelName.toLowerCase().slice(0, -1) : mModelName.toLowerCase();
              const guessField = targetModel.fields.find((f: any) => {
                const col = (f.db_column_name || '').toLowerCase();
                return col.endsWith('_id') && col.includes(singularName);
              });
              if (guessField) {
                foreignKey = `${targetModelName}.${guessField.db_column_name}`;
                console.log(`[MetaBuilder:CustomSlot] Chave estrangeira resolvida via heuristic name_guess: ${foreignKey}`);
              }
            }
          }
        }

        if (foreignKey) {
          externalFilters[foreignKey] = parentId;
        } else {
          // Fallback genérico de filtro estático
          console.warn(`[MetaBuilder:CustomSlot] Nenhuma chave estrangeira resolvida entre ${mModelName} e ${targetModelName}! Filtro omitido.`);
          const targetModel = project?.models?.find((m: any) => m.db_table_name?.toLowerCase() === targetModelName?.toLowerCase());
          if (targetModel && targetModel.fields) {
            console.warn(`[MetaBuilder:CustomSlot] Campos disponíveis em ${targetModelName}:`, targetModel.fields.map((f: any) => f.db_column_name));
          }
        }
      }
    }

    if (slot.static_filters && Array.isArray(slot.static_filters)) {
      const targetModelName = ucModelName;
      const targetModel = project?.models?.find((m: any) => m.db_table_name?.toLowerCase() === targetModelName?.toLowerCase());
      
      slot.static_filters.forEach((f: any) => {
        if (f.field && f.value) {
          let resolvedField = f.field;
          let fDef = null;
          let foundTableName = targetModelName;

          if (targetModel && targetModel.fields) {
            fDef = targetModel.fields.find((tf: any) => String(tf.id) === String(f.field) || tf.db_column_name === f.field);
          }
          
          if (!fDef && project?.models) {
             for (const m of project.models) {
               const found = m.fields?.find((tf: any) => String(tf.id) === String(f.field));
               if (found) {
                 fDef = found;
                 foundTableName = m.db_table_name;
                 break;
               }
             }
          }

          if (fDef) {
             resolvedField = `${foundTableName}.${fDef.db_column_name}`;
          }

          let formattedValue = f.value;
          // Substituto dinâmico para current_user
          if (formattedValue === '{current_user_id}') {
            const u = (typeof window !== 'undefined') ? localStorage.getItem('end_user_id') : null;
            if (u) formattedValue = u;
          }

          const cleanResolvedField = resolvedField?.includes('.') ? resolvedField.split('.').pop() : resolvedField;
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanResolvedField || '');
          
          console.log(`[MetaBuilder:CustomSlot] Static Filter Check:`, { resolvedField, cleanResolvedField, isUuid });
          
          if (!isUuid) {
            advancedStaticFilters.push({
              field: resolvedField,
              operator: f.operator || '=',
              value: formattedValue,
              logic: f.logic || 'AND'
            });
          }
        }
      })
    }

    const isFirstSlot = getSlotId(slot, visibleSlots.findIndex(s => s === slot)) === getSlotId(customSlots[0], 0);
    const isMasterTabEditingMasterRecord = isFirstSlot && (!ucModelId || ucModelId === masterModelId);

    // Se for a aba principal do mestre, podemos reutilizar os 'fields' cacheados do componente pai (ViewPageContent)
    // para evitar reconstruir a árvore toda (útil para byoc e layouts pesados).
    // Também quando o UC do slot é 'personalizado', seus formFields estarão vazios — usar os do pai.
    const needsParentFields = (isMasterTabEditingMasterRecord || ucLogicType === 'personalizado' || ucLogicType === 'mestre_detalhe' || ucLogicType === 'pesquisa_cadastro') && fields && fields.length > 0
    const finalFormFields = needsParentFields ? fields : (ucFormFields.length > 0 ? ucFormFields : fields);

    const isCrudLikeUseCase = ucLogicType === 'mestre_detalhe' || ucLogicType === 'pesquisa_cadastro';
    if (ucLogicType === 'cadastro' || ucLogicType === 'personalizado' || (isCrudLikeUseCase && isFirstSlot) || isMasterTabEditingMasterRecord || slot.render_mode === 'form') {
      return (
        <div key={slot.id} className="h-full relative overflow-y-auto w-full p-4 lg:p-6 bg-white dark:bg-neutral-900 rounded-b-3xl">
          <RecordForm
            key={`master-form-${relationalRefreshTrigger ?? 0}-${refreshTrigger ?? 0}`}
            mode={mode}
            fields={finalFormFields}
            initialData={initialData}
            onSave={onSave}
            onCancel={onClose}
            isLoading={isLoading}
            onEditDetail={onEditDetail}
            onDeleteDetail={onDeleteDetail}
            onAddDetail={onAddDetail}
            refreshTrigger={refreshTrigger}
            projectRelations={projectRelations}
            initialTab={initialTab}
            onTabChange={onTabChange}
            logicType="cadastro"
            masterModelId={ucModelId || masterModelId}
            masterModelName={ucModelName || masterModelName}
            projectId={projectId}
            secretToken={secretToken}
            tunnelChannel={tunnelChannel}
            isTunnelReady={isTunnelReady}
            project={project}
            joins={ucJoins || joins}
            dictionary={ucDictionary || dictionary}
            hiddenDetails={uc.hiddenDetails || []}
            detailsDisplayMode={uc.detailsDisplayMode}
            detailsInlineTypes={uc.detailsInlineTypes}
            detailsInterfaceTypes={uc.detailsInterfaceTypes}
            detailsTabTitles={uc.detailsTabTitles}
            detailsItemTitles={uc.detailsItemTitles}
            masterTabTitle={uc.masterTabTitle}
            hideHeader={isMasterTabEditingMasterRecord}
          />
        </div>
      );
    }

    // ─── Handlers de Ação para as Abas ────────────────────────────────────────
    // Conecta os botões padrão (Visualizar/Editar/Excluir/Novo) ao sistema
    // de modal inline existente no CustomUseCaseRenderer.
    // Sem estes handlers, os botões aparecem mas não fazem nada.

    const effectiveSlotJoins = [ucJoins, slotProps[slot.use_case_slug]?.joins, joins].find((j: any) => Array.isArray(j) && j.length > 0) || []

    // Editar/visualizar um registro da lista pelo MESMO fluxo da aba do mestre (modal de detalhe da página): carrega os
    // detalhes de verdade, grava registro + itens e atualiza a tela. A aparência (abas/títulos) é a do caso de uso do slot.
    const openInDetailModal = (row: any): boolean => {
      if (!onEditDetail || !ucModelName) return false
      onEditDetail({ ...row, model_name: ucModelName }, {
        detailsDisplayMode: uc.detailsDisplayMode,
        detailsTabTitles: uc.detailsTabTitles,
        detailsItemTitles: uc.detailsItemTitles,
        detailsInlineTypes: uc.detailsInlineTypes,
        detailsInterfaceTypes: uc.detailsInterfaceTypes,
        tabsStyleConfig: uc.tabsStyleConfig,
        masterTabTitle: uc.masterTabTitle,
        joins: Array.isArray(uc.joins) && uc.joins.length > 0 ? uc.joins : undefined,
        // Campos do formulário do PRÓPRIO caso de uso do slot (a tabela dele pode nem existir nos campos da página)
        formFields: Array.isArray(uc.formFields) && uc.formFields.length > 0 ? uc.formFields : undefined,
      })
      return true
    }

    const handleSlotEdit = (row: any) => {
      if (openInDetailModal(row)) return
      setInlineModalState({
        isOpen: true,
        mode: 'edit',
        slotId: slot.id,
        slotModelName: ucModelName,
        formFields: ucFormFields,
        rowData: row,
        isSaving: false,
        joins: effectiveSlotJoins,
        useCaseSlug: slot.use_case_slug,
      })
      setInlineRefreshKey(k => k + 1)
    }

    const handleSlotView = (row: any) => {
      if (openInDetailModal(row)) return
      // Reutiliza o modal de edição em modo visualização (read-only via isLoading trick)
      setInlineModalState({
        isOpen: true,
        mode: 'edit',
        slotId: slot.id,
        slotModelName: ucModelName,
        formFields: ucFormFields,
        rowData: row,
        isSaving: false,
        joins: effectiveSlotJoins,
        useCaseSlug: slot.use_case_slug,
      })
    }

    const handleSlotAdd = () => {
      setInlineModalState({
        isOpen: true,
        mode: 'create',
        slotId: slot.id,
        slotModelName: ucModelName,
        formFields: ucFormFields,
        rowData: {},
        isSaving: false,
        joins: effectiveSlotJoins,
        useCaseSlug: slot.use_case_slug,
      })
    }

    const handleSlotDelete = (row: any) => {
      const pkField = ucFormFields.find((f: any) => f.is_primary_key) || { db_column_name: ucPrimaryKeyName }
      const pkName = pkField.db_column_name.split('.').pop() || ucPrimaryKeyName || 'id'
      const pkValue = row?.[pkName] || row?.id || row?.ID

      if (!pkValue) {
        toast('Não foi possível identificar o registro para exclusão.', 'error')
        return
      }

      setDeleteModalState({
        isOpen: true,
        rowData: row,
        slotModelName: ucModelName,
        pkField,
        pkName,
        pkValue,
        isDeleting: false,
        recordName: resolveRecordLabel(row, findModelByTable(project?.models, ucModelName), uc.formHeaderSubtitleField)
      })
    }
    // ──────────────────────────────────────────────────────────────────────────

    return (
      <div key={slot.id} className="h-full relative overflow-y-auto w-full">
        <ViewContainer
          externalRefreshTrigger={inlineRefreshKey + (refreshTrigger || 0)}
          projectId={projectId!}
          modelName={ucModelName}
          displayFields={ucDisplayFields}
          filterFields={isMasterSlot ? ucFilterFields : []}
          formFields={ucFormFields}
          displayType={uc.displayType || 'list'}
          defaultView={uc.defaultView || 'list'}
          logicType={ucLogicType}
          primaryKeyName={ucPrimaryKeyName}

          kanbanGroupField={kGroup}
          kanbanGroupDisplayField={kGroupDisplay}
          kanbanCardFields={kCards}
          timelineConfig={tConfig}
          schedulerConfig={sConfig}
          mapConfig={mConfig}
          ganttConfig={ganttConfig}
          blueprintConfig={blueprintConfig}
          galleryConfig={gConfig}
          galleryClickBehavior={uc.galleryClickBehavior}
          buttonsConfig={uc.buttonsConfig || []}
          customActions={uc.customActions || []}

          onAdd={handleSlotAdd}
          onView={handleSlotView}
          onEdit={handleSlotEdit}
          onDelete={handleSlotDelete}

          externalFilters={externalFilters}
          advancedStaticFilters={advancedStaticFilters.length > 0 ? advancedStaticFilters : undefined}

          locale="pt-BR"
          project={project}
          joins={customJoinsResolved ? [...(ucJoins || []), ...customJoins] : ucJoins}
          dictionary={ucDictionary}
          projectRelations={ucProjectRelations}
          tunnelChannel={tunnelChannel}
          isTunnelReady={isTunnelReady}
          filterGridColumns={uc.filterGridColumns}
          initialItemsPerPage={uc.initialItemsPerPage}
        />
      </div>
    );
  }


  const handleInlineSave = async (formData: any) => {
    if (!inlineModalState) return
    setInlineModalState(prev => prev ? { ...prev, isSaving: true } : null)

    const { mode: saveMode, slotModelName, rowData } = inlineModalState
    const supabase = createClient()
    const queryId = crypto.randomUUID()

    const slotModel = findModelByTable(project?.models, slotModelName)
    // Chave primária: do MODELO (metadado); o campo marcado no formulário só se o modelo não a traz; 'id' como último recurso
    const pkName = getPkColumn(project?.models, slotModelName)
      || (inlineModalState.formFields.find((f: any) => f.is_primary_key)?.db_column_name || '').split('.').pop()
      || 'id'
    const pkValue = getRecordPk(rowData, pkName) ?? rowData?.id ?? rowData?.ID

    // Só colunas REAIS da tabela (metadado). O formulário também carrega duplicatas de caixa (STATUS/status), campos
    // calculados e colunas de JOIN; enviar isso fazia o CLI remover coluna por coluna (até 5 tentativas) e, se nada
    // sobrasse, ignorar o UPDATE respondendo "sucesso" sem gravar.
    const validCols = new Map<string, any>()
    ;(slotModel?.fields || []).forEach((f: any) => {
      const col = (f.db_column_name || '').split('.').pop()
      if (col && !f.is_virtual) validCols.set(col.toLowerCase(), f)
    })

    const SKIP_KEYS = new Set(['_details', 'model_name', 'display_model_name'])
    const sanitized: any = {}
    for (const [k, v] of Object.entries(formData)) {
      const lk = k.toLowerCase()
      if (
        SKIP_KEYS.has(lk) || k.startsWith('_') || k.startsWith('virt_') || k.includes('.') ||
        (saveMode === 'edit' && (lk === pkName.toLowerCase() || lk === 'created_at' || lk === 'updated_at')) ||
        v === undefined || typeof v === 'object'
      ) continue
      const colDef = validCols.get(lk)
      if (validCols.size > 0 && !colDef) continue
      const col = colDef ? ((colDef.db_column_name || '').split('.').pop() as string) : k
      if (saveMode === 'edit') {
        const origRaw = readCol(rowData, col)
        const orig = origRaw === null || origRaw === undefined || origRaw === '' ? null : String(origRaw)
        const cur = v === null || v === '' ? null : String(v)
        if (cur === orig) continue
      }
      let outVal: any = (v === null || v === '') ? null : String(v)
      if (outVal !== null && colDef && isNumericDbType(colDef.db_data_type)) {
        const num = parseNumericLoose(outVal)
        if (num !== null) outVal = num
      }
      sanitized[col] = outVal
    }

    // Ensure FK to parent is set on create
    if (saveMode === 'create' && parentId) {
      const slot = flattenSlots(customSlots).find(s => s.id === inlineModalState.slotId)
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

  const handleConfirmDelete = async () => {
    if (!deleteModalState) return
    setDeleteModalState(prev => prev ? { ...prev, isDeleting: true } : null)

    const { slotModelName, pkName, pkValue } = deleteModalState
    const supabase = createClient()
    const queryId = crypto.randomUUID()
    const slotModel = project?.models?.find((m: any) => m.db_table_name === slotModelName)
    const schemaName = slotModel?.db_schema_name || project?.slug || 'public'
    const rawQuery = `DELETE FROM "${slotModelName}" WHERE "${pkName}" = '${String(pkValue).replace(/'/g, "''")}'`

    const isTemporary = !tunnelChannel || !isTunnelReady
    const channelName = `tunnel:${projectId}`
    const channel = isTemporary ? wrapChannelWithChunking(supabase.channel(channelName)) : tunnelChannel

    try {
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
            action: 'delete',
            sql: rawQuery,
            idColumn: pkName,
            idValue: pkValue,
            token: project?.secret_token || 'test-token',
            schemaName,
            slug: project?.slug
          }
        })
        if (isTemporary) {
          channel.subscribe((status: string) => {
            if (status === 'SUBSCRIBED') doSend()
          })
        } else {
          doSend()
        }
        setTimeout(() => {
          if (!settled) { cleanup(); resolve({ success: false, error: 'Timeout' }) }
        }, 15000)
      })

      if (result.success) {
        toast('Registro excluído com sucesso!', 'success')
        setInlineRefreshKey(k => k + 1)
        setDeleteModalState(null)
      } else {
        toast(`Erro ao excluir: ${result.error || 'Erro desconhecido'}`, 'error')
        setDeleteModalState(prev => prev ? { ...prev, isDeleting: false } : null)
      }
    } catch (e: any) {
      toast(`Erro: ${e.message}`, 'error')
      setDeleteModalState(prev => prev ? { ...prev, isDeleting: false } : null)
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
  const openedSlot = openSlotConfig ? flattenSlots(customSlots).find(s => s.id === openSlotConfig.id) : null;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#050505]">
      {/* Custom Tabs Header */}
      <div className="px-6 pt-2">
        <div className="flex border-b border-neutral-100 dark:border-neutral-800">
          {visibleSlots.map((slot: any, idx: number) => {
            const sId = getSlotId(slot, idx);
            return (
              <button
                key={sId}
                onClick={() => {
                  console.log(`[MetaBuilder:CustomSlot] Aba clicada! Alterando activeTabId de ${activeTabId} para ${sId}`);
                  setActiveTabId(sId);
                }}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap",
                  activeTabId === sId
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                )}
              >
                {slot.icon ? <DynamicIcon icon={slot.icon} className="w-4 h-4 mr-2" /> : getSlotIcon(slot.type)}
                {slot.title}
              </button>
            )
          })}
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
            className="fixed inset-0 z-[190] flex items-center justify-center bg-neutral-900/60 backdrop-blur-sm"
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
                  {slotProps[inlineModalState.useCaseSlug || '']?.formHeaderTitle?.trim() || (inlineModalState.mode === 'create' ? 'Novo Registro' : 'Editar Registro')}
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
                  joins={[inlineModalState.joins, slotProps[inlineModalState.useCaseSlug || '']?.joins, joins].find((j: any) => Array.isArray(j) && j.length > 0) || []}
                  projectRelations={projectRelations}
                  dictionary={slotProps[inlineModalState.useCaseSlug || '']?.dictionary || dictionary}
                  detailsDisplayMode={slotProps[inlineModalState.useCaseSlug || '']?.detailsDisplayMode}
                  detailsInlineTypes={slotProps[inlineModalState.useCaseSlug || '']?.detailsInlineTypes}
                  detailsInterfaceTypes={slotProps[inlineModalState.useCaseSlug || '']?.detailsInterfaceTypes}
                  detailsTabTitles={slotProps[inlineModalState.useCaseSlug || '']?.detailsTabTitles}
                  detailsItemTitles={slotProps[inlineModalState.useCaseSlug || '']?.detailsItemTitles}
                  masterTabTitle={slotProps[inlineModalState.useCaseSlug || '']?.masterTabTitle}
                  hiddenDetails={inlineModalState.mode === 'create'
                    ? (([inlineModalState.joins, slotProps[inlineModalState.useCaseSlug || '']?.joins, joins].find((j: any) => Array.isArray(j) && j.length > 0) || []) as any[])
                        .filter((j: any) => String(j.from ?? j.table ?? '').toLowerCase() === String(inlineModalState.slotModelName || '').toLowerCase())
                        .map((j: any) => j.to ?? j.toTable)
                        .filter(Boolean)
                    : (slotProps[inlineModalState.useCaseSlug || '']?.hiddenDetails || [])}
                  tabsStyleConfig={slotProps[inlineModalState.useCaseSlug || '']?.tabsStyleConfig}
                  onEditDetail={onEditDetail}
                  onDeleteDetail={onDeleteDetail}
                  onAddDetail={onAddDetail}
                  hideHeader={true}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <DeleteConfirmModal 
        isOpen={!!deleteModalState?.isOpen} 
        onClose={() => setDeleteModalState(null)} 
        onConfirm={handleConfirmDelete}
        isLoading={deleteModalState?.isDeleting}
        recordName={deleteModalState?.recordName}
      />
    </div>
  )
}
