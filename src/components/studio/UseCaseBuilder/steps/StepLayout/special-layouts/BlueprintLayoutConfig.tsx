import React from 'react'
import { Database, SlidersHorizontal } from 'lucide-react'
import { SpecialLayoutProps } from './types'

export function BlueprintLayoutConfig({
  config,
  setConfig,
  renderFieldOptions,
  orderedModels
}: SpecialLayoutProps) {
  if (config.logic_type !== 'blueprint') return null

  return (
    <div className="space-y-6">
      {/* Card 1: Mapeamento de Dados */}
      <div className="p-6 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] space-y-6 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 flex items-center justify-center">
            <Database className="w-4 h-4" />
          </div>
          <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em]">Mapeamento de Dados</h4>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Campo de Título do Nó (Obrigatório)</label>
            <select
              value={(config.layout_config as any).blueprint_config?.title_field || ''}
              onChange={e => setConfig({
                ...config,
                layout_config: {
                  ...config.layout_config,
                  blueprint_config: { ...(config.layout_config as any).blueprint_config, title_field: e.target.value }
                }
              })}
              className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
            >
              <option value="">Selecione o título...</option>
              {renderFieldOptions(orderedModels)}
            </select>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Campo Nó Anterior / Predecessora (Obrigatório)</label>
            <select
              value={(config.layout_config as any).blueprint_config?.predecessor_field || ''}
              onChange={e => setConfig({
                ...config,
                layout_config: {
                  ...config.layout_config,
                  blueprint_config: { ...(config.layout_config as any).blueprint_config, predecessor_field: e.target.value }
                }
              })}
              className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
            >
              <option value="">Selecione o campo de relação...</option>
              {renderFieldOptions(orderedModels)}
            </select>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Campo de Status (Opcional)</label>
            <select
              value={(config.layout_config as any).blueprint_config?.status_field || ''}
              onChange={e => setConfig({
                ...config,
                layout_config: {
                  ...config.layout_config,
                  blueprint_config: { ...(config.layout_config as any).blueprint_config, status_field: e.target.value }
                }
              })}
              className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
            >
              <option value="">Selecione o campo de status...</option>
              {renderFieldOptions(orderedModels)}
            </select>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Campo de Descrição (Opcional)</label>
            <select
              value={(config.layout_config as any).blueprint_config?.desc_field || ''}
              onChange={e => setConfig({
                ...config,
                layout_config: {
                  ...config.layout_config,
                  blueprint_config: { ...(config.layout_config as any).blueprint_config, desc_field: e.target.value }
                }
              })}
              className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
            >
              <option value="">Selecione a descrição...</option>
              {renderFieldOptions(orderedModels)}
            </select>
          </div>
        </div>
      </div>

      {/* Card 2: Estilo e Comportamento */}
      <div className="p-6 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] space-y-6 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 flex items-center justify-center">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em]">Estilo e Comportamento</h4>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Direção da Linha */}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Direção da Linha</label>
            <select
              value={(config.layout_config as any).blueprint_config?.direction || 'TB'}
              onChange={e => setConfig({
                ...config,
                layout_config: { ...config.layout_config, blueprint_config: { ...(config.layout_config as any).blueprint_config, direction: e.target.value } }
              })}
              className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
            >
              <option value="TB">Vertical (Cima para Baixo)</option>
              <option value="LR">Horizontal (Esquerda para Direita)</option>
            </select>
          </div>

          {/* Animação */}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Animação de Desenho</label>
            <select
              value={(config.layout_config as any).blueprint_config?.animated_edges !== false ? 'true' : 'false'}
              onChange={e => setConfig({
                ...config,
                layout_config: { ...config.layout_config, blueprint_config: { ...(config.layout_config as any).blueprint_config, animated_edges: e.target.value === 'true' } }
              })}
              className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
            >
              <option value="true">Com Animação (Desenho Dinâmico)</option>
              <option value="false">Sem Animação (Estático)</option>
            </select>
          </div>
        </div>

        {/* Slider de Escala */}
        <div className="space-y-3 pt-4 border-t border-neutral-100 dark:border-neutral-800/50">
          <div className="flex justify-between items-center text-xs font-bold text-neutral-500 mb-2 uppercase tracking-wider">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Escala de exibição (Cards e textos)</label>
            <span className="text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">
              {((config.layout_config as any).blueprint_config?.scale || 1).toFixed(1)}x
            </span>
          </div>
          <div className="flex items-center gap-4 px-2">
            <span className="text-[10px] font-semibold text-neutral-400 whitespace-nowrap">COMPACTO (0.6X)</span>
            <input
              type="range"
              min="0.6"
              max="1.4"
              step="0.1"
              value={(config.layout_config as any).blueprint_config?.scale || 1}
              onChange={(e) => setConfig({
                ...config,
                layout_config: { ...config.layout_config, blueprint_config: { ...(config.layout_config as any).blueprint_config, scale: Number(e.target.value) } }
              })}
              className="flex-1 h-2 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-600 transition-all"
            />
            <span className="text-[10px] font-semibold text-neutral-400 whitespace-nowrap">AMPLIADO (1.4X)</span>
          </div>
          <p className="text-[10px] text-neutral-400 mt-2 italic px-2">Arraste para ajustar proporcionalmente o tamanho dos cards, fontes e espaçamentos do fluxograma.</p>
        </div>
      </div>
    </div>
  )
}
