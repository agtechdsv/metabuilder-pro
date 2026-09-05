import React from 'react'
import { BarChartHorizontal } from 'lucide-react'
import { SpecialLayoutProps } from './types'

export function GanttLayoutConfig({
  config,
  setConfig,
  renderFieldOptions,
  orderedModels,
  t
}: SpecialLayoutProps) {
  if (config.logic_type !== 'gantt') return null

  return (
    <div className="p-6 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-[2rem] space-y-6 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 flex items-center justify-center">
          <BarChartHorizontal className="w-4 h-4" />
        </div>
        <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em]">{t('wizard.layout.gantt.title', 'Configuração do Gráfico de Gantt')}</h4>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.gantt.title_field', 'Campo de Título (Obrigatório)')}</label>
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
            <option value="">Selecione o campo de título...</option>
            {renderFieldOptions(orderedModels)}
          </select>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.gantt.start_date_field', 'Data Inicial (Obrigatório)')}</label>
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
            {renderFieldOptions(orderedModels, (f: any) => {
              const dt = (f.data_type || f.db_data_type || f.field_type || '').toLowerCase();
              return dt.includes('date') || dt.includes('timestamp');
            })}
          </select>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.gantt.end_date_field', 'Data Final (Obrigatório)')}</label>
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
            {renderFieldOptions(orderedModels, (f: any) => {
              const dt = (f.data_type || f.db_data_type || f.field_type || '').toLowerCase();
              return dt.includes('date') || dt.includes('timestamp');
            })}
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
            <option value="">Nenhum (Progresso não exibido)</option>
            {renderFieldOptions(orderedModels, (f: any) => {
              const dt = (f.data_type || f.db_data_type || f.field_type || '').toLowerCase();
              return dt.includes('int') || dt.includes('num') || dt.includes('dec') || dt.includes('float') || dt.includes('double');
            })}
          </select>
        </div>
      </div>
    </div>
  )
}
