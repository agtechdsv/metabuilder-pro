import { cn } from '@/lib/utils'
import { Plus, BarChart3, GripVertical, Pencil, Trash2, Gauge, Activity, Layers, Share2, LayoutGrid, X } from 'lucide-react'
import { SortableContext, horizontalListSortingStrategy, rectSortingStrategy } from '@dnd-kit/sortable'
import { DroppableZone, SortableWidgetCard } from './dnd'
import { MultiLevelPathBuilder } from '../StepPersonalizado'

export function AnalyticsSection({
  config, setConfig, models, relations, useCases = [],
  setEditingWidget, setIsWidgetModalOpen, getFieldName, t, orderedModels
}: any) {
  const handleAddWidget = () => {
    setEditingWidget({
      id: "widget_" + Date.now(),
      type: 'kpi',
      calc: 'count',
      title: 'Novo Indicador',
      size: '1',
      color: 'indigo'
    })
    setIsWidgetModalOpen(true)
  }

  const handleDeleteWidget = (id: string) => {
    setConfig({
      ...config,
      layout_config: {
        ...config.layout_config,
        analytics_config: {
          ...(config.layout_config.analytics_config || {}),
          widgets: (config.layout_config.analytics_config?.widgets || []).filter((w: any) => w.id !== id)
        }
      }
    })
  }

  return (    <>
            {/* ZONA: ANALYTICS (BI) CONFIG */}
            {config.logic_type === 'analytics' && (
              <div className="p-6 bg-indigo-50/30 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800 rounded-[2rem] space-y-6 shadow-sm animate-in zoom-in-95 duration-500">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/20">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em]">Painel de Indicadores (BI)</h4>
                      <p className="text-[10px] text-neutral-400 font-medium mt-1">Configure os widgets e gráficos do seu dashboard.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-1 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl">
                    <button
                      onClick={() => setConfig({
                        ...config,
                        layout_config: {
                          ...config.layout_config,
                          analytics_config: { ...config.layout_config.analytics_config, allow_runtime_edit: !config.layout_config.analytics_config.allow_runtime_edit }
                        }
                      })}
                      className={cn(
                        "px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                        config.layout_config.analytics_config.allow_runtime_edit ? "bg-indigo-600 text-white shadow-md" : "text-neutral-400 hover:text-neutral-600"
                      )}
                    >
                      Edição no Runtime: {config.layout_config.analytics_config.allow_runtime_edit ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <SortableContext items={(config.layout_config.analytics_config?.widgets || []).map((w: any) => `widget-${w.id}`)} strategy={rectSortingStrategy}>
                    {(config.layout_config.analytics_config?.widgets || []).map((widget: any) => (
                      <SortableWidgetCard
                        key={`widget-${widget.id}`}
                        widget={widget}
                        onEdit={() => { setEditingWidget(widget); setIsWidgetModalOpen(true); }}
                        onDelete={() => handleDeleteWidget(widget.id)}
                        getFieldName={getFieldName}
                      />
                    ))}
                  </SortableContext>

                  <button
                    onClick={handleAddWidget}
                    className="p-8 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col items-center justify-center gap-3 text-neutral-400 hover:text-indigo-600 hover:border-indigo-500 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-all group"
                  >
                    <Plus className="w-6 h-6 group-hover:scale-125 transition-transform" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Adicionar Widget de BI</span>
                  </button>
                </div>
              </div>
            )}
            {config.logic_type === 'mapa_mental' && (
              <div className="p-4 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-[1.5rem] space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-600 text-white rounded-xl shadow-lg shadow-purple-500/20">
                      <Share2 className="w-4 h-4" />
                    </div>
                    <h4 className="text-[10px] font-black uppercase text-purple-600 tracking-[0.3em]">Hierarquia Relacional do Mapa</h4>
                  </div>
                </div>

                <div className="space-y-4">
                  {(config.layout_config.mindmap_levels || []).map((level: any, lIdx: number) => {
                    const levelModel = models.find((m: any) => m.id === level.model_id);
                    const isRoot = lIdx === 0;
                    return (
                      <div key={level.id || lIdx} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 space-y-3 relative">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-black uppercase text-neutral-400">Nível {lIdx + 1} {isRoot && '(Raiz)'}</span>
                          {!isRoot && (
                            <button onClick={() => {
                              setConfig((prev: any) => {
                                const newLevels = prev.layout_config.mindmap_levels.filter((_: any, i: number) => i !== lIdx);
                                return { ...prev, layout_config: { ...prev.layout_config, mindmap_levels: newLevels } };
                              });
                            }} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded-lg transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[9px] font-black uppercase text-neutral-400">Tabela (Model)</label>
                            <select
                              value={level.model_id || ''}
                              onChange={e => {
                                setConfig((prev: any) => {
                                  const newLevels = [...(prev.layout_config.mindmap_levels || [])];
                                  newLevels[lIdx].model_id = e.target.value;
                                  newLevels[lIdx].title_field = '';
                                  newLevels[lIdx].desc_field = '';
                                  newLevels[lIdx].foreign_key = '';
                                  return { ...prev, layout_config: { ...prev.layout_config, mindmap_levels: newLevels } };
                                });
                              }}
                              disabled={isRoot}
                              className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-200 outline-none disabled:opacity-50"
                            >
                              <option value="">Selecione...</option>
                              {orderedModels.map((m: any) => <option key={m.id} value={m.id}>{m.display_name || m.db_table_name}</option>)}
                            </select>
                            {isRoot && <p className="text-[9px] text-neutral-400 mt-1 italic">Tabela base do Use Case.</p>}
                          </div>

                          {!isRoot && (
                            <div className="space-y-3 col-span-full bg-neutral-50 dark:bg-neutral-800/30 p-3 rounded-lg border border-neutral-100 dark:border-neutral-800">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <label className="text-[9px] font-black uppercase text-neutral-400">Tipo de Relação com o Nível Anterior</label>
                                  <select
                                    value={level.relation_type || 'direct'}
                                    onChange={e => {
                                      setConfig((prev: any) => {
                                        const newLevels = [...(prev.layout_config.mindmap_levels || [])];
                                        newLevels[lIdx].relation_type = e.target.value;
                                        // Reset fields
                                        newLevels[lIdx].foreign_key = '';
                                        newLevels[lIdx].through_table = '';
                                        newLevels[lIdx].through_local_fk = '';
                                        newLevels[lIdx].through_target_fk = '';
                                        return { ...prev, layout_config: { ...prev.layout_config, mindmap_levels: newLevels } };
                                      });
                                    }}
                                    className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-200 outline-none mt-1"
                                  >
                                    <option value="direct">Direta (1:N)</option>
                                    <option value="indirect">Indireta (N:M - Via Tabela Intermediária)</option>
                                    <option value="multilevel">Avançada (Multi-Níveis - Múltiplos Joins)</option>
                                  </select>
                                </div>

                                {level.relation_type === 'indirect' ? (
                                  <div>
                                    <label className="text-[9px] font-black uppercase text-neutral-400">Tabela Intermediária (N:M)</label>
                                    <select
                                      value={level.through_table || ''}
                                      onChange={e => {
                                        setConfig((prev: any) => {
                                          const newLevels = [...(prev.layout_config.mindmap_levels || [])];
                                          newLevels[lIdx].through_table = e.target.value;
                                          newLevels[lIdx].through_local_fk = '';
                                          newLevels[lIdx].through_target_fk = '';
                                          return { ...prev, layout_config: { ...prev.layout_config, mindmap_levels: newLevels } };
                                        });
                                      }}
                                      className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-200 outline-none mt-1"
                                    >
                                      <option value="">Selecione a Tabela...</option>
                                      {orderedModels.map((m: any) => <option key={`through-${m.id}`} value={m.db_table_name}>{m.display_name || m.db_table_name}</option>)}
                                    </select>
                                  </div>
                                ) : level.relation_type === 'direct' ? (
                                  <div>
                                    <label className="text-[9px] font-black uppercase text-neutral-400">Chave Estrangeira (Aponta pro Pai)</label>
                                    <select
                                      value={level.foreign_key || ''}
                                      onChange={e => {
                                        setConfig((prev: any) => {
                                          const newLevels = [...(prev.layout_config.mindmap_levels || [])];
                                          newLevels[lIdx].foreign_key = e.target.value;
                                          return { ...prev, layout_config: { ...prev.layout_config, mindmap_levels: newLevels } };
                                        });
                                      }}
                                      className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-200 outline-none mt-1"
                                    >
                                      <option value="">Selecione o Campo...</option>
                                      {levelModel?.fields?.map((f: any) => <option key={f.id} value={f.db_column_name}>{f.display_name || f.db_column_name}</option>)}
                                    </select>
                                  </div>
                                ) : null}

                                {level.relation_type === 'indirect' && level.through_table && (() => {
                                  const throughModel = models.find((m: any) => m.db_table_name === level.through_table);
                                  return (
                                    <>
                                      <div>
                                        <label className="text-[9px] font-black uppercase text-neutral-400">FK para o Pai (Na Tabela Intermediária)</label>
                                        <select
                                          value={level.through_local_fk || ''}
                                          onChange={e => {
                                            setConfig((prev: any) => {
                                              const newLevels = [...(prev.layout_config.mindmap_levels || [])];
                                              newLevels[lIdx].through_local_fk = e.target.value;
                                              return { ...prev, layout_config: { ...prev.layout_config, mindmap_levels: newLevels } };
                                            });
                                          }}
                                          className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-200 outline-none mt-1"
                                        >
                                          <option value="">Selecione o Campo...</option>
                                          {throughModel?.fields?.map((f: any) => <option key={f.id} value={f.db_column_name}>{f.display_name || f.db_column_name}</option>)}
                                        </select>
                                      </div>
                                      <div>
                                        <label className="text-[9px] font-black uppercase text-neutral-400">FK para o Filho (Na Tabela Intermediária)</label>
                                        <select
                                          value={level.through_target_fk || ''}
                                          onChange={e => {
                                            setConfig((prev: any) => {
                                              const newLevels = [...(prev.layout_config.mindmap_levels || [])];
                                              newLevels[lIdx].through_target_fk = e.target.value;
                                              return { ...prev, layout_config: { ...prev.layout_config, mindmap_levels: newLevels } };
                                            });
                                          }}
                                          className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-200 outline-none mt-1"
                                        >
                                          <option value="">Selecione o Campo...</option>
                                          {throughModel?.fields?.map((f: any) => <option key={f.id} value={f.db_column_name}>{f.display_name || f.db_column_name}</option>)}
                                        </select>
                                      </div>
                                    </>
                                  );
                                })()}

                                {level.relation_type === 'multilevel' && (
                                  <div className="col-span-full">
                                    <MultiLevelPathBuilder
                                      level={level}
                                      models={models}
                                      parentModelId={lIdx === 0 ? config.selected_models?.[0] : config.layout_config.mindmap_levels[lIdx - 1]?.model_id}
                                      onChange={(newPath: any) => {
                                        setConfig((prev: any) => {
                                          const newLevels = [...(prev.layout_config.mindmap_levels || [])];
                                          newLevels[lIdx].relation_path = newPath;
                                          return { ...prev, layout_config: { ...prev.layout_config, mindmap_levels: newLevels } };
                                        });
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          <div>
                            <label className="text-[9px] font-black uppercase text-neutral-400">Campo de Título do Card</label>
                            <select
                              value={level.title_field || ''}
                              onChange={e => {
                                setConfig((prev: any) => {
                                  const newLevels = [...(prev.layout_config.mindmap_levels || [])];
                                  newLevels[lIdx].title_field = e.target.value;
                                  return { ...prev, layout_config: { ...prev.layout_config, mindmap_levels: newLevels } };
                                });
                              }}
                              className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-200 outline-none"
                            >
                              <option value="">Automático</option>
                              {levelModel?.fields?.map((f: any) => <option key={f.id} value={f.db_column_name}>{f.display_name || f.db_column_name}</option>)}
                            </select>
                          </div>

                          <div>
                            <label className="text-[9px] font-black uppercase text-neutral-400">Campo de Descrição / Subtítulo</label>
                            <select
                              value={level.desc_field || ''}
                              onChange={e => {
                                setConfig((prev: any) => {
                                  const newLevels = [...(prev.layout_config.mindmap_levels || [])];
                                  newLevels[lIdx].desc_field = e.target.value;
                                  return { ...prev, layout_config: { ...prev.layout_config, mindmap_levels: newLevels } };
                                });
                              }}
                              className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-200 outline-none"
                            >
                              <option value="">Nenhum</option>
                              {levelModel?.fields?.map((f: any) => <option key={f.id} value={f.db_column_name}>{f.display_name || f.db_column_name}</option>)}
                            </select>
                          </div>

                          <div className="col-span-full border-t border-dashed border-neutral-200 dark:border-neutral-800 pt-3 mt-3">
                            <h5 className="text-[9px] font-black uppercase text-indigo-500 mb-3 tracking-widest flex items-center gap-2">
                              <Pencil className="w-3 h-3" />
                              Ação de Edição (Opcional)
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="text-[9px] font-black uppercase text-neutral-400">Caso de Uso de Destino</label>
                                <select
                                  value={level.edit_usecase_slug || ''}
                                  onChange={e => {
                                    setConfig((prev: any) => {
                                      const newLevels = [...(prev.layout_config.mindmap_levels || [])];
                                      newLevels[lIdx].edit_usecase_slug = e.target.value;
                                      if (!newLevels[lIdx].edit_usecase_open_mode) {
                                        newLevels[lIdx].edit_usecase_open_mode = 'modal';
                                      }
                                      return { ...prev, layout_config: { ...prev.layout_config, mindmap_levels: newLevels } };
                                    });
                                  }}
                                  className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-200 outline-none mt-1"
                                >
                                  <option value="">{lIdx === 0 ? 'Formulário Padrão (Raiz)' : 'Nenhum (Selecione um Caso de Uso)'}</option>
                                  {useCases.filter((uc: any) => uc.model_id === level.model_id).map((uc: any) => (
                                    <option key={uc.slug} value={uc.slug}>{uc.name} ({uc.slug})</option>
                                  ))}
                                </select>
                                <p className="text-[9px] text-neutral-400 mt-1 italic">Qual caso de uso abrir ao clicar em Editar neste nível.</p>
                              </div>
                              <div>
                                <label className="text-[9px] font-black uppercase text-neutral-400">Modo de Abertura</label>
                                <select
                                  value={level.edit_usecase_open_mode || 'modal'}
                                  onChange={e => {
                                    setConfig((prev: any) => {
                                      const newLevels = [...(prev.layout_config.mindmap_levels || [])];
                                      newLevels[lIdx].edit_usecase_open_mode = e.target.value;
                                      const updatedLayout = { ...prev.layout_config, mindmap_levels: newLevels };
                                      if (lIdx === 0) {
                                        updatedLayout.action_interface_type = e.target.value;
                                      }
                                      return { ...prev, layout_config: updatedLayout };
                                    });
                                  }}
                                  disabled={lIdx > 0 && !level.edit_usecase_slug}
                                  className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-200 outline-none mt-1 disabled:opacity-50"
                                >
                                  <option value="modal">Modal Centralizado (Recomendado)</option>
                                  <option value="drawer">Drawer Lateral</option>
                                  <option value="page">Redirecionar Página</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {(!config.layout_config.mindmap_levels || config.layout_config.mindmap_levels.length === 0) && (
                    <div className="p-4 border-2 border-dashed border-purple-200 dark:border-purple-900/50 rounded-xl text-center bg-white dark:bg-neutral-900">
                      <p className="text-xs text-neutral-500">Nenhuma hierarquia definida. O mapa agrupará os dados base do modelo atual.</p>
                      <button
                        onClick={() => {
                          setConfig((prev: any) => ({
                            ...prev,
                            layout_config: {
                              ...prev.layout_config,
                              action_interface_type: prev.layout_config?.action_interface_type || 'modal',
                              mindmap_levels: [{
                                id: Math.random().toString(36).substr(2, 9),
                                model_id: config.selected_models?.[0] || '',
                                foreign_key: '',
                                relation_type: 'direct',
                                through_table: '',
                                through_local_fk: '',
                                through_target_fk: '',
                                title_field: '',
                                desc_field: '',
                                edit_usecase_slug: '',
                                edit_usecase_open_mode: 'modal'
                              }]
                            }
                          }));
                        }}
                        className="mt-3 px-4 py-2 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-[10px] font-black uppercase rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
                      >
                        Começar Hierarquia Relacional
                      </button>
                    </div>
                  )}

                  {(config.layout_config.mindmap_levels && config.layout_config.mindmap_levels.length > 0) && (
                    <button
                      onClick={() => {
                        setConfig((prev: any) => {
                          const newLevels = [...(prev.layout_config.mindmap_levels || [])];
                          newLevels.push({
                            id: Math.random().toString(36).substr(2, 9),
                            model_id: '',
                            foreign_key: '',
                            relation_type: 'direct',
                            through_table: '',
                            through_local_fk: '',
                            through_target_fk: '',
                            title_field: '',
                            desc_field: '',
                            edit_usecase_slug: '',
                            edit_usecase_open_mode: 'modal'
                          });
                          return { ...prev, layout_config: { ...prev.layout_config, mindmap_levels: newLevels } };
                        });
                      }}
                      className="w-full py-3 border-2 border-dashed border-neutral-200 dark:border-neutral-800 hover:border-purple-300 dark:hover:border-purple-700/50 rounded-xl text-neutral-500 hover:text-purple-600 dark:hover:text-purple-400 text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar Nível Abaixo
                    </button>
                  )}
                </div>
              </div>
            )}

            {config.logic_type === 'galeria' && (
              <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-[1.5rem] space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/20">
                      <LayoutGrid className="w-4 h-4" />
                    </div>
                    <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em]">Configuração da Galeria</h4>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Visualização de Imagem</label>
                  <div className="flex p-1 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm">
                    <button
                      type="button"
                      onClick={() => setConfig({
                        ...config,
                        layout_config: { ...config.layout_config, gallery_click_behavior: 'lightbox' }
                      })}
                      className={cn(
                        "flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                        (config.layout_config.gallery_click_behavior || 'lightbox') === 'lightbox' ? 'bg-indigo-600 text-white shadow-lg' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'
                      )}
                    >
                      Abrir na Modal (Lightbox)
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfig({
                        ...config,
                        layout_config: { ...config.layout_config, gallery_click_behavior: 'thumbnail' }
                      })}
                      className={cn(
                        "flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                        (config.layout_config.gallery_click_behavior || 'lightbox') === 'thumbnail' ? 'bg-indigo-600 text-white shadow-lg' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'
                      )}
                    >
                      Ver no próprio Thumbnail
                    </button>
                  </div>
                  <p className="text-[10px] text-neutral-400 font-medium italic ml-1">
                    Selecione "Ver no próprio Thumbnail" para exibir a imagem inteira (sem cortes) diretamente no card, desabilitando a modal de visualização ao clicar.
                  </p>
                </div>

                {/* CAMPOS DO CARD DA GALERIA */}
                <div className="space-y-3 border-t border-neutral-100 dark:border-neutral-800 pt-4 mt-6">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Campos do Card da Galeria</label>
                    <p className="text-[10px] text-neutral-500 ml-1 mt-0.5">Selecione quais campos aparecerão no corpo do card (opcional). Deixe vazio para usar apenas Título e Arquivo.</p>
                  </div>
                  <div className="flex gap-2 items-center">
                    <select
                      id="main_gallery_card_fields_select"
                      className="flex-1 px-4 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-[10px] font-bold outline-none focus:border-indigo-500"
                    >
                      <option value="">Adicionar campo...</option>
                      {(() => {
                        const rootId = config.selected_models[0];
                        const rootModel = models.find((m: any) => m.id === rootId);

                        const orderedModels = [
                          rootModel,
                          ...models.filter((m: any) => m.id !== rootId)
                        ].filter(Boolean);

                        return orderedModels.map((m: any) => {
                          const isMain = m.id === rootId;
                          const tName = m.db_table_name;
                          return (
                            <optgroup key={`opt-${m.id}`} label={`Tabela: ${tName}`} className="text-[10px] font-bold text-blue-600 dark:text-blue-400 normal-case">
                              {m.fields
                                .filter((f: any) => !(config.layout_config.gallery_config?.card_fields || []).includes(isMain ? f.db_column_name : `${tName}.${f.db_column_name}`))
                                .map((f: any) => (
                                  <option
                                    key={`${tName}-${f.id}`}
                                    value={isMain ? f.db_column_name : `${tName}.${f.db_column_name}`}
                                    className="text-neutral-800 dark:text-neutral-200 font-normal normal-case"
                                  >
                                    {String(f.db_column_name).toLowerCase()}
                                  </option>
                                ))}
                            </optgroup>
                          );
                        });
                      })()}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const select = document.getElementById('main_gallery_card_fields_select') as HTMLSelectElement;
                        if (select && select.value) {
                          const currentFields = config.layout_config.gallery_config?.card_fields || [];
                          setConfig({
                            ...config,
                            layout_config: {
                              ...config.layout_config,
                              gallery_config: {
                                ...(config.layout_config.gallery_config || {}),
                                card_fields: [...currentFields, select.value]
                              }
                            }
                          });
                          select.value = '';
                        }
                      }}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors"
                    >
                      + Add
                    </button>
                  </div>

                  {((config.layout_config.gallery_config?.card_fields?.length || 0) > 0) && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {config.layout_config.gallery_config?.card_fields.map((fieldCol: string, i: number) => {
                        let defaultLabel = fieldCol;
                        if (fieldCol.includes('.')) {
                          const [tName, cName] = fieldCol.split('.');
                          defaultLabel = `${tName} -> ${cName}`;
                        } else {
                          const fDef = models.find((m: any) => m.id === config.selected_models[0])?.fields.find((f: any) => f.db_column_name === fieldCol);
                          if (fDef) defaultLabel = fDef.display_name || fieldCol;
                        }

                        const currentLabel = config.layout_config.gallery_config?.card_fields_labels?.[fieldCol] || defaultLabel;

                        return (
                          <div key={`gcf-${i}`} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                            <input
                              type="text"
                              value={currentLabel}
                              onChange={(e) => {
                                setConfig({
                                  ...config,
                                  layout_config: {
                                    ...config.layout_config,
                                    gallery_config: {
                                      ...(config.layout_config.gallery_config || {}),
                                      card_fields_labels: {
                                        ...(config.layout_config.gallery_config?.card_fields_labels || {}),
                                        [fieldCol]: e.target.value
                                      }
                                    }
                                  }
                                });
                              }}
                              className="bg-transparent text-[10px] font-bold text-neutral-600 dark:text-neutral-400 focus:outline-none focus:border-indigo-500 border-b border-transparent hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors w-auto min-w-[80px]"
                              title="Clique para editar o label deste campo"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newFields = [...(config.layout_config.gallery_config?.card_fields || [])];
                                newFields.splice(i, 1);

                                const newLabels = { ...(config.layout_config.gallery_config?.card_fields_labels || {}) };
                                delete newLabels[fieldCol];

                                setConfig({
                                  ...config,
                                  layout_config: {
                                    ...config.layout_config,
                                    gallery_config: {
                                      ...(config.layout_config.gallery_config || {}),
                                      card_fields: newFields,
                                      card_fields_labels: newLabels
                                    }
                                  }
                                });
                              }}
                              className="text-neutral-400 hover:text-rose-500 transition-colors p-0.5 rounded-md hover:bg-rose-500/10"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
    </>
  )
}

