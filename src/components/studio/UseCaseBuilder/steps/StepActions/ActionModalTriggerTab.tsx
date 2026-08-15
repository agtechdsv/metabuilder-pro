import React from 'react'
import { cn } from '@/lib/utils'
import { Plus, Trash2 } from 'lucide-react'
import { getModelsWithRelations } from '@/lib/relationPathFinder'

interface ActionModalTriggerTabProps {
  editingAction: any
  setEditingAction: (action: any) => void
  t: (key: string, fallback?: string) => string
  config: any
  models: any[]
  useCases: any[]
  relations: any[]
  isDownloadsActive?: boolean
}

export function ActionModalTriggerTab({
  editingAction,
  setEditingAction,
  t,
  config,
  models,
  useCases,
  relations,
  isDownloadsActive
}: ActionModalTriggerTabProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.actions.trigger_type')}</label>
        <div className="flex p-1 bg-neutral-100 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <button
            type="button"
            onClick={() => setEditingAction({ ...editingAction, trigger_type: 'sql' })}
            className={cn("flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all", editingAction.trigger_type === 'sql' ? 'bg-white dark:bg-neutral-800 shadow text-indigo-600' : 'text-neutral-500')}
          >
            {t('wizard.actions.sql_procedure', 'Procedimento SQL')}
          </button>
          <button
            type="button"
            onClick={() => setEditingAction({ ...editingAction, trigger_type: 'usecase' })}
            className={cn("flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all", editingAction.trigger_type === 'usecase' ? 'bg-white dark:bg-neutral-800 shadow text-indigo-600' : 'text-neutral-500')}
          >
            {t('wizard.actions.trigger_usecase', 'Chamar Caso de Uso')}
          </button>
          <button
            type="button"
            onClick={() => setEditingAction({ ...editingAction, trigger_type: 'rest' })}
            className={cn("flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all", editingAction.trigger_type === 'rest' ? 'bg-white dark:bg-neutral-800 shadow text-indigo-600' : 'text-neutral-500')}
          >
            {t('wizard.actions.trigger_rest', 'Webhook / REST')}
          </button>
        </div>
      </div>

      {editingAction.trigger_type === 'sql' && (
        <div className="space-y-2 animate-in fade-in zoom-in-95 duration-300">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.actions.sql_command', 'Comando SQL')}</label>
          <p className="text-[9px] text-neutral-500 ml-1 mb-2">{t('wizard.actions.sql_variables_hint', 'Você pode usar variáveis usando chaves duplas: {{id}}')}</p>
          <textarea
            value={editingAction.sql_query}
            onChange={e => setEditingAction({ ...editingAction, sql_query: e.target.value })}
            className="w-full h-32 bg-neutral-950 text-indigo-400 font-mono text-sm p-4 rounded-2xl outline-none resize-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
            placeholder="CALL sp_aprovar_pedido({{id}});"
          />
        </div>
      )}

      {editingAction.trigger_type === 'usecase' && (
        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300 bg-neutral-50 dark:bg-neutral-900/50 p-4 rounded-2xl border border-neutral-100 dark:border-neutral-800">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.actions.target_usecase', 'Caso de Uso Alvo')}</label>
              <select
                value={editingAction.usecase_slug}
                onChange={e => setEditingAction({ ...editingAction, usecase_slug: e.target.value })}
                className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold focus:border-indigo-500 outline-none transition-all"
              >
                <option value="">{t('wizard.actions.select_usecase', 'Selecione um caso de uso')}</option>
                {isDownloadsActive && <option value="downloads">📥 Central de Downloads</option>}
                {useCases?.filter((uc: any) => uc.slug !== config.slug).map((uc: any) => (
                  <option key={uc.slug} value={uc.slug}>{uc.name} ({uc.slug})</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.actions.open_mode', 'Modo de Abertura')}</label>
              <select
                value={editingAction.usecase_open_mode || 'page'}
                onChange={e => setEditingAction({ ...editingAction, usecase_open_mode: e.target.value })}
                className="w-full bg-white dark:bg-neutral-955 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold focus:border-indigo-500 outline-none transition-all"
              >
                <option value="page">{t('wizard.actions.open_modes.page', 'Mesma Tela (Navegação Padrão)')}</option>
                <option value="modal">{t('wizard.actions.open_modes.modal', 'Modal (Centralizado)')}</option>
                <option value="drawer">{t('wizard.actions.open_modes.drawer', 'Drawer (Lateral)')}</option>
              </select>
            </div>
          </div>

          {editingAction.usecase_open_mode === 'modal' && (
            <div className="space-y-4 mt-4 p-4 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 rounded-xl">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 ml-1">Tamanho da Modal</label>
                <select
                  value={editingAction.usecase_modal_size || 'md'}
                  onChange={e => setEditingAction({ ...editingAction, usecase_modal_size: e.target.value })}
                  className="w-full bg-white dark:bg-neutral-955 border border-indigo-200 dark:border-indigo-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all"
                >
                  <option value="sm">Pequeno (max. 384px)</option>
                  <option value="md">Médio (max. 672px) - Padrão</option>
                  <option value="lg">Grande (max. 896px)</option>
                  <option value="full">Tela Cheia (95% da tela)</option>
                  <option value="custom">Personalizado (em pixels ou %)</option>
                </select>
              </div>

              {editingAction.usecase_modal_size === 'custom' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 ml-1">Largura</label>
                    <input
                      type="text"
                      value={editingAction.usecase_modal_width || ''}
                      onChange={e => setEditingAction({ ...editingAction, usecase_modal_width: e.target.value })}
                      placeholder="ex: 800, 800px, 90vw..."
                      className="w-full bg-white dark:bg-neutral-955 border border-indigo-200 dark:border-indigo-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 ml-1">Altura</label>
                    <input
                      type="text"
                      value={editingAction.usecase_modal_height || ''}
                      onChange={e => setEditingAction({ ...editingAction, usecase_modal_height: e.target.value })}
                      placeholder="ex: 600, 600px, 80vh..."
                      className="w-full bg-white dark:bg-neutral-955 border border-indigo-200 dark:border-indigo-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">
                {t('wizard.actions.fields_as_params', 'Mapeamento de Parâmetros (De : Para)')}
              </label>

              {(() => {
                const placements = editingAction.placements || [];
                const isMindMap = config.logic_type === 'mapa_mental';
                const mindmapPlacements = isMindMap
                  ? placements.filter((p: any) => p.location?.startsWith('mindmap:level:'))
                  : [];

                if (isMindMap) {
                  if (mindmapPlacements.length === 0) {
                    return (
                      <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-955/10 border border-amber-200 dark:border-amber-900/30 p-3 rounded-xl">
                        Configure os <strong>Locais de Renderização</strong> (Exibir Botão no Nó) na aba <strong>Geral</strong> primeiro para definir quais níveis do Mapa Mental exibirão esta ação e mapear seus parâmetros.
                      </p>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {mindmapPlacements.map((p: any) => {
                        const levelStr = p.location.replace('mindmap:level:', '');
                        const levelIndex = parseInt(levelStr, 10);
                        const levelConfig = config.layout_config.mindmap_levels?.[levelIndex - 1];
                        const levelModel = models.find((m: any) => m.id === levelConfig?.model_id);
                        
                        const rawMappings = editingAction.mindmap_params_by_level?.[levelStr] || [];
                        const normalizedMappings = rawMappings.map((f: any) => {
                          if (typeof f === 'string') return { source: f, target: f }
                          return f
                        });

                        const levelSourceModels = models?.filter((m: any) => m.id === levelConfig?.model_id) || [];
                        const destUsecase = useCases?.find((uc: any) => uc.slug === editingAction.usecase_slug);
                        const destConfig = destUsecase?.draft_config || destUsecase?.config || {};
                        const destModelIds = destUsecase?.model_id ? [destUsecase.model_id] : (destConfig.selected_models || [])
                        const destModels = models?.filter((m: any) => destModelIds.includes(m.id)) || [];

                        const maxRelDepth = config.layout_config?.max_relation_depth || 2;
                        const levelSourceGroups = getModelsWithRelations(levelSourceModels, relations, models, maxRelDepth);
                        const destGroups = getModelsWithRelations(destModels, relations, models, maxRelDepth);

                        return (
                          <div key={p.location} className="space-y-2 p-4 bg-white dark:bg-neutral-955 border border-neutral-200 dark:border-neutral-800 rounded-xl">
                            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-2 mb-2">
                              <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                                {t('wizard.actions.locations.level', 'Nível {level} ({name})').replace('{level}', levelStr).replace('{name}', levelModel?.display_name || levelModel?.db_table_name || t('wizard.actions.locations.unknown', 'Desconhecido'))}
                              </span>
                            </div>

                            {/* Table Header */}
                            <div className="flex gap-4 px-2 pb-2">
                              <div className="flex-1 text-[10px] font-black uppercase tracking-wider text-neutral-400">
                                {levelModel ? t('wizard.actions.trigger.origin_table', 'Origem (Tabela: {table})').replace('{table}', levelModel.db_table_name) : t('wizard.actions.trigger.origin', 'ORIGEM')}
                              </div>
                              <div className="flex-1 text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
                                {destModels[0] ? t('wizard.actions.trigger.dest_table', 'Destino (Tabela: {table})').replace('{table}', destModels[0].db_table_name) : t('wizard.actions.trigger.dest', 'DESTINO')}
                              </div>
                              <div className="w-8"></div>
                            </div>

                            {/* Rows */}
                            {normalizedMappings.map((mapping: any, index: number) => (
                              <div key={index} className="flex gap-4 items-center animate-in fade-in slide-in-from-top-2">
                                <select
                                  value={mapping.source || ''}
                                  onChange={(e) => {
                                    const next = [...normalizedMappings]
                                    next[index] = { ...next[index], source: e.target.value }
                                    const newParams = {
                                      ...(editingAction.mindmap_params_by_level || {}),
                                      [levelStr]: next
                                    }
                                    setEditingAction({ ...editingAction, mindmap_params_by_level: newParams })
                                  }}
                                  className="flex-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
                                >
                                  <option value="">{t('wizard.actions.trigger.select_placeholder', 'Selecione para inserir...')}</option>
                                  {levelSourceGroups.map((g: any, i: number) => (
                                    <optgroup key={i} label={g.label} className="text-[10px] font-bold text-blue-600 dark:text-blue-400 normal-case">
                                      {g.model.fields?.map((f: any) => (
                                        <option key={f.id} value={`${g.prefix}${f.db_column_name}`} className="text-neutral-800 dark:text-neutral-200 normal-case">
                                          {String(f.db_column_name).toLowerCase()}
                                        </option>
                                      ))}
                                    </optgroup>
                                  ))}
                                </select>

                                <select
                                  value={mapping.target || ''}
                                  onChange={(e) => {
                                    const next = [...normalizedMappings]
                                    next[index] = { ...next[index], target: e.target.value }
                                    const newParams = {
                                      ...(editingAction.mindmap_params_by_level || {}),
                                      [levelStr]: next
                                    }
                                    setEditingAction({ ...editingAction, mindmap_params_by_level: newParams })
                                  }}
                                  className="flex-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-rose-500"
                                >
                                  <option value="">{t('wizard.actions.trigger.select_placeholder', 'Selecione para inserir...')}</option>
                                  {destGroups.map((g: any, i: number) => (
                                    <optgroup key={i} label={g.label} className="text-[10px] font-bold text-blue-600 dark:text-blue-400 normal-case">
                                      {g.model.fields?.map((f: any) => (
                                        <option key={f.id} value={`${g.prefix}${f.db_column_name}`} className="text-neutral-800 dark:text-neutral-200 normal-case">
                                          {String(f.db_column_name).toLowerCase()}
                                        </option>
                                      ))}
                                    </optgroup>
                                  ))}
                                </select>

                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = normalizedMappings.filter((_: any, i: number) => i !== index)
                                    const newParams = {
                                      ...(editingAction.mindmap_params_by_level || {}),
                                      [levelStr]: next
                                    }
                                    setEditingAction({ ...editingAction, mindmap_params_by_level: newParams })
                                  }}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 text-neutral-400 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}

                            <button
                              type="button"
                              onClick={() => {
                                const newParams = {
                                  ...(editingAction.mindmap_params_by_level || {}),
                                  [levelStr]: [...normalizedMappings, { source: '', target: '' }]
                                }
                                setEditingAction({ ...editingAction, mindmap_params_by_level: newParams })
                              }}
                              className="mt-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" /> {t('wizard.actions.trigger.add_param', '+ Adicionar Parâmetro')}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                }

                const rawMappings = editingAction.usecase_selected_fields || []
                const normalizedMappings = rawMappings.map((f: any) => {
                  if (typeof f === 'string') return { source: f, target: f }
                  return f
                })

                const sourceModels = models?.filter((m: any) => config.selected_models?.includes(m.id)) || []
                const destUsecase = useCases?.find((uc: any) => uc.slug === editingAction.usecase_slug)
                const destConfig = destUsecase?.draft_config || destUsecase?.config || {}
                const destModelIds = destUsecase?.model_id ? [destUsecase.model_id] : (destConfig.selected_models || [])
                const destModels = models?.filter((m: any) => destModelIds.includes(m.id)) || []

                const maxRelDepth = config.layout_config?.max_relation_depth || 2;
                const sourceGroups = getModelsWithRelations(sourceModels, relations, models, maxRelDepth);
                const destGroups = getModelsWithRelations(destModels, relations, models, maxRelDepth);

                return (
                  <div className="space-y-2 p-4 bg-white dark:bg-neutral-955 border border-neutral-200 dark:border-neutral-800 rounded-xl">
                    {/* Table Header */}
                    <div className="flex gap-4 px-2 pb-2 border-b border-neutral-100 dark:border-neutral-800">
                      <div className="flex-1 text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                        {sourceModels[0] ? t('wizard.actions.trigger.origin_table', 'Origem (Tabela: {table})').replace('{table}', sourceModels[0].db_table_name) : t('wizard.actions.trigger.origin', 'ORIGEM')}
                      </div>
                      <div className="flex-1 text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
                        {destModels[0] ? t('wizard.actions.trigger.dest_table', 'Destino (Tabela: {table})').replace('{table}', destModels[0].db_table_name) : t('wizard.actions.trigger.dest', 'DESTINO')}
                      </div>
                      <div className="w-8"></div>
                    </div>

                    {/* Rows */}
                    {normalizedMappings.map((mapping: any, index: number) => (
                      <div key={index} className="flex gap-4 items-center animate-in fade-in slide-in-from-top-2">
                        <select
                          value={mapping.source || ''}
                          onChange={(e) => {
                            const next = [...normalizedMappings]
                            next[index] = { ...next[index], source: e.target.value }
                            setEditingAction({ ...editingAction, usecase_selected_fields: next })
                          }}
                          className="flex-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
                        >
                          <option value="">{t('wizard.actions.trigger.select_placeholder', 'Selecione para inserir...')}</option>
                          {sourceGroups.map((g: any, i: number) => (
                            <optgroup key={i} label={g.label} className="text-[10px] font-bold text-blue-600 dark:text-blue-400 normal-case">
                              {g.model.fields?.map((f: any) => (
                                <option key={f.id} value={`${g.prefix}${f.db_column_name}`} className="text-neutral-800 dark:text-neutral-200 normal-case">
                                  {String(f.db_column_name).toLowerCase()}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>

                        <select
                          value={mapping.target || ''}
                          onChange={(e) => {
                            const next = [...normalizedMappings]
                            next[index] = { ...next[index], target: e.target.value }
                            setEditingAction({ ...editingAction, usecase_selected_fields: next })
                          }}
                          className="flex-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-rose-500"
                        >
                          <option value="">{t('wizard.actions.trigger.select_placeholder', 'Selecione para inserir...')}</option>
                          {destGroups.map((g: any, i: number) => (
                            <optgroup key={i} label={g.label} className="text-[10px] font-bold text-blue-600 dark:text-blue-400 normal-case">
                              {g.model.fields?.map((f: any) => (
                                <option key={f.id} value={`${g.prefix}${f.db_column_name}`} className="text-neutral-800 dark:text-neutral-200 normal-case">
                                  {String(f.db_column_name).toLowerCase()}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => {
                            const next = normalizedMappings.filter((_: any, i: number) => i !== index)
                            setEditingAction({ ...editingAction, usecase_selected_fields: next })
                          }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 text-neutral-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => {
                        setEditingAction({
                          ...editingAction,
                          usecase_selected_fields: [...normalizedMappings, { source: '', target: '' }]
                        })
                      }}
                      className="mt-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> {t('wizard.actions.trigger.add_param', '+ Adicionar Parâmetro')}
                    </button>
                  </div>
                );
              })()}
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.actions.additional_params', 'Parâmetros Adicionais Fixos (Filtros na URL)')}</label>
              <p className="text-[9px] text-neutral-500 ml-1 mb-2">{t('wizard.actions.additional_params_hint', 'Ex: status=ativo&tipo=1')}</p>
              <input
                type="text"
                value={editingAction.usecase_params}
                onChange={e => setEditingAction({ ...editingAction, usecase_params: e.target.value })}
                className="w-full bg-white dark:bg-neutral-955 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-mono focus:border-indigo-500 outline-none transition-all"
                placeholder="status=ativo"
              />
            </div>
          </div>
        </div>
      )}

      {editingAction.trigger_type === 'rest' && (
        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300 bg-neutral-50 dark:bg-neutral-900/50 p-4 rounded-2xl border border-neutral-100 dark:border-neutral-800">
          <div className="flex gap-4">
            <div className="space-y-2 w-1/3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.actions.method', 'Método')}</label>
              <select
                value={editingAction.rest_method}
                onChange={e => setEditingAction({ ...editingAction, rest_method: e.target.value })}
                className="w-full bg-white dark:bg-neutral-955 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 transition-all"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
            <div className="space-y-2 flex-1">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.actions.api_url', 'URL da API / Webhook')}</label>
              <input
                type="text"
                value={editingAction.rest_url}
                onChange={e => setEditingAction({ ...editingAction, rest_url: e.target.value })}
                className="w-full bg-white dark:bg-neutral-955 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-mono focus:border-indigo-500 outline-none transition-all"
                placeholder="https://api.exemplo.com/hook/{{id}}"
              />
            </div>
          </div>
          {['POST', 'PUT', 'PATCH'].includes(editingAction.rest_method) && (
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.actions.api_body', 'Body (JSON Payload)')}</label>
              <textarea
                value={editingAction.rest_body}
                onChange={e => setEditingAction({ ...editingAction, rest_body: e.target.value })}
                className="w-full h-32 bg-neutral-955 text-indigo-400 font-mono text-xs p-4 rounded-2xl outline-none resize-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                placeholder={'{\n  "id": "{{id}}",\n  "status": "aprovado"\n}'}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
