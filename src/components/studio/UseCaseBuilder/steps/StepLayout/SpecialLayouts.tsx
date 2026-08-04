import { cn } from '@/lib/utils'
import { Plus, Palette, Calendar, Layers, Activity, Lock, Map as MapIcon, Database, Columns, History, Settings2, SlidersHorizontal, BarChartHorizontal, Share2 } from 'lucide-react'
import { MultiLevelPathBuilder } from '../StepPersonalizado'
export function SpecialLayouts({
  config, setConfig, models, renderFieldOptions, orderedModels, t
}: any) {
  return (
    <>
            {/* ZONA: CONFIGURAÇÕES GERAIS */}
            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-[1.5rem] space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/20">
                    <Database className="w-4 h-4" />
                  </div>
                  <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em]">Configuração de Padrões</h4>
                </div>
              </div>

              <div className={cn("grid grid-cols-1 gap-4", config.logic_type === 'timeline' ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Registros por Página (LIMIT)</label>
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
                  <p className="text-[10px] text-neutral-400 font-medium italic ml-1">Deixe em branco para usar o padrão do sistema.</p>
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

            {/* ZONA: KANBAN CONFIG */}
            {config.logic_type === 'kanban' && (
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
            )}

            {/* ZONA: SCHEDULER CONFIG */}
            {config.logic_type === 'scheduler' && (
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
                      <option value="">Selecione o campo de data de início...</option>
                      {renderFieldOptions(orderedModels, (f: any) => f.data_type.includes('date') || f.data_type.includes('timestamp'))}
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
                      {renderFieldOptions(orderedModels, (f: any) => f.data_type.includes('date') || f.data_type.includes('timestamp'))}
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
            )}


            {/* ZONA: TIMELINE CONFIG */}
            {config.logic_type === 'timeline' && (
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
                        {renderFieldOptions(orderedModels, (f: any) => f.data_type?.toLowerCase().includes('date') || f.data_type?.toLowerCase().includes('timestamp'))}
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
            )}

            {/* ZONA: GANTT CONFIG */}
            {config.logic_type === 'gantt' && (
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
                      {renderFieldOptions(orderedModels, (f: any) => f.data_type.includes('date') || f.data_type.includes('timestamp'))}
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
                      {renderFieldOptions(orderedModels, (f: any) => f.data_type.includes('date') || f.data_type.includes('timestamp'))}
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
                      {renderFieldOptions(orderedModels, (f: any) => f.data_type.includes('int') || f.data_type.includes('float') || f.data_type.includes('numeric'))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* ZONA: BLUEPRINT CONFIG */}
            {config.logic_type === 'blueprint' && (
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
            )}

            {/* ZONA: MAP CONFIG */}
            {config.logic_type === 'map' && (
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
            )}

    </>
  )
}

