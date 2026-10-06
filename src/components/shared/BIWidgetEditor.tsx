'use client'

import React, { useState } from 'react'
import { JoinsEditor } from '@/components/studio/JoinsEditor'
import { cn } from '@/lib/utils'
import FormulaBuilder from '@/components/studio/FormulaBuilder'
import { Modal } from '@/components/ui/Modal'
import { BI_FORMAT_OPTIONS, BI_PALETTES } from '@/lib/bi/format'
import { biFieldKind } from '@/lib/bi/columnKind'
import { PERIOD_PRESETS } from '@/lib/bi/period'
import { resolveRelations } from '@/lib/relationPathFinder'
import { ambiguousTables, automaticPath, describePath, pathSignature } from '@/lib/relationPaths'
import { widgetReferencedTables } from '@/lib/bi/widgetTables'

interface BIWidgetEditorProps {
  editingWidget: any
  setEditingWidget: (widget: any) => void
  models: any[]
  joins: any[]
  t: (key: string) => string
  /** grupos do painel (criados e organizados no Studio); o widget escolhe um deles */
  groups?: { id: string; title: string }[]
  /** relações do projeto (como vêm do banco); permitem escolher o caminho entre tabelas */
  relations?: any[]
}

const OPS_BY_KIND: Record<string, { value: string; label: string }[]> = {
  text: [
    { value: 'eq', label: 'op_eq_text' }, { value: 'ne', label: 'op_ne' }, { value: 'contains', label: 'op_contains' },
    { value: 'starts', label: 'op_starts' }, { value: 'ends', label: 'op_ends' }, { value: 'in', label: 'op_in_text' },
    { value: 'is_null', label: 'op_is_null' }, { value: 'not_null', label: 'op_not_null' },
  ],
  number: [
    { value: 'eq', label: '=' }, { value: 'ne', label: '≠' }, { value: 'gt', label: '>' }, { value: 'gte', label: '≥' },
    { value: 'lt', label: '<' }, { value: 'lte', label: '≤' }, { value: 'between', label: 'op_between' }, { value: 'in', label: 'op_in_num' },
    { value: 'is_null', label: 'op_is_null' }, { value: 'not_null', label: 'op_not_null' },
  ],
  date: [
    { value: 'eq', label: 'op_eq_date' }, { value: 'gte', label: 'op_gte_date' }, { value: 'lte', label: 'op_lte_date' }, { value: 'gt', label: 'op_gt_date' },
    { value: 'lt', label: 'op_lt_date' }, { value: 'between', label: 'op_between' }, { value: 'is_null', label: 'op_is_null' }, { value: 'not_null', label: 'op_not_null' },
  ],
}

const selectCls = 'w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-2 text-[10px] font-bold text-neutral-900 dark:text-white'
const labelCls = 'text-[8px] font-black uppercase tracking-widest text-neutral-400 ml-1'

