'use client'

import React, { useState } from 'react'
import { JoinsEditor } from '@/components/studio/JoinsEditor'
import { cn } from '@/lib/utils'
import FormulaBuilder from '@/components/studio/FormulaBuilder'
import { Modal } from '@/components/ui/Modal'

interface BIWidgetEditorProps {
  editingWidget: any
  setEditingWidget: (widget: any) => void
  models: any[]
  joins: any[]
  t: (key: string) => string
}

export function BIWidgetEditor({ editingWidget, setEditingWidget, models, joins, t }: BIWidgetEditorProps) {
  const [isFormulaModalOpen, setIsFormulaModalOpen] = useState(false)
  const currentModel = models.find((m: any) => String(m.id) === String(editingWidget?.model_id))

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
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-1">Tabela Fonte</label>
          <select 
            value={editingWidget?.model_id || ''} 
            onChange={e => setEditingWidget({...editingWidget, model_id: e.target.value, field: '', group_by: ''})}
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
              <optgroup label={`Tabela: ${currentModel?.display_name || currentModel?.db_table_name || 'Principal'}`}>
                {currentModel?.fields?.map((f: any) => (
                  <option key={f.id} value={f.db_column_name}>{f.display_name || f.db_column_name}</option>
                ))}
              </optgroup>
              
              {models.filter((m: any) => m.id !== currentModel?.id).map((relModel: any, idx: number) => {
                const relTableName = relModel.db_table_name
                return (
                  <optgroup key={`rel-${idx}`} label={`Tabela: ${relModel.display_name || relModel.db_table_name}`}>
                    {relModel.fields?.map((f: any) => (
                      <option key={f.id} value={`${relTableName}.${f.db_column_name}`}>{f.display_name || f.db_column_name}</option>
                    ))}
                  </optgroup>
                )
              })}
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
            <optgroup label={`Tabela: ${currentModel?.display_name || currentModel?.db_table_name || 'Principal'}`}>
              {currentModel?.fields?.map((f: any) => (
                <option key={f.id} value={f.db_column_name}>{f.display_name || f.db_column_name}</option>
              ))}
            </optgroup>
              
            {models.filter((m: any) => m.id !== currentModel?.id).map((relModel: any, idx: number) => {
              const relTableName = relModel.db_table_name
              return (
                <optgroup key={`rel-${idx}`} label={`Tabela: ${relModel.display_name || relModel.db_table_name}`}>
                  {relModel.fields?.map((f: any) => (
                    <option key={f.id} value={`${relTableName}.${f.db_column_name}`}>{f.display_name || f.db_column_name}</option>
                  ))}
                </optgroup>
              )
            })}
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
                      db_column_name: m.db_table_name === currentModel?.db_table_name ? f.db_column_name : `${m.db_table_name}.${f.db_column_name}`,
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
