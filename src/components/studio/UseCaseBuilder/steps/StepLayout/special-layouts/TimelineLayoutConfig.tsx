import React from 'react'
import { History, Database, Settings2 } from 'lucide-react'
import { SpecialLayoutProps } from './types'

export function TimelineLayoutConfig({
  config,
  setConfig,
  renderFieldOptions,
  orderedModels,
  t
}: SpecialLayoutProps) {
  if (config.logic_type !== 'timeline') return null

  return (
    <div className="p-5 bg-indigo-50/30 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/30 rounded-[1.5rem] space-y-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/20">
            <History className="w-4 h-4" />
          </div>
          <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em]">{t('wizard.layout.timeline.title', 'Configuração da Linha do Tempo')}</h4>
        </div>
      </div>

      {/* Subcard 1: Mapeamento de Dados */}
      <div className="p-4 bg-white dark:bg-neutral-900/70 border border-neutral-200/60 dark:border-neutral-800/60 rounded-2xl space-y-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <Database className="w-4 h-4 text-indigo-500" />
          <span className="text-[10px] font-black uppercase text-neutral-700 dark:text-neutral-300 tracking-wider">Mapeamento de Dados</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.timeline.title_field', 'Campo de Título')}</label>
            <select
              value={(config.layout_config as any).timeline_config?.title_field || ''}
              onChange={e => setConfig({
                ...config,
                layout_config: {
                  ...config.layout_config,
                  timeline_config: { ...(config.layout_config as any).timeline_config, title_field: e.target.value }
                }
              })}
              className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
            >
              <option value="">Selecione o campo de título...</option>
              {renderFieldOptions(orderedModels)}
            </select>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.timeline.date_field', 'Campo de Data')}</label>
            <select
              value={(config.layout_config as any).timeline_config?.date_field || ''}
              onChange={e => setConfig({
                ...config,
                layout_config: {
                  ...config.layout_config,
                  timeline_config: { ...(config.layout_config as any).timeline_config, date_field: e.target.value }
                }
              })}
              className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
            >
              <option value="">Selecione a data...</option>
              {renderFieldOptions(orderedModels, (f: any) => {
                const dt = (f.data_type || f.db_data_type || f.field_type || '').toLowerCase();
                return dt.includes('date') || dt.includes('timestamp');
              })}
            </select>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.timeline.desc_field', 'Campo de Descrição (Opcional)')}</label>
            <select
              value={(config.layout_config as any).timeline_config?.desc_field || ''}
              onChange={e => setConfig({
                ...config,
                layout_config: {
                  ...config.layout_config,
                  timeline_config: { ...(config.layout_config as any).timeline_config, desc_field: e.target.value }
                }
              })}
              className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
            >
              <option value="">Nenhum</option>
              {renderFieldOptions(orderedModels)}
            </select>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.timeline.icon_field', 'Campo de Ícone/Status (Opcional)')}</label>
            <select
              value={(config.layout_config as any).timeline_config?.icon_field || ''}
              onChange={e => setConfig({
                ...config,
                layout_config: {
                  ...config.layout_config,
                  timeline_config: { ...(config.layout_config as any).timeline_config, icon_field: e.target.value }
                }
              })}
              className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
            >
              <option value="">Nenhum</option>
              {renderFieldOptions(orderedModels)}
            </select>
          </div>
        </div>
      </div>

      {/* Subcard 2: Estilo e Comportamento */}
      <div className="p-4 bg-white dark:bg-neutral-900/70 border border-neutral-200/60 dark:border-neutral-800/60 rounded-2xl space-y-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <Settings2 className="w-4 h-4 text-indigo-500" />
          <span className="text-[10px] font-black uppercase text-neutral-700 dark:text-neutral-300 tracking-wider">Estilo e Comportamento</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.timeline.direction', 'Direção da Linha')}</label>
            <select
              value={(config.layout_config as any).timeline_config?.layout_direction || 'vertical'}
              onChange={e => setConfig({
                ...config,
                layout_config: {
                  ...config.layout_config,
                  timeline_config: { ...(config.layout_config as any).timeline_config, layout_direction: e.target.value }
                }
              })}
              className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
            >
              <option value="vertical">Vertical</option>
              <option value="horizontal">Horizontal</option>
            </select>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.timeline.mode', 'Modo de Exibição')}</label>
            <select
              value={(config.layout_config as any).timeline_config?.layout_mode || 'alternating'}
              onChange={e => setConfig({
                ...config,
                layout_config: {
                  ...config.layout_config,
                  timeline_config: { ...(config.layout_config as any).timeline_config, layout_mode: e.target.value }
                }
              })}
              className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
            >
              <option value="alternating">Intercalado (Zig-Zag)</option>
              <option value="same_side">Mesmo Lado</option>
            </select>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.timeline.animated', 'Animação de Desenho')}</label>
            <select
              value={(config.layout_config as any).timeline_config?.animated === false ? 'false' : 'true'}
              onChange={e => setConfig({
                ...config,
                layout_config: {
                  ...config.layout_config,
                  timeline_config: { ...(config.layout_config as any).timeline_config, animated: e.target.value === 'true' }
                }
              })}
              className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
            >
              <option value="false">Sem Animação (Estático)</option>
              <option value="true">Com Animação (Desenho Dinâmico)</option>
            </select>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.timeline.style', 'Estilo Visual')}</label>
            <select
              value={(config.layout_config as any).timeline_config?.layout_style || 'cards'}
              onChange={e => setConfig({
                ...config,
                layout_config: {
                  ...config.layout_config,
                  timeline_config: { ...(config.layout_config as any).timeline_config, layout_style: e.target.value }
                }
              })}
              className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
            >
              <option value="cards">Cards (Padrão)</option>
              <option value="infographic">Infográfico (Minimalista)</option>
            </select>
          </div>

          <div className="space-y-3 col-span-1 sm:col-span-2 border-t border-neutral-100 dark:border-neutral-800/50 pt-4">
            <div className="flex justify-between items-center ml-1">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">Escala de Exibição (Cards e Textos)</label>
              <span className="text-[10px] font-extrabold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-md">
                {((config.layout_config as any).timeline_config?.card_scale ?? 1.0).toFixed(1)}x
                {((config.layout_config as any).timeline_config?.card_scale ?? 1.0) === 1.0 ? ' (Padrão)' : ''}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Compacto (0.6x)</span>
              <input
                type="range"
                min="0.6"
                max="1.4"
                step="0.1"
                value={(config.layout_config as any).timeline_config?.card_scale ?? 1.0}
                onChange={e => setConfig({
                  ...config,
                  layout_config: {
                    ...config.layout_config,
                    timeline_config: { ...(config.layout_config as any).timeline_config, card_scale: parseFloat(e.target.value) }
                  }
                })}
                className="flex-1 h-2 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-600 focus:outline-none"
              />
              <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Ampliado (1.4x)</span>
            </div>
            <p className="text-[9px] text-neutral-400 italic ml-1">Arraste para ajustar proporcionalmente o tamanho dos cards, fontes e espaçamentos da linha do tempo.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
