'use client'

import React, { useState } from 'react'
import { Layout, Table, CheckSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import RecordForm from './RecordForm'
import dynamic from 'next/dynamic'
import { createClient } from '@/utils/supabase/client'

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
  onEditDetail?: (detail: any) => void
  onDeleteDetail?: (detail: any) => void
  onAddDetail?: (tableName: string, parentId?: any) => void
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
  onEditDetail,
  onDeleteDetail,
  onAddDetail
}: CustomUseCaseRendererProps) {
  const [activeTabId, setActiveTabId] = useState<string>(customSlots[0]?.id || '')

  if (!customSlots || customSlots.length === 0) {
    return (
      <div className="p-8 text-center text-neutral-500">
        Nenhuma aba configurada para este Layout Personalizado.
      </div>
    )
  }

  const activeSlot = customSlots.find(s => s.id === activeTabId) || customSlots[0]
  const isMasterSlot = activeSlot.id === customSlots[0].id
  
  // The first slot is considered the Master. Other slots are Details.
  // For details, we need to pass the parent ID to filter the grid/kanban.
  const parentId = initialData?.id

  const getSlotIcon = (type: string) => {
    switch (type) {
      case 'form': return <Layout className="w-4 h-4" />
      case 'grid': return <Table className="w-4 h-4" />
      case 'kanban': return <CheckSquare className="w-4 h-4" />
      default: return <Layout className="w-4 h-4" />
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
        <div className="p-6">
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
          />
        </div>
      )
    }

    if (slot.type === 'grid' || slot.type === 'kanban') {
      const useMasterId = slot.use_master_id !== false;
      const hasStaticFilters = slot.static_filters && slot.static_filters.some((f: any) => f.field && f.value);
      const slotModel = project?.models?.find((m: any) => m.id === slot.model_id || m.db_table_name === slotModelName);
      
      // Busca a configuração da view original de Kanban (ou pesquisa) para herdar os filtros e campos do card desenhados pelo usuário
      const modelViews = project?.views?.filter((v: any) => String(v.model_id) === String(slot.model_id)) || [];
      const referenceView = modelViews.find((v: any) => v.logic_type === 'kanban') || modelViews.find((v: any) => v.logic_type === 'pesquisa');
      
      const slotDisplayFields = referenceView?.display_fields?.length > 0 ? referenceView.display_fields : (slotModel?.fields || []);
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
                f = relModel.fields?.find((f: any) => f.db_column_name === fieldName);
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
      
      const slotFormFields = referenceView?.form_fields || [];

      if (useMasterId && (mode === 'create' || !parentId)) {
        return (
          <div className="p-8 text-center text-neutral-500 bg-neutral-50 dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 m-6">
            Salve o registro principal primeiro para visualizar os dados relacionados.
          </div>
        )
      }

      // Descobre a chave estrangeira (join) entre o mestre e este modelo de detalhe
      const join = (joins || []).find(j => 
        (j.from?.toLowerCase() === masterModelName?.toLowerCase() && j.to?.toLowerCase() === slotModelName?.toLowerCase()) ||
        (j.to?.toLowerCase() === masterModelName?.toLowerCase() && j.from?.toLowerCase() === slotModelName?.toLowerCase())
      )

      const foreignKey = join ? (join.from?.toLowerCase() === slotModelName?.toLowerCase() ? join.from_column : join.to_column) : undefined;

      // Monta os filtros externos básicos (para relacionamentos simples)
      let externalFilters: Record<string, any> = {};
      if (useMasterId && foreignKey && parentId) {
        externalFilters[foreignKey] = parentId;
      }
      
      let advancedStaticFilters: any[] = [];
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

      // Se for GRID, usar Master Id, e não tiver filtros customizados, usamos o RecordForm 
      // para preservar a interface de "Cortina" nativa do Mestre Detalhe.
      if (slot.type === 'grid' && useMasterId && !hasStaticFilters) {
        return (
          <div className="p-6 h-[calc(100vh-150px)] overflow-y-auto custom-scrollbar">
            <RecordForm
              mode={mode}
              fields={fields}
              initialData={initialData}
              onSave={onSave}
              onCancel={onClose}
              isLoading={isLoading}
              logicType="master_detail"
              masterModelId={masterModelId}
              masterModelName={masterModelName}
              renderOnlyDetail={slotModelName}
              detailsInterfaceTypes={detailsInterfaceTypes}
              detailsInlineTypes={detailsInlineTypes}
              onEditDetail={onEditDetail}
              onDeleteDetail={onDeleteDetail}
              onAddDetail={onAddDetail}
              joins={joins}
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

      // Para KANBAN ou quando as regras exigirem, usamos o poderoso ViewContainer
      return (
        <div className="p-6 h-[calc(100vh-150px)] overflow-y-auto custom-scrollbar relative">
          <ViewContainer
            externalRefreshTrigger={refreshTrigger}
            projectId={projectId!}
            modelName={slotModelName!}
            displayFields={slotDisplayFields}
            filterFields={slotFilterFields}
            formFields={slotFormFields}
            displayType="list"
            logicType={slot.type === 'kanban' ? 'kanban' : 'pesquisa'}
            kanbanGroupField={slot.kanban_group_field}
            kanbanGroupDisplayField={slot.kanban_group_display_field}
            kanbanCardFields={slot.kanban_card_fields}
            externalFilters={externalFilters}
            advancedStaticFilters={advancedStaticFilters}
            buttonsConfig={referenceView?.buttons_config || []}
            locale="pt-BR"
            tunnelChannel={tunnelChannel}
            isTunnelReady={isTunnelReady}
            dictionary={dictionary}
            project={project}
            joins={joins}
            customActions={customActions}
            onCustomAction={onCustomAction}
          />
        </div>
      )
    }

    return null
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#050505]">
      {/* Custom Tabs Header */}
      <div className="px-6 pt-2">
        <div className="flex border-b border-neutral-100 dark:border-neutral-800">
          {customSlots.map((slot) => (
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
              {getSlotIcon(slot.type)}
              {slot.title}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {renderSlotContent(activeSlot)}
      </div>
    </div>
  )
}
