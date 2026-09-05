import React from 'react'
import { Share2 } from 'lucide-react'
import { SpecialLayoutProps } from './types'

export function MapLayoutConfig({
  config,
  setConfig,
  renderFieldOptions,
  orderedModels,
  t
}: SpecialLayoutProps) {
  if (config.logic_type !== 'map') return null

  return (
    <div className="p-6 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-[2rem] space-y-6 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 flex items-center justify-center">
          <Share2 className="w-4 h-4" />
        </div>
        <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em]">{t('wizard.layout.map.title', 'Configuração do Mapa (Leaflet)')}</h4>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.map.title_field', 'Campo de Título (Obrigatório)')}</label>
          <select
            value={(config.layout_config as any).map_config?.title_field || ''}
            onChange={e => setConfig({
              ...config,
              layout_config: {
                ...config.layout_config,
                map_config: { ...(config.layout_config as any).map_config, title_field: e.target.value }
              }
            })}
            className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
          >
            <option value="">Selecione o título...</option>
            {renderFieldOptions(orderedModels)}
          </select>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.map.desc_field', 'Campo de Descrição (Opcional)')}</label>
          <select
            value={(config.layout_config as any).map_config?.desc_field || ''}
            onChange={e => setConfig({
              ...config,
              layout_config: {
                ...config.layout_config,
                map_config: { ...(config.layout_config as any).map_config, desc_field: e.target.value }
              }
            })}
            className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
          >
            <option value="">Selecione a descrição...</option>
            {renderFieldOptions(orderedModels)}
          </select>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.map.lat_field', 'Latitude (Y) - Obrigatório')}</label>
          <select
            value={(config.layout_config as any).map_config?.lat_field || ''}
            onChange={e => setConfig({
              ...config,
              layout_config: {
                ...config.layout_config,
                map_config: { ...(config.layout_config as any).map_config, lat_field: e.target.value }
              }
            })}
            className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
          >
            <option value="">Selecione a latitude...</option>
            {renderFieldOptions(orderedModels)}
          </select>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.map.lng_field', 'Longitude (X) - Obrigatório')}</label>
          <select
            value={(config.layout_config as any).map_config?.lng_field || ''}
            onChange={e => setConfig({
              ...config,
              layout_config: {
                ...config.layout_config,
                map_config: { ...(config.layout_config as any).map_config, lng_field: e.target.value }
              }
            })}
            className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
          >
            <option value="">Selecione a longitude...</option>
            {renderFieldOptions(orderedModels)}
          </select>
        </div>
      </div>
    </div>
  )
}
