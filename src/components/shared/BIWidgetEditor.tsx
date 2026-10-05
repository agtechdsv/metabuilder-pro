'use client'

import React, { useState } from 'react'
import { JoinsEditor } from '@/components/studio/JoinsEditor'
import { cn } from '@/lib/utils'
import FormulaBuilder from '@/components/studio/FormulaBuilder'
import { Modal } from '@/components/ui/Modal'
import { BI_FORMAT_OPTIONS, BI_PALETTES } from '@/lib/bi/format'
import { biFieldKind } from '@/lib/bi/columnKind'
import { PERIOD_PRESETS } from '@/lib/bi/period'

interface BIWidgetEditorProps {
  editingWidget: any
  setEditingWidget: (widget: any) => void
  models: any[]
  joins: any[]
  t: (key: string) => string
  /** grupos do painel (criados e organizados no Studio); o widget escolhe um deles */
  groups?: { id: string; title: string }[]
}

const OPS_BY_KIND: Record<string, { value: string; label: string }[]> = {
  text: [
    { value: 'eq', label: 'é igual a' }, { value: 'ne', label: 'é diferente de' }, { value: 'contains', label: 'contém' },
    { value: 'starts', label: 'começa com' }, { value: 'ends', label: 'termina com' }, { value: 'in', label: 'está em (a, b, c)' },
    { value: 'is_null', label: 'está vazio' }, { value: 'not_null', label: 'não está vazio' },
  ],
  number: [
    { value: 'eq', label: '=' }, { value: 'ne', label: '≠' }, { value: 'gt', label: '>' }, { value: 'gte', label: '≥' },
    { value: 'lt', label: '<' }, { value: 'lte', label: '≤' }, { value: 'between', label: 'entre' }, { value: 'in', label: 'está em (1, 2, 3)' },
    { value: 'is_null', label: 'está vazio' }, { value: 'not_null', label: 'não está vazio' },
  ],
  date: [
    { value: 'eq', label: 'é no dia' }, { value: 'gte', label: 'a partir de' }, { value: 'lte', label: 'até' }, { value: 'gt', label: 'depois de' },
    { value: 'lt', label: 'antes de' }, { value: 'between', label: 'entre' }, { value: 'is_null', label: 'está vazio' }, { value: 'not_null', label: 'não está vazio' },
  ],
}

const selectCls = 'w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-2 text-[10px] font-bold text-neutral-900 dark:text-white'
const labelCls = 'text-[8px] font-black uppercase tracking-widest text-neutral-400 ml-1'

