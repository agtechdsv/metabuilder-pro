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
  const [injectedUseCases, setInjectedUseCases] = useState<Record<string, any>>({})
  
  React.useEffect(() => {
    async function fetchUseCases() {
      if (!customSlots || !projectId) return;
      const slugsToFetch = customSlots.map((s:any) => s.use_case_slug).filter(Boolean);
      if (slugsToFetch.length === 0) return;
      
      const supabase = createClient()
      const { data, error } = await supabase
        .from('ui_views')
        .select('*')
        .eq('project_id', projectId)
        .in('slug', slugsToFetch);
        
      if (data && !error) {
        const mapping: Record<string, any> = {};
        data.forEach((uc: any) => {
          mapping[uc.slug] = uc;
        });
        setInjectedUseCases(mapping);
      }
    }
    fetchUseCases();
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
    const uc = injectedUseCases[slot.use_case_slug];
    if (!uc) {
      return (
        <div className="p-8 text-center text-neutral-500 flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-4"></div>
          Carregando Caso de Uso Injetado...
        </div>
      );
    }

    const useMasterId = slot.use_master_id !== false;
    const hasStaticFilters = slot.static_filters && slot.static_filters.some((f: any) => f.field && f.value);
    
    // Configurações do Caso de Uso
    const isPreview = typeof window !== 'undefined' && window.location.search.includes('preview=draft');
    const sourceConfig = (isPreview && uc.draft_config) ? uc.draft_config : uc;
    
    const ucConfig = sourceConfig.config || {};
    const ucLayout = sourceConfig.layout_config || {};
    const ucDisplayFields = sourceConfig.display_fields || [];
    const ucFormFields = sourceConfig.form_fields || [];
    const ucFilterFields = sourceConfig.filter_fields || [];

    // Se a aba exige vínculo com o Mestre e não temos o ID do mestre (ainda não foi salvo)
    if (useMasterId && (mode === 'create' || !parentId)) {
      return (
        <div key={slot.id} className="p-8 text-center text-neutral-500 bg-neutral-50 dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 m-6">
          Salve o registro principal primeiro para visualizar os dados relacionados.
        </div>
      )
    }

    let externalFilters: Record<string, any> = {};
    let advancedStaticFilters: any[] = [];

    // Lógica de Vínculo com o Mestre
    if (useMasterId && parentId) {
      // Tenta encontrar a relação direta entre uc.model_id e masterModelId
      const targetModelName = project?.models?.find((m: any) => m.id === uc.model_id)?.db_table_name;
      const mModelName = masterModelName || project?.models?.find((m: any) => m.id === masterModelId)?.db_table_name;
      
      let foreignKey = '';
      if (joins) {
        const directJoin = joins.find((j: any) => 
          (j.from === targetModelName && j.to === mModelName) || 
          (j.from === mModelName && j.to === targetModelName)
        );
        if (directJoin) {
          foreignKey = directJoin.from === targetModelName ? directJoin.localKey : directJoin.foreignKey;
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
            foreignKey = relField.db_column_name;
          } else {
            // Fallback heurístico pelo nome da coluna se não houver config rel_table explícita
            const singularName = mModelName.toLowerCase().endsWith('s') ? mModelName.toLowerCase().slice(0, -1) : mModelName.toLowerCase();
            const guessField = targetModel.fields.find((f: any) => {
              const col = (f.db_column_name || '').toLowerCase();
              return col.endsWith('_id') && col.includes(singularName);
            });
            if (guessField) {
              foreignKey = guessField.db_column_name;
            }
          }
        }
      }

      if (foreignKey) {
        externalFilters[foreignKey] = parentId;
      } else {
        // Fallback genérico de filtro estático
        advancedStaticFilters.push({
          field: `${mModelName}.id`,
          operator: '=',
          value: parentId,
          logic: 'AND'
        });
      }
    }

    if (hasStaticFilters) {
      slot.static_filters.forEach((filter: any) => {
        advancedStaticFilters.push({
          field: filter.field,
          operator: filter.operator || '=',
          value: filter.value,
          logic: 'AND'
        });
      });
    }

    return (
      <div key={slot.id} className="h-full relative overflow-y-auto w-full">
        <ViewContainer
          externalRefreshTrigger={refreshTrigger}
          projectId={projectId!}
          modelName={project?.models?.find((m: any) => m.id === uc.model_id)?.db_table_name || ''}
          displayFields={ucDisplayFields}
          filterFields={ucFilterFields}
          formFields={ucFormFields}
          displayType="list"
          logicType={uc.logic_type || 'grid'}
          
          kanbanGroupField={ucLayout.kanbanGroupField || ucConfig.kanbanGroupField || ucLayout.kanban_group_field}
          kanbanGroupDisplayField={ucLayout.kanbanGroupDisplayField || ucConfig.kanbanGroupDisplayField || ucLayout.kanban_group_display_field}
          kanbanCardFields={ucLayout.kanbanCardFields || ucConfig.kanbanCardFields || ucLayout.kanban_card_fields}
          timelineConfig={ucLayout.timelineConfig || ucConfig.timelineConfig || ucLayout.timeline_config}
          schedulerConfig={ucLayout.schedulerConfig || ucConfig.schedulerConfig || ucLayout.scheduler_config}
          mapConfig={ucLayout.mapConfig || ucConfig.mapConfig || ucLayout.map_config}
          ganttConfig={ucLayout.ganttConfig || ucConfig.ganttConfig || ucLayout.gantt_config}
          blueprintConfig={ucLayout.blueprintConfig || ucConfig.blueprintConfig || ucLayout.blueprint_config}
          buttonsConfig={ucLayout.buttonsConfig || ucConfig.buttonsConfig || ucLayout.buttons_config || []}
          
          externalFilters={externalFilters}
          advancedStaticFilters={advancedStaticFilters.length > 0 ? advancedStaticFilters : undefined}
          
          locale="pt-BR"
          project={project}
          joins={ucLayout.joins || joins}
          dictionary={dictionary}
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
