import React from 'react'
import { Columns } from 'lucide-react'
import { SpecialLayoutProps } from './types'

export function KanbanLayoutConfig({
  config,
  setConfig,
  renderFieldOptions,
  orderedModels,
  t
}: SpecialLayoutProps) {
  if (config.logic_type !== 'kanban') return null

  return (
    <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-[1.5rem] space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/20">
            <Columns className="w-4 h-4" />
          </div>
          <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em]">{t('wizard.layout.kanban.title')}</h4>
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.kanban.group_field')}</label>
        <select
          value={config.layout_config.kanban_group_field || ''}
          onChange={e => setConfig({
            ...config,
            layout_config: { ...config.layout_config, kanban_group_field: e.target.value }
          })}
          className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
        >
          <option value="">{t('wizard.layout.kanban.group_placeholder')}</option>
          {renderFieldOptions(orderedModels)}
        </select>
        <p className="text-[10px] text-neutral-400 font-medium italic ml-1">{t('wizard.layout.kanban.group_desc')}</p>
      </div>
    </div>
  )
}