export function BIWidgetEditor({ editingWidget, setEditingWidget, models, joins, t, groups = [] }: BIWidgetEditorProps) {
  const [isFormulaModalOpen, setIsFormulaModalOpen] = useState(false)
  const currentModel = models.find((m: any) => String(m.id) === String(editingWidget?.model_id))

  // "coluna" (tabela principal) ou "tabela.coluna" → tipo da coluna (texto, número ou data)
  const kindOf = (path: string): 'text' | 'number' | 'date' => {
    if (!path) return 'text'
    const [tbl, col] = path.split('.')
    const m = models.find((x: any) => x.db_table_name === tbl)
    const f = (m?.fields || []).find((x: any) => String(x.db_column_name).toLowerCase() === String(col).toLowerCase())
    return biFieldKind(f)
  }

  // lista de campos agrupada por tabela (principal primeiro); o valor é "coluna" na principal e "tabela.coluna" nas demais
  const fieldOptions = (
    <>
      <optgroup label={`Tabela: ${currentModel?.display_name || currentModel?.db_table_name || 'Principal'}`}>
        {currentModel?.fields?.map((f: any) => (
          <option key={f.id} value={`${currentModel.db_table_name}.${f.db_column_name}`}>{f.display_name || f.db_column_name}</option>
        ))}
      </optgroup>
      {models.filter((m: any) => m.id !== currentModel?.id).map((relModel: any, idx: number) => (
        <optgroup key={`opt-${idx}`} label={`Tabela: ${relModel.display_name || relModel.db_table_name}`}>
          {relModel.fields?.map((f: any) => (
            <option key={f.id} value={`${relModel.db_table_name}.${f.db_column_name}`}>{f.display_name || f.db_column_name}</option>
          ))}
        </optgroup>
      ))}
    </>
  )

  // valores válidos = "TABELA.COLUNA" de todas as tabelas; qualquer outro valor guardado (widget antigo) aparece como inválido
  const validFieldValues = new Set<string>(models.flatMap((m: any) => (m.fields || []).map((f: any) => `${m.db_table_name}.${f.db_column_name}`)))
  const staleOption = (v?: string) =>
    v && !validFieldValues.has(v) ? <option value={v}>⚠ {v} (sem tabela, selecione novamente)</option> : null

  const conditions: any[] = editingWidget?.conditions || []
  const setConditions = (next: any[]) => setEditingWidget({ ...editingWidget, conditions: next })
  const patchCondition = (i: number, patch: any) => setConditions(conditions.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))
  const canSeries = !!editingWidget?.group_by && ['bar', 'line', 'area'].includes(editingWidget?.type)

  return (
    <div className="space-y-4">
      {/* Título */}
      <div className="space-y-2">
        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-1">
          {t('wizard.layout.widget_title')}
        </label>
        <input 
          type="text" 
          value={editingWidget?.title || ''} 
          onChange={e => setEditingWidget({...editingWidget, title: e.target.value})}
          className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2 focus:border-indigo-600 outline-none transition-all text-xs font-bold text-neutral-900 dark:text-white"
          placeholder="Ex: Total de Vendas"
        />
      </div>

      {/* Agrupamento: os grupos são criados e organizados no Studio (Painel de Indicadores) */}
      {groups.length > 0 && (
        <div className="space-y-2">
          <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-1">Grupo</label>
          <select
            value={groups.some(g => g.id === editingWidget?.group_id) ? editingWidget?.group_id : ''}
            onChange={e => setEditingWidget({...editingWidget, group_id: e.target.value || undefined})}
            className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2 focus:border-indigo-600 outline-none transition-all text-xs font-bold text-neutral-900 dark:text-white"
          >
            <option value="">(Sem grupo)</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.title || 'Grupo sem nome'}</option>)}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-1">Tipo de Gráfico</label>
          <select 
            value={editingWidget?.type || ''} 
            onChange={e => setEditingWidget({...editingWidget, type: e.target.value})}
            className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2 focus:border-indigo-600 outline-none transition-all text-xs font-bold text-neutral-900 dark:text-white"
          >
            <option value="kpi">Métrica (KPI)</option>
            <option value="gauge">Medidor (Gauge)</option>
            <option value="bar">Barras</option>
            <option value="pie">Pizza</option>
            <option value="line">Linhas</option>
            <option value="area">Área</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-1">Tabela Fonte</label>
          <select 
            value={editingWidget?.model_id || ''} 
            onChange={e => setEditingWidget({...editingWidget, model_id: e.target.value, field: '', use_formula: false, formula_tokens: [], group_by: '', series_by: undefined, divide_by: undefined, conditions: [], period_field: undefined})}
            className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2 focus:border-indigo-600 outline-none transition-all text-xs font-bold text-neutral-900 dark:text-white"
          >
            <option value="">Selecione...</option>
            {models.map((m: any) => (
              <option key={m.id} value={m.id}>{m.display_name || m.db_table_name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-1">Cálculo / Operação</label>
          <select 
            value={editingWidget?.calc || 'COUNT'} 
            onChange={e => setEditingWidget({...editingWidget, calc: e.target.value})}
            className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2 focus:border-indigo-600 outline-none transition-all text-xs font-bold text-neutral-900 dark:text-white"
          >
            <option value="COUNT">Contagem (COUNT)</option>
            <option value="COUNT_DISTINCT">Contagem distinta</option>
            <option value="SUM">Soma (SUM)</option>
            <option value="AVG">Média (AVG)</option>
            <option value="MIN">Mínimo (MIN)</option>
            <option value="MAX">Máximo (MAX)</option>
          </select>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between ml-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Campo do Valor</label>
            <button 
              onClick={() => setIsFormulaModalOpen(true)}
              className={cn(
                "text-[8px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full border transition-all",
                editingWidget?.use_formula 
                  ? "bg-indigo-600 border-indigo-600 text-white" 
                  : "bg-neutral-100 border-neutral-200 text-neutral-400 hover:bg-neutral-200"
              )}
            >
              Fórmula
            </button>
          </div>
          
          {editingWidget?.use_formula ? (
            <div className="w-full bg-neutral-50 dark:bg-neutral-900 border-2 border-indigo-100 dark:border-indigo-800 rounded-xl px-4 py-2 text-xs font-bold text-indigo-600 truncate">
              {editingWidget?.field || '(Fórmula vazia)'}
            </div>
          ) : (
            <select 
              value={editingWidget?.field || ''} 
              onChange={e => setEditingWidget({...editingWidget, field: e.target.value})}
              className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2 focus:border-indigo-600 outline-none transition-all text-xs font-bold text-neutral-900 dark:text-white"
            >
              <option value="">(Toda a Tabela)</option>
              {staleOption(editingWidget?.field)}
              {fieldOptions}
            </select>
          )}
        </div>
      </div>

      {/* Relacionamentos foram removidos */}

      {/* Gauge Config */}
      {editingWidget?.type === 'gauge' && (
        <div className="space-y-3 p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-xl animate-in zoom-in-95">
           {/* Row 1: Physical Scale */}
           <div className="grid grid-cols-2 gap-3">
             <div className="space-y-1.5">
               <label className="text-[8px] font-black uppercase tracking-widest text-indigo-500 ml-1">Início da Escala</label>
               <input 
                 type="number" 
                 value={editingWidget?.gauge_start ?? 0} 
                 onChange={e => setEditingWidget({...editingWidget, gauge_start: Number(e.target.value)})}
                 className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1.5 text-[10px] font-bold text-neutral-900 dark:text-white"
               />
             </div>
             <div className="space-y-1.5">
               <label className="text-[8px] font-black uppercase tracking-widest text-indigo-500 ml-1">Fim da Escala</label>
               <input 
                 type="number" 
                 value={editingWidget?.gauge_end ?? 100} 
                 onChange={e => setEditingWidget({...editingWidget, gauge_end: Number(e.target.value)})}
                 className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1.5 text-[10px] font-bold text-neutral-900 dark:text-white"
               />
             </div>
           </div>
           
           {/* Row 2: Business Thresholds */}
           <div className="grid grid-cols-2 gap-3 pt-2 border-t border-indigo-100/50 dark:border-indigo-900/30">
             <div className="space-y-1.5">
               <label className="text-[8px] font-black uppercase tracking-widest text-neutral-400 ml-1">Mínimo (Alerta)</label>
               <input 
                 type="number" 
                 value={editingWidget?.gauge_min ?? 0} 
                 onChange={e => setEditingWidget({...editingWidget, gauge_min: Number(e.target.value)})}
                 className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1.5 text-[10px] font-bold text-neutral-900 dark:text-white"
               />
             </div>
             <div className="space-y-1.5">
               <label className="text-[8px] font-black uppercase tracking-widest text-neutral-400 ml-1">Meta (Verde)</label>
               <input 
                 type="number" 
                 value={editingWidget?.gauge_target ?? 70} 
                 onChange={e => setEditingWidget({...editingWidget, gauge_target: Number(e.target.value)})}
                 className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1.5 text-[10px] font-bold text-neutral-900 dark:text-white"
               />
             </div>
           </div>
        </div>
      )}

      {/* Group By - Now available for KPIs too */}
      <div className="space-y-2 animate-in fade-in slide-in-from-top-2 pt-4 border-t border-neutral-100 dark:border-neutral-800">
         <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-1">Agrupar por (Dimensão)</label>
         <select 
           value={editingWidget?.group_by || ''} 
           onChange={e => setEditingWidget({...editingWidget, group_by: e.target.value})}
           className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-2.5 focus:border-indigo-600 outline-none transition-all text-sm font-bold text-neutral-900 dark:text-white"
         >
           <option value="">(Nenhum - Valor Único)</option>
           {staleOption(editingWidget?.group_by)}
           {fieldOptions}
          </select>
          
          {editingWidget?.group_by && (
            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-indigo-100/30 dark:border-indigo-900/10">
               <div className="space-y-1.5">
                 <label className="text-[8px] font-black uppercase tracking-widest text-neutral-400 ml-1">Granularidade (Data)</label>
                 <select 
                   value={editingWidget?.date_granularity || ''} 
                   onChange={e => setEditingWidget({...editingWidget, date_granularity: e.target.value})}
                   className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-2 text-[10px] font-bold text-neutral-900 dark:text-white"
                 >
                   <option value="">Exato (Padrão)</option>
                   <option value="day">Dia (YYYY-MM-DD)</option>
                   <option value="month">Mês (YYYY-MM)</option>
                   <option value="year">Ano (YYYY)</option>
                   <option value="week">Semana (YYYY-Sww)</option>
                   <option value="quarter">Trimestre (YYYY-Tn)</option>
                 </select>
               </div>
               
               <div className="space-y-1.5">
                 <label className="text-[8px] font-black uppercase tracking-widest text-neutral-400 ml-1">Ordenar Por</label>
                 <select 
                   value={editingWidget?.sort_by || 'value_desc'} 
                   onChange={e => setEditingWidget({...editingWidget, sort_by: e.target.value})}
                   className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-2 text-[10px] font-bold text-neutral-900 dark:text-white"
                 >
                   <option value="value_desc">Maior Valor (Top)</option>
                   <option value="value_asc">Menor Valor</option>
                   <option value="label_asc">Rótulo / Data (A-Z)</option>
                   <option value="label_desc">Rótulo / Data (Z-A)</option>
                 </select>
               </div>
  
               <div className="space-y-1.5">
                 <label className="text-[8px] font-black uppercase tracking-widest text-neutral-400 ml-1">Limite (Top N)</label>
                 <input 
                   type="number"
                   min="1"
                   placeholder="Todos"
                   value={editingWidget?.limit_top_n || ''} 
                   onChange={e => setEditingWidget({...editingWidget, limit_top_n: e.target.value ? Number(e.target.value) : undefined})}
                   className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1.5 text-[10px] font-bold text-neutral-900 dark:text-white placeholder:text-neutral-400"
                 />
               </div>
            </div>
          )}
        </div>

         {/* Segunda dimensão (série) */}
         {canSeries && (
           <div className="space-y-2 pt-4 border-t border-neutral-100 dark:border-neutral-800">
             <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-1">Segmentar por (2ª dimensão)</label>
             <select value={editingWidget?.series_by || ''} onChange={e => setEditingWidget({...editingWidget, series_by: e.target.value || undefined})} className={selectCls}>
               <option value="">(Sem segmentação)</option>
               {staleOption(editingWidget?.series_by)}
               {fieldOptions}
             </select>
             {editingWidget?.series_by && (
               <button
                 type="button"
                 onClick={() => setEditingWidget({...editingWidget, stacked: !editingWidget?.stacked})}
                 className={cn("px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all", editingWidget?.stacked ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-neutral-50 dark:bg-neutral-900 text-neutral-400 border-neutral-200 dark:border-neutral-800')}
               >
                 Empilhar séries
               </button>
             )}
           </div>
         )}

         {/* Métrica derivada */}
         <div className="space-y-2 pt-4 border-t border-neutral-100 dark:border-neutral-800">
           <div className="flex items-center justify-between ml-1">
             <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Métrica derivada (dividir por)</label>
             <button
               type="button"
               onClick={() => setEditingWidget({...editingWidget, divide_by: editingWidget?.divide_by ? undefined : { calc: 'COUNT', field: '' }})}
               className={cn("text-[8px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full border transition-all", editingWidget?.divide_by ? "bg-indigo-600 border-indigo-600 text-white" : "bg-neutral-100 border-neutral-200 text-neutral-400 hover:bg-neutral-200")}
             >
               {editingWidget?.divide_by ? 'Ativa' : 'Desativada'}
             </button>
           </div>
           {editingWidget?.divide_by ? (
             <>
               <div className="grid grid-cols-2 gap-3">
                 <div className="space-y-1.5">
                   <label className={labelCls}>Operação do divisor</label>
                   <select value={editingWidget.divide_by.calc} onChange={e => setEditingWidget({...editingWidget, divide_by: { ...editingWidget.divide_by, calc: e.target.value }})} className={selectCls}>
                     <option value="COUNT">Contagem</option>
                     <option value="COUNT_DISTINCT">Contagem distinta</option>
                     <option value="SUM">Soma</option>
                     <option value="AVG">Média</option>
                     <option value="MIN">Mínimo</option>
                     <option value="MAX">Máximo</option>
                   </select>
                 </div>
                 <div className="space-y-1.5">
                   <label className={labelCls}>Campo do divisor</label>
                   <select value={editingWidget.divide_by.field || ''} onChange={e => setEditingWidget({...editingWidget, divide_by: { ...editingWidget.divide_by, field: e.target.value }})} className={selectCls}>
                     <option value="">(Registros da tabela)</option>
                     {staleOption(editingWidget.divide_by.field)}
                     {fieldOptions}
                   </select>
                 </div>
               </div>
               <p className="text-[9px] font-bold text-neutral-400 ml-1">
                 Ex.: Ticket médio = Soma de valor_total ÷ Contagem de registros. Use o formato Moeda na aparência.
               </p>
             </>
           ) : null}
         </div>

         {/* Filtros do widget */}
         <div className="space-y-2 pt-4 border-t border-neutral-100 dark:border-neutral-800">
           <div className="flex items-center justify-between ml-1">
             <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Filtros do widget</label>
             <button
               type="button"
               onClick={() => setConditions([...conditions, { field: '', op: 'eq', value: '' }])}
               className="text-[8px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full border bg-neutral-100 border-neutral-200 text-neutral-500 hover:bg-neutral-200 transition-all"
             >
               + Filtro
             </button>
           </div>
           {conditions.length === 0 && <p className="text-[9px] font-bold text-neutral-400 ml-1">Sem filtros: o widget considera todos os registros.</p>}
           {conditions.map((c, i) => {
             const kind = kindOf(c.field)
             const ops = OPS_BY_KIND[kind]
             const noValue = c.op === 'is_null' || c.op === 'not_null'
             const inputType = kind === 'date' ? 'date' : kind === 'number' && c.op !== 'in' ? 'number' : 'text'
             return (
               <div key={i} className="space-y-2 p-2 bg-neutral-50/60 dark:bg-neutral-900/60 border border-neutral-100 dark:border-neutral-800 rounded-xl">
                 <div className="grid grid-cols-2 gap-2">
                   <div className="space-y-1 min-w-0">
                     <label className={labelCls}>Campo</label>
                     <select value={c.field} onChange={e => patchCondition(i, { field: e.target.value, op: 'eq', value: '', value2: '' })} className={selectCls}>
                       <option value="">Selecione...</option>
                       {staleOption(c.field)}
                       {fieldOptions}
                     </select>
                   </div>
                   <div className="space-y-1 min-w-0">
                     <label className={labelCls}>Operador</label>
                     <select value={c.op} onChange={e => patchCondition(i, { op: e.target.value })} className={selectCls}>
                       {ops.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                     </select>
                   </div>
                 </div>
                 <div className="flex items-end gap-2">
                   <div className="space-y-1 flex-1 min-w-0">
                     <label className={labelCls}>{c.op === 'between' ? 'Valor inicial e final' : 'Valor'}</label>
                     {noValue ? (
                       <div className="px-2 py-2 text-[10px] font-bold text-neutral-300">—</div>
                     ) : (
                       <div className="flex gap-2">
                         <input type={inputType} value={c.value ?? ''} onChange={e => patchCondition(i, { value: e.target.value })} className={cn(selectCls, 'min-w-0 flex-1')} />
                         {c.op === 'between' && <input type={inputType} value={c.value2 ?? ''} onChange={e => patchCondition(i, { value2: e.target.value })} className={cn(selectCls, 'min-w-0 flex-1')} />}
                       </div>
                     )}
                   </div>
                   <button type="button" onClick={() => setConditions(conditions.filter((_, idx) => idx !== i))} className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-[12px] font-black text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all" title="Remover filtro">✕</button>
                 </div>
               </div>
             )
           })}
         </div>

         {/* Período */}
         <div className="space-y-2 pt-4 border-t border-neutral-100 dark:border-neutral-800">
           <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-1">Campo de data do período</label>
           <select value={editingWidget?.period_field || ''} onChange={e => setEditingWidget({...editingWidget, period_field: e.target.value || undefined})} className={selectCls}>
             <option value="">(Não usa o filtro de período)</option>
             {staleOption(editingWidget?.period_field)}
             {fieldOptions}
           </select>
           {editingWidget?.period_field && (
             <>
               <label className={labelCls}>De onde vem o período deste widget</label>
               <div className="flex p-1 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl">
                 {[
                   { id: 'panel', label: 'Segue o painel' },
                   { id: 'fixed', label: 'Período fixo' },
                   { id: 'own', label: 'Seletor no card' },
                 ].map(opt => (
                   <button
                     key={opt.id}
                     type="button"
                     onClick={() => setEditingWidget({...editingWidget, period_mode: opt.id, period_fixed: opt.id === 'fixed' ? (editingWidget?.period_fixed || 'month') : editingWidget?.period_fixed})}
                     className={cn("flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all", (editingWidget?.period_mode || 'panel') === opt.id ? 'bg-indigo-600 text-white shadow' : 'text-neutral-400 hover:text-neutral-600')}
                   >
                     {opt.label}
                   </button>
                 ))}
               </div>
               {editingWidget?.period_mode === 'fixed' && (
                 <select value={editingWidget?.period_fixed || 'month'} onChange={e => setEditingWidget({...editingWidget, period_fixed: e.target.value})} className={selectCls}>
                   {PERIOD_PRESETS.filter(o => o.id !== 'all').map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                 </select>
               )}
             </>
           )}
           {editingWidget?.period_field && editingWidget?.type === 'kpi' && !editingWidget?.group_by && (
             <div className="flex flex-wrap gap-2 pt-1">
               <button
                 type="button"
                 onClick={() => setEditingWidget({...editingWidget, compare_previous: !editingWidget?.compare_previous})}
                 className={cn("px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all", editingWidget?.compare_previous ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-neutral-50 dark:bg-neutral-900 text-neutral-400 border-neutral-200 dark:border-neutral-800')}
               >
                 Comparar com o período anterior
               </button>
               {editingWidget?.compare_previous && (
                 <button
                   type="button"
                   onClick={() => setEditingWidget({...editingWidget, compare_invert: !editingWidget?.compare_invert})}
                   className={cn("px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all", editingWidget?.compare_invert ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-neutral-50 dark:bg-neutral-900 text-neutral-400 border-neutral-200 dark:border-neutral-800')}
                   title="Marque quando cair é bom (ex.: devoluções, cancelamentos)"
                 >
                   Menor é melhor
                 </button>
               )}
             </div>
           )}
           <p className="text-[9px] font-bold text-neutral-400 ml-1">
             {(editingWidget?.period_mode || 'panel') === 'panel' && 'A barra de período do painel (7/30/90 dias, mês, ano, personalizado) filtra este campo.'}
             {editingWidget?.period_mode === 'fixed' && 'O widget sempre mostra o período escolhido e ignora a barra do painel.'}
             {editingWidget?.period_mode === 'own' && 'O próprio card ganha um seletor de período, independente do painel.'}
           </p>
         </div>

         {/* Aparência */}
         <div className="space-y-3 pt-4 border-t border-neutral-100 dark:border-neutral-800">
           <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-1">Aparência e formato</label>
           <div className="grid grid-cols-3 gap-3">
             <div className="space-y-1.5 col-span-2">
               <label className="text-[8px] font-black uppercase tracking-widest text-neutral-400 ml-1">Formato do valor</label>
               <select
                 value={editingWidget?.format || 'number'}
                 onChange={e => setEditingWidget({...editingWidget, format: e.target.value})}
                 className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-2 text-[10px] font-bold text-neutral-900 dark:text-white"
               >
                 {BI_FORMAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
               </select>
             </div>
             <div className="space-y-1.5">
               <label className="text-[8px] font-black uppercase tracking-widest text-neutral-400 ml-1">Casas decimais</label>
               <input
                 type="number"
                 min="0"
                 max="6"
                 placeholder="Auto"
                 value={editingWidget?.decimals ?? ''}
                 onChange={e => setEditingWidget({...editingWidget, decimals: e.target.value === '' ? undefined : Number(e.target.value)})}
                 className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1.5 text-[10px] font-bold text-neutral-900 dark:text-white placeholder:text-neutral-400"
               />
             </div>
             {['currency', 'currency_compact'].includes(editingWidget?.format) && (
               <div className="space-y-1.5 col-span-3">
                 <label className="text-[8px] font-black uppercase tracking-widest text-neutral-400 ml-1">Moeda</label>
                 <select
                   value={editingWidget?.currency || ''}
                   onChange={e => setEditingWidget({...editingWidget, currency: e.target.value || undefined})}
                   className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-2 text-[10px] font-bold text-neutral-900 dark:text-white"
                 >
                   <option value="">Automática (pelo idioma da tela)</option>
                   <option value="BRL">Real (R$)</option>
                   <option value="USD">Dólar (US$)</option>
                   <option value="EUR">Euro (€)</option>
                 </select>
               </div>
             )}
           </div>

           {['bar', 'line', 'area'].includes(editingWidget?.type) && (
             <div className="space-y-1.5">
               <label className="text-[8px] font-black uppercase tracking-widest text-neutral-400 ml-1">Cor</label>
               <div className="flex flex-wrap gap-2">
                 {Object.entries(BI_PALETTES).map(([key, p]) => (
                   <button
                     key={key}
                     type="button"
                     title={p.label}
                     onClick={() => setEditingWidget({...editingWidget, color: key})}
                     className={cn(
                       "w-7 h-7 rounded-full border-2 transition-all",
                       (editingWidget?.color || 'indigo') === key ? 'border-neutral-900 dark:border-white scale-110 shadow' : 'border-transparent opacity-80 hover:opacity-100'
                     )}
                     style={{ backgroundColor: p.color }}
                   />
                 ))}
               </div>
             </div>
           )}

           {['bar', 'line', 'area', 'pie'].includes(editingWidget?.type) && (
             <div className="flex flex-wrap gap-2">
               <button
                 type="button"
                 onClick={() => setEditingWidget({...editingWidget, show_labels: !editingWidget?.show_labels})}
                 className={cn("px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all", editingWidget?.show_labels ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-neutral-50 dark:bg-neutral-900 text-neutral-400 border-neutral-200 dark:border-neutral-800')}
               >
                 Rótulos de valor
               </button>
               {editingWidget?.type === 'bar' && (
                 <>
                   <button
                     type="button"
                     onClick={() => setEditingWidget({...editingWidget, highlight_max: !editingWidget?.highlight_max})}
                     className={cn("px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all", editingWidget?.highlight_max ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-neutral-50 dark:bg-neutral-900 text-neutral-400 border-neutral-200 dark:border-neutral-800')}
                   >
                     Destacar maior valor
                   </button>
                   <button
                     type="button"
                     onClick={() => setEditingWidget({...editingWidget, orientation: editingWidget?.orientation === 'horizontal' ? 'vertical' : 'horizontal'})}
                     className={cn("px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all", editingWidget?.orientation === 'horizontal' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-neutral-50 dark:bg-neutral-900 text-neutral-400 border-neutral-200 dark:border-neutral-800')}
                   >
                     Barras horizontais
                   </button>
                 </>
               )}
             </div>
           )}
         </div>

         {/* Largura do Widget */}
         <div className="space-y-2 pt-4 border-t border-neutral-100 dark:border-neutral-800">
           <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-1">Largura do Widget (Dashboard)</label>
           <div className="flex p-1 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm">
             {[
               { id: 'quarter', label: '1/4 (Mini)' },
               { id: 'third', label: '1/3 (Compacto)' },
               { id: 'half', label: '1/2 (Médio)' },
               { id: 'full', label: 'Total (Largo)' }
             ].map(opt => (
               <button
                 key={opt.id}
                 type="button"
                 onClick={() => setEditingWidget({...editingWidget, width: opt.id})}
                 className={cn(
                   "flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                   (editingWidget?.width || 'third') === opt.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-neutral-400 hover:text-neutral-600'
                 )}
               >
                 {opt.label}
               </button>
             ))}
           </div>
          </div>

          <Modal
            isOpen={isFormulaModalOpen}
            onClose={() => setIsFormulaModalOpen(false)}
            title="Cálculos e Fórmulas"
            size="2xl"
          >
            <div className="p-4 space-y-6">
              <FormulaBuilder 
                value={editingWidget?.formula_tokens || []}
                onChange={(tokens) => {
                  const sqlString = tokens.map((t: any) => {
                    if (t.type === 'field') return t.value;
                    if (t.type === 'function') {
                      const funcMap: any = { 'SOMA': 'SUM', 'MÉDIA': 'AVG', 'CONTAGEM': 'COUNT', 'MÁXIMO': 'MAX', 'MÍNIMO': 'MIN', 'ARREDONDAR': 'ROUND', 'ABS': 'ABS' };
                      return funcMap[t.value] || t.value;
                    }
                    return t.value;
                  }).join(' ');

                  setEditingWidget({
                    ...editingWidget,
                    use_formula: true,
                    formula_tokens: tokens,
                    field: sqlString
                  });
                }}
                availableFields={[
                  ...(models || []).flatMap((m: any) => 
                    (m.fields || []).map((f: any) => ({
                      id: f.id,
                      modelName: m.display_name || m.name,
                      db_column_name: `${m.db_table_name}.${f.db_column_name}`,
                      display_name: f.display_name
                    }))
                  )
                ]}
              />
              <div className="flex justify-end pt-4">
                <button 
                  onClick={() => setIsFormulaModalOpen(false)}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-500 shadow-xl shadow-indigo-500/20 transition-all active:scale-95"
                >
                  Concluir Fórmula
                </button>
              </div>
            </div>
          </Modal>
    </div>
  )
}