export function BIWidgetEditor({ editingWidget, setEditingWidget, models, joins, t, groups = [], relations = [] }: BIWidgetEditorProps) {
  const [isFormulaModalOpen, setIsFormulaModalOpen] = useState(false)
  const currentModel = models.find((m: any) => String(m.id) === String(editingWidget?.model_id))
  const trOr = (key: string, fallback: string) => { const v = t(key); return v === key ? fallback : v }

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
      <optgroup label={`${t('bi_editor.table_prefix')} ${currentModel?.display_name || currentModel?.db_table_name || t('bi_editor.main_table')}`}>
        {currentModel?.fields?.map((f: any) => (
          <option key={f.id} value={`${currentModel.db_table_name}.${f.db_column_name}`}>{f.display_name || f.db_column_name}</option>
        ))}
      </optgroup>
      {models.filter((m: any) => m.id !== currentModel?.id).map((relModel: any, idx: number) => (
        <optgroup key={`opt-${idx}`} label={`${t('bi_editor.table_prefix')} ${relModel.display_name || relModel.db_table_name}`}>
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
    v && !validFieldValues.has(v) ? <option value={v}>⚠ {v} {t('bi_editor.stale')}</option> : null

  // Caminho entre tabelas: só aparece quando alguma tabela do widget pode ser alcançada por mais de um caminho
  const mainTable: string | undefined = currentModel?.db_table_name
  const resolvedRels = resolveRelations(relations, models)
  const tableLabel = (tbl: string) => models.find((m: any) => m.db_table_name === tbl)?.display_name || tbl
  const ambiguous = mainTable
    ? ambiguousTables(resolvedRels, mainTable, widgetReferencedTables(editingWidget, mainTable, models, resolvedRels))
    : []
  const setRelationPath = (table: string, signature: string) => {
    const next = { ...(editingWidget?.relation_paths || {}) }
    if (signature) next[table] = signature
    else delete next[table]
    setEditingWidget({ ...editingWidget, relation_paths: Object.keys(next).length ? next : undefined })
  }

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
          placeholder={t('bi_editor.title_placeholder')}
        />
      </div>

      {/* Agrupamento: os grupos são criados e organizados no Studio (Painel de Indicadores) */}
      {groups.length > 0 && (
        <div className="space-y-2">
          <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-1">{t('bi_editor.group')}</label>
          <select
            value={groups.some(g => g.id === editingWidget?.group_id) ? editingWidget?.group_id : ''}
            onChange={e => setEditingWidget({...editingWidget, group_id: e.target.value || undefined})}
            className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2 focus:border-indigo-600 outline-none transition-all text-xs font-bold text-neutral-900 dark:text-white"
          >
            <option value="">{t('bi_editor.no_group')}</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.title || t('bi_editor.unnamed_group')}</option>)}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-1">{t('bi_editor.chart_type')}</label>
          <select 
            value={editingWidget?.type || ''} 
            onChange={e => setEditingWidget({...editingWidget, type: e.target.value})}
            className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2 focus:border-indigo-600 outline-none transition-all text-xs font-bold text-neutral-900 dark:text-white"
          >
            <option value="kpi">{t('bi_editor.type_kpi')}</option>
            <option value="gauge">{t('bi_editor.type_gauge')}</option>
            <option value="bar">{t('bi_editor.type_bar')}</option>
            <option value="pie">{t('bi_editor.type_pie')}</option>
            <option value="line">{t('bi_editor.type_line')}</option>
            <option value="area">{t('bi_editor.type_area')}</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-1">{t('bi_editor.source_table')}</label>
          <select 
            value={editingWidget?.model_id || ''} 
            onChange={e => setEditingWidget({...editingWidget, model_id: e.target.value, field: '', use_formula: false, formula_tokens: [], group_by: '', series_by: undefined, divide_by: undefined, conditions: [], period_field: undefined})}
            className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2 focus:border-indigo-600 outline-none transition-all text-xs font-bold text-neutral-900 dark:text-white"
          >
            <option value="">{t('bi_editor.select')}</option>
            {models.map((m: any) => (
              <option key={m.id} value={m.id}>{m.display_name || m.db_table_name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-1">{t('bi_editor.calc')}</label>
          <select 
            value={editingWidget?.calc || 'COUNT'} 
            onChange={e => setEditingWidget({...editingWidget, calc: e.target.value})}
            className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2 focus:border-indigo-600 outline-none transition-all text-xs font-bold text-neutral-900 dark:text-white"
          >
            <option value="COUNT">{t('bi_editor.calc_count')}</option>
            <option value="COUNT_DISTINCT">{t('bi_editor.calc_distinct')}</option>
            <option value="SUM">{t('bi_editor.calc_sum')}</option>
            <option value="AVG">{t('bi_editor.calc_avg')}</option>
            <option value="MIN">{t('bi_editor.calc_min')}</option>
            <option value="MAX">{t('bi_editor.calc_max')}</option>
          </select>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between ml-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">{t('bi_editor.value_field')}</label>
            <button 
              onClick={() => setIsFormulaModalOpen(true)}
              className={cn(
                "text-[8px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full border transition-all",
                editingWidget?.use_formula 
                  ? "bg-indigo-600 border-indigo-600 text-white" 
                  : "bg-neutral-100 border-neutral-200 text-neutral-400 hover:bg-neutral-200"
              )}
            >
              {t('bi_editor.formula')}
            </button>
          </div>
          
          {editingWidget?.use_formula ? (
            <div className="w-full bg-neutral-50 dark:bg-neutral-900 border-2 border-indigo-100 dark:border-indigo-800 rounded-xl px-4 py-2 text-xs font-bold text-indigo-600 truncate">
              {editingWidget?.field || t('bi_editor.formula_empty')}
            </div>
          ) : (
            <select 
              value={editingWidget?.field || ''} 
              onChange={e => setEditingWidget({...editingWidget, field: e.target.value})}
              className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2 focus:border-indigo-600 outline-none transition-all text-xs font-bold text-neutral-900 dark:text-white"
            >
              <option value="">{t('bi_editor.whole_table')}</option>
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
               <label className="text-[8px] font-black uppercase tracking-widest text-indigo-500 ml-1">{t('bi_editor.gauge_start')}</label>
               <input 
                 type="number" 
                 value={editingWidget?.gauge_start ?? 0} 
                 onChange={e => setEditingWidget({...editingWidget, gauge_start: Number(e.target.value)})}
                 className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1.5 text-[10px] font-bold text-neutral-900 dark:text-white"
               />
             </div>
             <div className="space-y-1.5">
               <label className="text-[8px] font-black uppercase tracking-widest text-indigo-500 ml-1">{t('bi_editor.gauge_end')}</label>
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
               <label className="text-[8px] font-black uppercase tracking-widest text-neutral-400 ml-1">{t('bi_editor.gauge_min')}</label>
               <input 
                 type="number" 
                 value={editingWidget?.gauge_min ?? 0} 
                 onChange={e => setEditingWidget({...editingWidget, gauge_min: Number(e.target.value)})}
                 className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1.5 text-[10px] font-bold text-neutral-900 dark:text-white"
               />
             </div>
             <div className="space-y-1.5">
               <label className="text-[8px] font-black uppercase tracking-widest text-neutral-400 ml-1">{t('bi_editor.gauge_target')}</label>
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
         <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-1">{t('bi_editor.group_by')}</label>
         <select 
           value={editingWidget?.group_by || ''} 
           onChange={e => setEditingWidget({...editingWidget, group_by: e.target.value})}
           className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-2.5 focus:border-indigo-600 outline-none transition-all text-sm font-bold text-neutral-900 dark:text-white"
         >
           <option value="">{t('bi_editor.group_none')}</option>
           {staleOption(editingWidget?.group_by)}
           {fieldOptions}
          </select>
          
          {editingWidget?.group_by && (
            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-indigo-100/30 dark:border-indigo-900/10">
               <div className="space-y-1.5">
                 <label className="text-[8px] font-black uppercase tracking-widest text-neutral-400 ml-1">{t('bi_editor.granularity')}</label>
                 <select 
                   value={editingWidget?.date_granularity || ''} 
                   onChange={e => setEditingWidget({...editingWidget, date_granularity: e.target.value})}
                   className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-2 text-[10px] font-bold text-neutral-900 dark:text-white"
                 >
                   <option value="">{t('bi_editor.gran_exact')}</option>
                   <option value="day">{t('bi_editor.gran_day')}</option>
                   <option value="month">{t('bi_editor.gran_month')}</option>
                   <option value="year">{t('bi_editor.gran_year')}</option>
                   <option value="week">{t('bi_editor.gran_week')}</option>
                   <option value="quarter">{t('bi_editor.gran_quarter')}</option>
                 </select>
               </div>
               
               <div className="space-y-1.5">
                 <label className="text-[8px] font-black uppercase tracking-widest text-neutral-400 ml-1">{t('bi_editor.sort_by')}</label>
                 <select 
                   value={editingWidget?.sort_by || 'value_desc'} 
                   onChange={e => setEditingWidget({...editingWidget, sort_by: e.target.value})}
                   className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-2 text-[10px] font-bold text-neutral-900 dark:text-white"
                 >
                   <option value="value_desc">{t('bi_editor.sort_value_desc')}</option>
                   <option value="value_asc">{t('bi_editor.sort_value_asc')}</option>
                   <option value="label_asc">{t('bi_editor.sort_label_asc')}</option>
                   <option value="label_desc">{t('bi_editor.sort_label_desc')}</option>
                 </select>
               </div>
  
               <div className="space-y-1.5">
                 <label className="text-[8px] font-black uppercase tracking-widest text-neutral-400 ml-1">{t('bi_editor.limit_top')}</label>
                 <input 
                   type="number"
                   min="1"
                   placeholder={t('bi_editor.all')}
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
             <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-1">{t('bi_editor.series_by')}</label>
             <select value={editingWidget?.series_by || ''} onChange={e => setEditingWidget({...editingWidget, series_by: e.target.value || undefined})} className={selectCls}>
               <option value="">{t('bi_editor.series_none')}</option>
               {staleOption(editingWidget?.series_by)}
               {fieldOptions}
             </select>
             {editingWidget?.series_by && (
               <button
                 type="button"
                 onClick={() => setEditingWidget({...editingWidget, stacked: !editingWidget?.stacked})}
                 className={cn("px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all", editingWidget?.stacked ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-neutral-50 dark:bg-neutral-900 text-neutral-400 border-neutral-200 dark:border-neutral-800')}
               >
                 {t('bi_editor.stack')}
               </button>
             )}
           </div>
         )}

         {/* Métrica derivada */}
         <div className="space-y-2 pt-4 border-t border-neutral-100 dark:border-neutral-800">
           <div className="flex items-center justify-between ml-1">
             <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">{t('bi_editor.derived')}</label>
             <button
               type="button"
               onClick={() => setEditingWidget({...editingWidget, divide_by: editingWidget?.divide_by ? undefined : { calc: 'COUNT', field: '' }})}
               className={cn("text-[8px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full border transition-all", editingWidget?.divide_by ? "bg-indigo-600 border-indigo-600 text-white" : "bg-neutral-100 border-neutral-200 text-neutral-400 hover:bg-neutral-200")}
             >
               {editingWidget?.divide_by ? t('bi_editor.active') : t('bi_editor.inactive')}
             </button>
           </div>
           {editingWidget?.divide_by ? (
             <>
               <div className="grid grid-cols-2 gap-3">
                 <div className="space-y-1.5">
                   <label className={labelCls}>{t('bi_editor.div_op')}</label>
                   <select value={editingWidget.divide_by.calc} onChange={e => setEditingWidget({...editingWidget, divide_by: { ...editingWidget.divide_by, calc: e.target.value }})} className={selectCls}>
                     <option value="COUNT">{t('bi_editor.div_count')}</option>
                     <option value="COUNT_DISTINCT">{t('bi_editor.calc_distinct')}</option>
                     <option value="SUM">{t('bi_editor.div_sum')}</option>
                     <option value="AVG">{t('bi_editor.div_avg')}</option>
                     <option value="MIN">{t('bi_editor.div_min')}</option>
                     <option value="MAX">{t('bi_editor.div_max')}</option>
                   </select>
                 </div>
                 <div className="space-y-1.5">
                   <label className={labelCls}>{t('bi_editor.div_field')}</label>
                   <select value={editingWidget.divide_by.field || ''} onChange={e => setEditingWidget({...editingWidget, divide_by: { ...editingWidget.divide_by, field: e.target.value }})} className={selectCls}>
                     <option value="">{t('bi_editor.div_table_rows')}</option>
                     {staleOption(editingWidget.divide_by.field)}
                     {fieldOptions}
                   </select>
                 </div>
               </div>
               <p className="text-[9px] font-bold text-neutral-400 ml-1">
                 {t('bi_editor.derived_hint')}
               </p>
             </>
           ) : null}
         </div>

         {/* Caminho entre tabelas (só quando há mais de uma forma de ligar) */}
         {ambiguous.length > 0 && (
           <div className="space-y-2 pt-4 border-t border-neutral-100 dark:border-neutral-800">
             <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-1">{t('bi_editor.path_title')}</label>
             <p className="text-[9px] font-bold text-neutral-400 ml-1">
               {t('bi_editor.path_hint').replace('{table}', tableLabel(mainTable as string))}
             </p>
             {ambiguous.map(({ table, paths }) => {
               const auto = automaticPath(resolvedRels, mainTable as string, table)
               const current = editingWidget?.relation_paths?.[table] || ''
               return (
                 <div key={table} className="space-y-1">
                   <label className={labelCls}>{tableLabel(table)}</label>
                   <select value={current} onChange={e => setRelationPath(table, e.target.value)} className={selectCls}>
                     <option value="">{t('bi_editor.automatic')}{auto ? ` — ${describePath(auto, tableLabel)}` : ''}</option>
                     {paths.map(p => {
                       const sig = pathSignature(p)
                       return <option key={sig} value={sig}>{describePath(p, tableLabel)}</option>
                     })}
                   </select>
                 </div>
               )
             })}
           </div>
         )}

         {/* Filtros do widget */}
         <div className="space-y-2 pt-4 border-t border-neutral-100 dark:border-neutral-800">
           <div className="flex items-center justify-between ml-1">
             <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">{t('bi_editor.filters')}</label>
             <button
               type="button"
               onClick={() => setConditions([...conditions, { field: '', op: 'eq', value: '' }])}
               className="text-[8px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full border bg-neutral-100 border-neutral-200 text-neutral-500 hover:bg-neutral-200 transition-all"
             >
               {t('bi_editor.add_filter')}
             </button>
           </div>
           {conditions.length === 0 && <p className="text-[9px] font-bold text-neutral-400 ml-1">{t('bi_editor.no_filters')}</p>}
           {conditions.map((c, i) => {
             const kind = kindOf(c.field)
             const ops = OPS_BY_KIND[kind]
             const noValue = c.op === 'is_null' || c.op === 'not_null'
             const inputType = kind === 'date' ? 'date' : kind === 'number' && c.op !== 'in' ? 'number' : 'text'
             return (
               <div key={i} className="space-y-2 p-2 bg-neutral-50/60 dark:bg-neutral-900/60 border border-neutral-100 dark:border-neutral-800 rounded-xl">
                 <div className="grid grid-cols-2 gap-2">
                   <div className="space-y-1 min-w-0">
                     <label className={labelCls}>{t('bi_editor.field')}</label>
                     <select value={c.field} onChange={e => patchCondition(i, { field: e.target.value, op: 'eq', value: '', value2: '' })} className={selectCls}>
                       <option value="">{t('bi_editor.select')}</option>
                       {staleOption(c.field)}
                       {fieldOptions}
                     </select>
                   </div>
                   <div className="space-y-1 min-w-0">
                     <label className={labelCls}>{t('bi_editor.operator')}</label>
                     <select value={c.op} onChange={e => patchCondition(i, { op: e.target.value })} className={selectCls}>
                       {ops.map(o => <option key={o.value} value={o.value}>{o.label.startsWith('op_') ? t('bi_editor.' + o.label) : o.label}</option>)}
                     </select>
                   </div>
                 </div>
                 <div className="flex items-end gap-2">
                   <div className="space-y-1 flex-1 min-w-0">
                     <label className={labelCls}>{c.op === 'between' ? t('bi_editor.value_range') : t('bi_editor.value')}</label>
                     {noValue ? (
                       <div className="px-2 py-2 text-[10px] font-bold text-neutral-300">—</div>
                     ) : (
                       <div className="flex gap-2">
                         <input type={inputType} value={c.value ?? ''} onChange={e => patchCondition(i, { value: e.target.value })} className={cn(selectCls, 'min-w-0 flex-1')} />
                         {c.op === 'between' && <input type={inputType} value={c.value2 ?? ''} onChange={e => patchCondition(i, { value2: e.target.value })} className={cn(selectCls, 'min-w-0 flex-1')} />}
                       </div>
                     )}
                   </div>
                   <button type="button" onClick={() => setConditions(conditions.filter((_, idx) => idx !== i))} className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-[12px] font-black text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all" title={t('bi_editor.remove_filter')}>✕</button>
                 </div>
               </div>
             )
           })}
         </div>

         {/* Período */}
         <div className="space-y-2 pt-4 border-t border-neutral-100 dark:border-neutral-800">
           <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-1">{t('bi_editor.period_field')}</label>
           <select value={editingWidget?.period_field || ''} onChange={e => setEditingWidget({...editingWidget, period_field: e.target.value || undefined})} className={selectCls}>
             <option value="">{t('bi_editor.period_none')}</option>
             {staleOption(editingWidget?.period_field)}
             {fieldOptions}
           </select>
           {editingWidget?.period_field && (
             <>
               <label className={labelCls}>{t('bi_editor.period_source')}</label>
               <div className="flex p-1 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl">
                 {[
                   { id: 'panel', label: t('bi_editor.pm_panel') },
                   { id: 'fixed', label: t('bi_editor.pm_fixed') },
                   { id: 'group', label: t('bi_editor.pm_group') },
                   { id: 'own', label: t('bi_editor.pm_own') },
                 ].map(opt => (
                   <button
                     key={opt.id}
                     type="button"
                     disabled={opt.id === 'group' && !groups.some(g => g.id === editingWidget?.group_id)}
                     title={opt.id === 'group' && !groups.some(g => g.id === editingWidget?.group_id) ? t('bi_editor.pm_group_disabled') : undefined}
                     onClick={() => setEditingWidget({...editingWidget, period_mode: opt.id, period_fixed: opt.id === 'fixed' ? (editingWidget?.period_fixed || 'month') : editingWidget?.period_fixed})}
                     className={cn("flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed", (editingWidget?.period_mode || 'panel') === opt.id ? 'bg-indigo-600 text-white shadow' : 'text-neutral-400 hover:text-neutral-600')}
                   >
                     {opt.label}
                   </button>
                 ))}
               </div>
               {editingWidget?.period_mode === 'fixed' && (
                 <select value={editingWidget?.period_fixed || 'month'} onChange={e => setEditingWidget({...editingWidget, period_fixed: e.target.value})} className={selectCls}>
                   {PERIOD_PRESETS.filter(o => o.id !== 'all').map(o => <option key={o.id} value={o.id}>{trOr('bi_editor.period_' + o.id, o.label)}</option>)}
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
                 {t('bi_editor.compare')}
               </button>
               {editingWidget?.compare_previous && (
                 <button
                   type="button"
                   onClick={() => setEditingWidget({...editingWidget, compare_invert: !editingWidget?.compare_invert})}
                   className={cn("px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all", editingWidget?.compare_invert ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-neutral-50 dark:bg-neutral-900 text-neutral-400 border-neutral-200 dark:border-neutral-800')}
                   title={t('bi_editor.lower_better_hint')}
                 >
                   {t('bi_editor.lower_better')}
                 </button>
               )}
             </div>
           )}
           <p className="text-[9px] font-bold text-neutral-400 ml-1">
             {(editingWidget?.period_mode || 'panel') === 'panel' && t('bi_editor.pm_panel_hint')}
             {editingWidget?.period_mode === 'fixed' && t('bi_editor.pm_fixed_hint')}
             {editingWidget?.period_mode === 'group' && t('bi_editor.pm_group_hint')}
             {editingWidget?.period_mode === 'own' && t('bi_editor.pm_own_hint')}
           </p>
         </div>

         {/* Interações entre gráficos (Fase 4) */}
         <div className="space-y-3 pt-4 border-t border-neutral-100 dark:border-neutral-800">
           <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-1">{t('runtime.bi_ed_title')}</label>
           {([
             { key: 'cross_source', label: t('runtime.bi_ed_cross_source'), needsGroup: true },
             { key: 'cross_target', label: t('runtime.bi_ed_cross_target'), needsGroup: false },
             { key: 'drill_detail', label: t('runtime.bi_ed_drill_detail'), needsGroup: true },
             { key: 'drill_records', label: t('runtime.bi_ed_drill_records'), needsGroup: true },
           ] as const).map(o => {
             const disabled = o.needsGroup && !editingWidget?.group_by
             return (
               <label key={o.key} className={cn('flex items-center gap-2 px-1 text-[11px] font-bold', disabled ? 'text-neutral-300 dark:text-neutral-600 cursor-not-allowed' : 'text-neutral-700 dark:text-neutral-200 cursor-pointer')}>
                 <input
                   type="checkbox"
                   disabled={disabled}
                   checked={!!editingWidget?.[o.key] && !disabled}
                   onChange={e => setEditingWidget({ ...editingWidget, [o.key]: e.target.checked })}
                   className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
                 />
                 {o.label}
               </label>
             )
           })}
           {editingWidget?.drill_detail && editingWidget?.group_by && (
             <div className="space-y-1.5 pl-6">
               <label className="text-[8px] font-black uppercase tracking-widest text-neutral-400 ml-1">{t('runtime.bi_ed_drill_by')}</label>
               <select value={editingWidget?.drill_by || ''} onChange={e => setEditingWidget({ ...editingWidget, drill_by: e.target.value || undefined })} className={selectCls}>
                 <option value="">{t('runtime.bi_ed_none')}</option>
                 {staleOption(editingWidget?.drill_by)}
                 {fieldOptions}
               </select>
             </div>
           )}
           <p className="text-[9px] font-bold text-neutral-400 leading-relaxed px-1">
             {!editingWidget?.group_by
               ? t('runtime.bi_ed_hint_nogroup')
               : t('runtime.bi_ed_hint_group')}
           </p>
         </div>

         {/* Aparência */}
         <div className="space-y-3 pt-4 border-t border-neutral-100 dark:border-neutral-800">
           <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-1">{t('bi_editor.appearance')}</label>
           <div className="grid grid-cols-3 gap-3">
             <div className="space-y-1.5 col-span-2">
               <label className="text-[8px] font-black uppercase tracking-widest text-neutral-400 ml-1">{t('bi_editor.format')}</label>
               <select
                 value={editingWidget?.format || 'number'}
                 onChange={e => setEditingWidget({...editingWidget, format: e.target.value})}
                 className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-2 text-[10px] font-bold text-neutral-900 dark:text-white"
               >
                 {BI_FORMAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{trOr('bi_editor.fmt_' + o.value, o.label)}</option>)}
               </select>
             </div>
             <div className="space-y-1.5">
               <label className="text-[8px] font-black uppercase tracking-widest text-neutral-400 ml-1">{t('bi_editor.decimals')}</label>
               <input
                 type="number"
                 min="0"
                 max="6"
                 placeholder={t('bi_editor.auto')}
                 value={editingWidget?.decimals ?? ''}
                 onChange={e => setEditingWidget({...editingWidget, decimals: e.target.value === '' ? undefined : Number(e.target.value)})}
                 className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1.5 text-[10px] font-bold text-neutral-900 dark:text-white placeholder:text-neutral-400"
               />
             </div>
             {['currency', 'currency_compact'].includes(editingWidget?.format) && (
               <div className="space-y-1.5 col-span-3">
                 <label className="text-[8px] font-black uppercase tracking-widest text-neutral-400 ml-1">{t('bi_editor.currency')}</label>
                 <select
                   value={editingWidget?.currency || ''}
                   onChange={e => setEditingWidget({...editingWidget, currency: e.target.value || undefined})}
                   className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-2 text-[10px] font-bold text-neutral-900 dark:text-white"
                 >
                   <option value="">{t('bi_editor.cur_auto')}</option>
                   <option value="BRL">{t('bi_editor.cur_brl')}</option>
                   <option value="USD">{t('bi_editor.cur_usd')}</option>
                   <option value="EUR">Euro (€)</option>
                 </select>
               </div>
             )}
           </div>

           {['bar', 'line', 'area'].includes(editingWidget?.type) && (
             <div className="space-y-1.5">
               <label className="text-[8px] font-black uppercase tracking-widest text-neutral-400 ml-1">{t('bi_editor.color')}</label>
               <div className="flex flex-wrap gap-2">
                 {Object.entries(BI_PALETTES).map(([key, p]) => (
                   <button
                     key={key}
                     type="button"
                     title={trOr('bi_editor.pal_' + key, p.label)}
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
                 {t('bi_editor.show_labels')}
               </button>
               {editingWidget?.type === 'bar' && (
                 <>
                   <button
                     type="button"
                     onClick={() => setEditingWidget({...editingWidget, highlight_max: !editingWidget?.highlight_max})}
                     className={cn("px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all", editingWidget?.highlight_max ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-neutral-50 dark:bg-neutral-900 text-neutral-400 border-neutral-200 dark:border-neutral-800')}
                   >
                     {t('bi_editor.highlight_max')}
                   </button>
                   <button
                     type="button"
                     onClick={() => setEditingWidget({...editingWidget, orientation: editingWidget?.orientation === 'horizontal' ? 'vertical' : 'horizontal'})}
                     className={cn("px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all", editingWidget?.orientation === 'horizontal' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-neutral-50 dark:bg-neutral-900 text-neutral-400 border-neutral-200 dark:border-neutral-800')}
                   >
                     {t('bi_editor.horizontal')}
                   </button>
                 </>
               )}
             </div>
           )}
         </div>

         {/* Largura do Widget */}
         <div className="space-y-2 pt-4 border-t border-neutral-100 dark:border-neutral-800">
           <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-1">{t('bi_editor.width')}</label>
           <div className="flex p-1 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm">
             {[
               { id: 'quarter', label: t('bi_editor.w_quarter') },
               { id: 'third', label: t('bi_editor.w_third') },
               { id: 'half', label: t('bi_editor.w_half') },
               { id: 'full', label: t('bi_editor.w_full') }
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
            title={t('bi_editor.formula_modal')}
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
                  {t('bi_editor.formula_done')}
                </button>
              </div>
            </div>
          </Modal>
    </div>
  )
}
