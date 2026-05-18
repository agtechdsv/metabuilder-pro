'use client'

import React from 'react'
import { Link, Plus, ArrowRight, Trash2 } from 'lucide-react'

interface JoinsEditorProps {
  joins: any[]
  models: any[]
  onUpdate: (newJoins: any[]) => void
  t: (key: string, fallback?: string) => string
}

export const JoinsEditor = ({ joins, models, onUpdate, t }: JoinsEditorProps) => {
  const handleAdd = () => {
    onUpdate([...joins, { from: '', localKey: '', to: '', foreignKey: '' }])
  }

  const handleRemove = (index: number) => {
    const newJoins = [...joins]
    newJoins.splice(index, 1)
    onUpdate(newJoins)
  }

  const handleUpdate = (index: number, field: string, value: string) => {
    const newJoins = [...joins]
    newJoins[index][field] = value
    if (field === 'from') newJoins[index].localKey = ''
    if (field === 'to') newJoins[index].foreignKey = ''
    onUpdate(newJoins)
  }

  return (
    <div className="p-3 bg-indigo-50/30 dark:bg-indigo-900/5 border border-indigo-100 dark:border-indigo-900/20 rounded-[1.5rem] space-y-4">
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-600/20">
          <Link className="w-4 h-4 text-white" />
        </div>
        <div>
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">{t('wizard.layout.relationships')}</h4>
          <p className="text-[9px] text-neutral-500 font-medium">{t('wizard.layout.relationships_desc')}</p>
        </div>
      </div>

      <div className="space-y-2">
        {(joins || []).map((join: any, index: number) => (
          <div key={index} className="flex flex-wrap items-center gap-2 p-2 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-sm group animate-in zoom-in-95 duration-300">
            {/* FROM TABLE */}
            <select
              value={join.from}
              onChange={e => handleUpdate(index, 'from', e.target.value)}
              className="flex-1 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none"
            >
              <option value="">{t('wizard.layout.select_table', 'Select Table...')}</option>
              {models.map((m: any) => (
                <option key={m.id} value={m.db_table_name}>{m.display_name || m.db_table_name}</option>
              ))}
            </select>

            {/* FROM KEY */}
            <select
              value={join.localKey}
              onChange={e => handleUpdate(index, 'localKey', e.target.value)}
              className="flex-1 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none"
            >
              <option value="">{t('wizard.layout.select_field', 'Select Field...')}</option>
              {models.find((m: any) => m.db_table_name === join.from)?.fields.map((f: any) => (
                <option key={f.id} value={f.db_column_name}>{f.display_name || f.db_column_name}</option>
              ))}
            </select>

            <div className="px-2 text-neutral-400">
              <ArrowRight className="w-4 h-4" />
            </div>

            {/* TO TABLE */}
            <select
              value={join.to}
              onChange={e => handleUpdate(index, 'to', e.target.value)}
              className="flex-1 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none"
            >
              <option value="">{t('wizard.layout.select_table', 'Select Table...')}</option>
              {models.map((m: any) => (
                <option key={m.id} value={m.db_table_name}>{m.display_name || m.db_table_name}</option>
              ))}
            </select>

            {/* TO KEY */}
            <select
              value={join.foreignKey}
              onChange={e => handleUpdate(index, 'foreignKey', e.target.value)}
              className="flex-1 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none"
            >
              <option value="">{t('wizard.layout.select_field', 'Select Field...')}</option>
              {models.find((m: any) => m.db_table_name === join.to)?.fields.map((f: any) => (
                <option key={f.id} value={f.db_column_name}>{f.display_name || f.db_column_name}</option>
              ))}
            </select>

            <button
              onClick={() => handleRemove(index)}
              className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}

        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
        >
          <Plus className="w-4 h-4" />
          {t('wizard.layout.add_relationship', 'Add Relationship')}
        </button>
      </div>
    </div>
  )
}
