'use client'

import React from 'react'
import { Copy } from 'lucide-react'

interface DrawerStylesTabProps {
  currentFieldMeta: any
  updateMeta: (section: string, field: string, value: any) => void
  handleApplyStylesToZone: () => void
  editingFieldZone: string
  t: (key: string, fallback?: string) => string
}

export function DrawerStylesTab({
  currentFieldMeta,
  updateMeta,
  handleApplyStylesToZone,
  editingFieldZone,
  t
}: DrawerStylesTabProps) {
  return (
    <>
      <button
        onClick={handleApplyStylesToZone}
        className="w-full mb-6 flex items-center justify-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 py-3 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors text-xs font-bold"
      >
        <Copy className="w-4 h-4" />
        {t(
          'wizard.layout.drawer.apply_styles_zone',
          'Aplicar formatação a todos desta zona ({zone})'
        ).replace(
          '{zone}',
          editingFieldZone === 'filter'
            ? t('wizard.layout.drawer.zone_filter')
            : editingFieldZone === 'grid'
            ? t('wizard.layout.drawer.zone_grid')
            : t('wizard.layout.drawer.zone_form')
        )}
      </button>

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

      <div className="space-y-4 pt-6 border-t border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="w-1 h-4 bg-emerald-600 rounded-full" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
            {t('wizard.layout.drawer.content_config')}
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">
              {t('wizard.layout.drawer.font')}
            </label>
            <select
              value={currentFieldMeta.content.font}
              onChange={(e) => updateMeta('content', 'font', e.target.value)}
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
              placeholder="Ex: 14px"
              value={currentFieldMeta.content.size}
              onChange={(e) => updateMeta('content', 'size', e.target.value)}
              className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">
            {t('wizard.layout.drawer.content_color')}
          </label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={currentFieldMeta.content.color || '#000000'}
              onChange={(e) => updateMeta('content', 'color', e.target.value)}
              className="w-8 h-8 rounded-lg cursor-pointer overflow-hidden border-none p-0"
            />
            <input
              type="text"
              value={currentFieldMeta.content.color}
              onChange={(e) => updateMeta('content', 'color', e.target.value)}
              placeholder={t('wizard.layout.drawer.content_color')}
              className="flex-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2 text-xs font-mono font-bold outline-none"
            />
          </div>
        </div>
      </div>
    </>
  )
}
