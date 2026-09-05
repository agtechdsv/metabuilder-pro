import React from 'react'
import { Calendar } from 'lucide-react'
import { SpecialLayoutProps } from './types'

export function SchedulerLayoutConfig({
  config,
  setConfig,
  renderFieldOptions,
  orderedModels
}: SpecialLayoutProps) {
  if (config.logic_type !== 'scheduler') return null

  return (
    <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-[1.5rem] space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/20">
            <Calendar className="w-4 h-4" />
          </div>
          <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em]">Configuração do Calendário</h4>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Campo do Título</label>
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
            <option value="">Selecione o campo de título...</option>
            {renderFieldOptions(orderedModels)}
          </select>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Campo de Data de Início</label>
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
            <option value="">Selecione a data inicial...</option>
            {renderFieldOptions(orderedModels, (f: any) => {
              const dt = (f.data_type || f.db_data_type || f.field_type || '').toLowerCase();
              return dt.includes('date') || dt.includes('timestamp');
            })}
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
            <option value="">Nenhum (Evento de data única)</option>
            {renderFieldOptions(orderedModels, (f: any) => {
              const dt = (f.data_type || f.db_data_type || f.field_type || '').toLowerCase();
              return dt.includes('date') || dt.includes('timestamp');
            })}
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
            <option value="">Nenhum (Cor padrão indigo)</option>
            {renderFieldOptions(orderedModels)}
          </select>
        </div>
      </div>
    </div>
  )
}
