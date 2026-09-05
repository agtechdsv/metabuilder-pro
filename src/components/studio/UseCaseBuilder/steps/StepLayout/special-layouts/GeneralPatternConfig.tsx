import React from 'react'
import { cn } from '@/lib/utils'
import { Database } from 'lucide-react'
import { SpecialLayoutProps } from './types'

export function GeneralPatternConfig({ config, setConfig, t }: Pick<SpecialLayoutProps, 'config' | 'setConfig' | 't'>) {
  return (
    <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-[1.5rem] space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/20">
            <Database className="w-4 h-4" />
          </div>
          <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em]">{t('wizard.layout.pattern_config', 'Configuração de Padrões')}</h4>
        </div>
      </div>

      <div className={cn("grid grid-cols-1 gap-4", config.logic_type === 'timeline' ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.records_per_page', 'Registros por Página (LIMIT)')}</label>
          <input
            type="number"
            min="1"
            max="500"
            placeholder="Ex: 50"
            value={config.layout_config.items_per_page || ''}
            onChange={e => setConfig({
              ...config,
              layout_config: { ...config.layout_config, items_per_page: e.target.value ? parseInt(e.target.value, 10) : undefined }
            })}
            className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
          />
          <p className="text-[10px] text-neutral-400 font-medium italic ml-1">{t('wizard.layout.records_per_page_hint', 'Deixe em branco para usar o padrão do sistema.')}</p>
        </div>

        {config.logic_type === 'timeline' && (
          <>
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Ordem (Horizontal)</label>
              <select
                value={(config.layout_config as any).timeline_config?.timeline_order_horizontal || 'asc'}
                onChange={e => setConfig({
                  ...config,
                  layout_config: {
                    ...config.layout_config,
                    timeline_config: { ...(config.layout_config as any).timeline_config, timeline_order_horizontal: e.target.value }
                  }
                })}
                className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
              >
                <option value="asc">Mais Antigo Primeiro (ASC)</option>
                <option value="desc">Mais Recente Primeiro (DESC)</option>
              </select>
              <p className="text-[10px] text-neutral-400 font-medium italic ml-1">Ordem ao exibir em tela horizontal.</p>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Ordem (Vertical)</label>
              <select
                value={(config.layout_config as any).timeline_config?.timeline_order_vertical || 'asc'}
                onChange={e => setConfig({
                  ...config,
                  layout_config: {
                    ...config.layout_config,
                    timeline_config: { ...(config.layout_config as any).timeline_config, timeline_order_vertical: e.target.value }
                  }
                })}
                className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
              >
                <option value="asc">Mais Antigo Primeiro (ASC)</option>
                <option value="desc">Mais Recente Primeiro (DESC)</option>
              </select>
              <p className="text-[10px] text-neutral-400 font-medium italic ml-1">Ordem ao exibir em tela vertical.</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
