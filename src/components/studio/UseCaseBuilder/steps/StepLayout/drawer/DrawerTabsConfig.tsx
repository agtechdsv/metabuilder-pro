'use client'

import React from 'react'

interface DrawerTabsConfigProps {
  currentFieldMeta: any
  updateMeta: (section: string, field: string, value: any) => void
  editingTabId: string
  config: any
  setConfig: (config: any) => void
  models: any[]
  t: (key: string, fallback?: string) => string
}

export function DrawerTabsConfig({
  currentFieldMeta,
  updateMeta,
  editingTabId,
  config,
  setConfig,
  models,
  t
}: DrawerTabsConfigProps) {
  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-1 h-4 bg-indigo-600 rounded-full" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
            {t('wizard.layout.drawer.label_config')}
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">
              {t('wizard.layout.drawer.font')}
            </label>
            <select
              value={currentFieldMeta.label.font}
              onChange={(e) => updateMeta('label', 'font', e.target.value)}
              className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2.5 text-xs font-bold outline-none"
            >
              <option value="Inter">{t('wizard.layout.drawer.font_default')}</option>
              <option value="Roboto">Roboto</option>
              <option value="Outfit">Outfit</option>
              <option value="JetBrains Mono">Mono</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">
              {t('wizard.layout.drawer.size')}
            </label>
            <input
              type="text"
              placeholder="Ex: 12px"
              value={currentFieldMeta.label.size}
              onChange={(e) => updateMeta('label', 'size', e.target.value)}
              className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">
            {t('wizard.layout.drawer.text_color')}
          </label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={currentFieldMeta.label.color || '#6366f1'}
              onChange={(e) => updateMeta('label', 'color', e.target.value)}
              className="w-8 h-8 rounded-lg cursor-pointer overflow-hidden border-none p-0"
            />
            <input
              type="text"
              value={currentFieldMeta.label.color}
              onChange={(e) => updateMeta('label', 'color', e.target.value)}
              placeholder={t('wizard.layout.drawer.text_color')}
              className="flex-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2 text-xs font-mono font-bold outline-none"
            />
          </div>
        </div>
      </div>

      {/* TEXTO DE EXIBIÇÃO PARA TABS FICA SEPARADO MAS NA MESMA ABA ÚNICA */}
      <div className="space-y-4 pt-6 mt-6 border-t border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="w-1 h-4 bg-indigo-600 rounded-full" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
            {t('wizard.layout.drawer.label_config')}
          </h3>
        </div>
        <div className="space-y-2">
          <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">
            {t('wizard.layout.drawer.display_text')}
          </label>
          <input
            type="text"
            value={
              editingTabId === 'master'
                ? (config.layout_config as any).master_tab_title ||
                  `${t('wizard.layout.master')}: ${
                    models.find((m: any) => m.id === (config.layout_config as any).master_model_id)?.display_name || ''
                  }`
                : (config.layout_config as any).details_tab_titles?.[editingTabId || ''] || `Detalhe`
            }
            onChange={(e) => {
              if (editingTabId === 'master') {
                setConfig({
                  ...config,
                  layout_config: { ...config.layout_config, master_tab_title: e.target.value },
                })
              } else if (editingTabId) {
                const currentTitles = (config.layout_config as any).details_tab_titles || {}
                setConfig({
                  ...config,
                  layout_config: {
                    ...config.layout_config,
                    details_tab_titles: { ...currentTitles, [editingTabId]: e.target.value },
                  },
                })
              }
            }}
            className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold focus:border-indigo-500 outline-none transition-all"
          />
        </div>
      </div>
    </>
  )
}
