import React from 'react';
import {
  Settings2, EyeOff, Eye, ChevronDown, ChevronUp, Plus, Maximize2, Layout
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DroppableZone, SortableFieldChip } from './dnd';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { getModelsWithRelations } from '@/lib/relationPathFinder';

export interface StepLayoutModelZoneProps {
  model: any;
  depth?: number;
  index?: number;
  config: any;
  setConfig: (config: any) => void;
  models: any[];
  relations: any[];
  hiddenDetails: Set<string>;
  setHiddenDetails: React.Dispatch<React.SetStateAction<Set<string>>>;
  retractedModels: Set<string>;
  setRetractedModels: React.Dispatch<React.SetStateAction<Set<string>>>;
  setEditingFieldId: (id: string | null) => void;
  setEditingTabId: (id: string | null) => void;
  setEditingFieldZone: (zone: string | null) => void;
  setDrawerActiveTab: (tab: 'geral' | 'estilos' | 'logica') => void;
  setIsDrawerOpen: (isOpen: boolean) => void;
  toggleField: (fieldId: string, zone: string) => void;
  getFieldMeta: (fid: string, zone?: string | null) => any;
  getFieldName: (id: string) => string;
  t: (key: string, defaultText?: string) => string;
}

export function StepLayoutModelZone(props: StepLayoutModelZoneProps) {
  const {
    model, depth = 0, index = 0,
    config, setConfig, models, relations,
    hiddenDetails, setHiddenDetails,
    retractedModels, setRetractedModels,
    setEditingFieldId, setEditingTabId, setEditingFieldZone, setDrawerActiveTab, setIsDrawerOpen,
    toggleField, getFieldMeta, getFieldName, t
  } = props;

    const isMaster = depth === 0 && index === 0
    const fieldsOfThisModel = config.layout_config.form_fields.filter((fid: string) => {
      if (fid.startsWith('virt_')) {
        const meta = (config.layout_config.fields_metadata || {})[fid] || {};
        return meta.virtual_model_id === model.id || (!meta.virtual_model_id && isMaster);
      }
      return model.fields.some((f: any) => f.id === fid)
    })

    const tabsMeta = (config.layout_config as any).fields_metadata?.['form-TABS'] || (config.layout_config as any).fields_metadata?.['TABS']
    const tabStyles = {
      fontFamily: tabsMeta?.label?.font?.replace(' (Padrão)', ''),
      fontSize: tabsMeta?.label?.size ? (tabsMeta.label.size.includes('px') ? tabsMeta.label.size : `${tabsMeta.label.size}px`) : undefined,
      color: tabsMeta?.label?.color || undefined,
    }

    return (
      <div key={`${model.id}-${depth}-${index}`} className={cn("space-y-4", depth > 0 && "ml-8 border-l-2 border-dashed border-amber-200 dark:border-amber-900/30 pl-6 pb-4")}>
        <div className="flex items-center justify-between ml-1 pr-6">
          <div className="flex items-center gap-2">
            <div className={cn("w-1.5 h-4 rounded-full shadow-sm transition-colors duration-300", fieldsOfThisModel.length > 0 ? "bg-emerald-500 shadow-emerald-500/30" : (isMaster ? "bg-amber-600" : "bg-amber-400"))}></div>
            <div className="flex items-center gap-2 group relative">
              <span className={cn(
                "px-2 py-0.5 rounded-[4px] text-[8px] font-black uppercase tracking-widest",
                isMaster ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
              )}>
                {isMaster ? t('wizard.layout.master', 'Mestre') : depth === 1 ? t('wizard.layout.detail', 'Detalhe') : t('wizard.layout.subdetail', 'Sub-Detalhe')}
              </span>
              {isMaster ? (
                <input
                  type="text"
                  placeholder={model.display_name || model.db_table_name}
                  value={(config.layout_config as any).master_tab_title ?? (model.display_name || model.db_table_name)}
                  onChange={e => setConfig({
                    ...config,
                    layout_config: {
                      ...config.layout_config,
                      master_tab_title: e.target.value
                    }
                  })}
                  style={tabStyles}
                  className="bg-transparent border-none outline-none font-black tracking-widest text-neutral-600 dark:text-neutral-400 placeholder:text-neutral-300 dark:placeholder:text-neutral-700 w-[200px] hover:bg-neutral-100 dark:hover:bg-neutral-900 focus:bg-white dark:focus:bg-neutral-900 focus:ring-2 focus:ring-amber-500/20 rounded px-1.5 py-0.5 transition-all"
                />
              ) : (
                <input
                  type="text"
                  placeholder={model.display_name || model.db_table_name}
                  value={(config.layout_config as any).details_tab_titles?.[model.id] ?? (model.display_name || model.db_table_name)}
                  onChange={e => {
                    const currentTitles = (config.layout_config as any).details_tab_titles || {}
                    setConfig({
                      ...config,
                      layout_config: {
                        ...config.layout_config,
                        details_tab_titles: {
                          ...currentTitles,
                          [model.id]: e.target.value
                        }
                      }
                    })
                  }}
                  style={tabStyles}
                  className="bg-transparent border-none outline-none font-black tracking-widest text-neutral-600 dark:text-neutral-400 placeholder:text-neutral-300 dark:placeholder:text-neutral-700 w-[250px] hover:bg-neutral-100 dark:hover:bg-neutral-900 focus:bg-white dark:focus:bg-neutral-900 focus:ring-2 focus:ring-amber-500/20 rounded px-1.5 py-0.5 transition-all"
                />
              )}
              <button
                type="button"
                title="Configurar propriedades das abas"
                onClick={() => { setEditingFieldId('TABS'); setEditingTabId(isMaster ? 'master' : model.id); setEditingFieldZone('form'); setDrawerActiveTab('estilos'); setIsDrawerOpen(true); }}
                className="opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 p-1 bg-white dark:bg-neutral-900 rounded border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-indigo-600 hover:border-indigo-200 shadow-sm z-10"
              >
                <Settings2 className="w-3 h-3" />
              </button>
            </div>

            <button
              title={hiddenDetails.has(model.id) ? "Exibir formulário" : "Ocultar formulário"}
              onClick={() => {
                if (!hiddenDetails.has(model.id)) {
                  const fieldsToKeep = config.layout_config.form_fields.filter((fid: string) => !model.fields.some((f: any) => f.id === fid))
                  setConfig({
                    ...config,
                    layout_config: { ...config.layout_config, form_fields: fieldsToKeep }
                  })
                }
                setHiddenDetails(prev => {
                  const next = new Set(prev)
                  if (next.has(model.id)) next.delete(model.id)
                  else next.add(model.id)
                  return next
                })
              }}
              className="ml-2 p-1.5 text-neutral-400 hover:text-amber-600 dark:hover:text-amber-500 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-sm transition-all"
            >
              {hiddenDetails.has(model.id) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>

            {!isMaster && (
              <button
                type="button"
                title={retractedModels.has(model.id) ? "Expandir" : "Retrair"}
                onClick={() => {
                  setRetractedModels(prev => {
                    const next = new Set(prev)
                    if (next.has(model.id)) next.delete(model.id)
                    else next.add(model.id)
                    return next
                  })
                }}
                className="ml-2 p-1.5 text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-500 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-sm transition-all"
              >
                {retractedModels.has(model.id) ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>

          {!isMaster && !hiddenDetails.has(model.id) && (
            <div className="flex items-center gap-1">
              {/* Abas/Seções Toggle */}
              <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-950 p-0.5 rounded-lg border border-neutral-200 dark:border-neutral-800">
                {[
                  { id: 'tabs', label: 'Aba', tooltip: 'Exibe os registros deste detalhe em uma aba superior' },
                  { id: 'sections', label: 'Seção', tooltip: 'Exibe os registros deste detalhe em uma seção empilhada na página' }
                ].map(opt => {
                  const currentMode = (config.layout_config as any).details_display_mode?.[model.id] || 'sections'
                  const isActive = currentMode === opt.id
                  return (
                    <button
                      key={opt.id}
                      title={opt.tooltip}
                      onClick={() => {
                        const currentModes = (config.layout_config as any).details_display_mode || {}
                        setConfig({
                          ...config,
                          layout_config: {
                            ...config.layout_config,
                            details_display_mode: {
                              ...currentModes,
                              [model.id]: opt.id
                            }
                          }
                        })
                      }}
                      className={cn(
                        "px-3 py-1 rounded-md text-[8px] font-black uppercase tracking-widest transition-all",
                        isActive
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                          : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'
                      )}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>

              {/* Modal/Drawer Toggle */}
              <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-950 p-0.5 rounded-lg border border-neutral-200 dark:border-neutral-800 ml-1">
                {[
                  { id: 'modal', label: 'Modal', icon: Maximize2, tooltip: 'Abre o formulário deste detalhe em uma janela central' },
                  { id: 'drawer', label: 'Drawer', icon: Layout, tooltip: 'Abre o formulário deste detalhe em uma gaveta lateral' }
                ].map(opt => {
                  const currentType = (config.layout_config as any).details_interface_types?.[model.id] || 'modal'
                  const isActive = currentType === opt.id
                  return (
                    <button
                      key={opt.id}
                      title={opt.tooltip}
                      onClick={() => {
                        const currentTypes = (config.layout_config as any).details_interface_types || {}
                        setConfig({
                          ...config,
                          layout_config: {
                            ...config.layout_config,
                            details_interface_types: {
                              ...currentTypes,
                              [model.id]: opt.id
                            }
                          }
                        })
                      }}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1 rounded-md text-[8px] font-black uppercase tracking-widest transition-all",
                        isActive
                          ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20'
                          : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'
                      )}
                    >
                      <opt.icon className="w-2.5 h-2.5" />
                      {opt.label}
                    </button>
                  )
                })}
              </div>

              {((config.layout_config as any).details_interface_types?.[model.id] || 'modal') === 'modal' && (
                <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-950 p-0.5 rounded-lg border border-neutral-200 dark:border-neutral-800 ml-1">
                  <select
                    value={(config.layout_config as any).details_modal_sizes?.[model.id] || 'md'}
                    onChange={(e) => {
                      const currentSizes = (config.layout_config as any).details_modal_sizes || {}
                      setConfig({
                        ...config,
                        layout_config: {
                          ...config.layout_config,
                          details_modal_sizes: {
                            ...currentSizes,
                            [model.id]: e.target.value
                          }
                        }
                      })
                    }}
                    className="bg-transparent border-none outline-none text-[8px] font-black uppercase tracking-wider text-neutral-600 dark:text-neutral-400 px-2 h-full cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800"
                    title="Tamanho da Modal"
                  >
                    <option value="sm" title="Pequeno (max. 384px)">SM</option>
                    <option value="md" title="Médio (max. 672px) - Padrão">MD</option>
                    <option value="lg" title="Grande (max. 896px)">LG</option>
                    <option value="full" title="Tela Cheia (95% da tela)">FULL</option>
                    <option value="custom" title="Personalizado (em pixels ou %)">CUST</option>
                  </select>

                  {((config.layout_config as any).details_modal_sizes?.[model.id] === 'custom') && (
                    <div className="flex items-center gap-1 ml-1 px-1 border-l border-neutral-200 dark:border-neutral-800">
                      <input
                        type="text"
                        placeholder="Largura"
                        value={(config.layout_config as any).details_modal_widths?.[model.id] || ''}
                        onChange={(e) => {
                          const currentWidths = (config.layout_config as any).details_modal_widths || {}
                          setConfig({
                            ...config,
                            layout_config: {
                              ...config.layout_config,
                              details_modal_widths: {
                                ...currentWidths,
                                [model.id]: e.target.value
                              }
                            }
                          })
                        }}
                        className="w-14 bg-transparent border-none outline-none text-[8px] font-bold text-neutral-600 dark:text-neutral-400 placeholder-neutral-400 dark:placeholder-neutral-600"
                        title="Ex: 800px, 90%"
                      />
                      <span className="text-[8px] font-black text-neutral-400">x</span>
                      <input
                        type="text"
                        placeholder="Altura"
                        value={(config.layout_config as any).details_modal_heights?.[model.id] || ''}
                        onChange={(e) => {
                          const currentHeights = (config.layout_config as any).details_modal_heights || {}
                          setConfig({
                            ...config,
                            layout_config: {
                              ...config.layout_config,
                              details_modal_heights: {
                                ...currentHeights,
                                [model.id]: e.target.value
                              }
                            }
                          })
                        }}
                        className="w-14 bg-transparent border-none outline-none text-[8px] font-bold text-neutral-600 dark:text-neutral-400 placeholder-neutral-400 dark:placeholder-neutral-600"
                        title="Ex: 600px, auto"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-950 p-0.5 rounded-lg border border-neutral-200 dark:border-neutral-800 ml-2">
                <button
                  title="Lista os registros deste detalhe de forma expandida diretamente na mesma página"
                  onClick={() => {
                    const currentInlines = (config.layout_config as any).details_inline_types || {}
                    const isCurrentlyInline = currentInlines[model.id] !== false // Default true

                    setConfig({
                      ...config,
                      layout_config: {
                        ...config.layout_config,
                        details_inline_types: {
                          ...currentInlines,
                          [model.id]: !isCurrentlyInline
                        }
                      }
                    })
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1 rounded-md text-[8px] font-black uppercase tracking-widest transition-all",
                    ((config.layout_config as any).details_inline_types?.[model.id] !== false)
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                      : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'
                  )}
                >
                  <div className={cn(
                    "w-1 h-1 rounded-full",
                    ((config.layout_config as any).details_inline_types?.[model.id] !== false) ? "bg-white" : "bg-neutral-400"
                  )} />
                  Na lista
                </button>
              </div>

              {((config.layout_config as any).details_inline_types?.[model.id] !== false) && (
                <div className="flex items-center ml-2 border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden h-6 bg-white dark:bg-neutral-900">
                  <select
                    value={(config.layout_config as any).details_item_titles?.[model.id] || ''}
                    onChange={(e) => {
                      const currentItemTitles = (config.layout_config as any).details_item_titles || {}
                      setConfig({
                        ...config,
                        layout_config: {
                          ...config.layout_config,
                          details_item_titles: {
                            ...currentItemTitles,
                            [model.id]: e.target.value
                          }
                        }
                      })
                    }}
                    className="bg-transparent border-none outline-none text-[8px] font-black uppercase tracking-wider text-neutral-600 dark:text-neutral-400 px-2 h-full cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800"
                    title="Campo usado como título do item recolhido"
                  >
                    <option value="">Título Automático</option>
                    {getModelsWithRelations([model], relations, models, config.layout_config?.max_relation_depth || 2).map((g: any, i: number) => (
                      <optgroup key={i} label={g.label} className="text-[10px] font-bold text-blue-600 dark:text-blue-400 normal-case">
                        {g.model.fields?.map((f: any) => {
                          const val = g.prefix ? `${g.prefix}${f.db_column_name}` : f.db_column_name;
                          return (
                            <option key={f.id} value={val} className="text-neutral-800 dark:text-neutral-200 normal-case">
                              {String(f.db_column_name).toLowerCase()}
                            </option>
                          )
                        })}
                      </optgroup>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {!hiddenDetails.has(model.id) && !retractedModels.has(model.id) && (
          <DroppableZone
            id={`droppable-form-${model.id}`}
            className="grid grid-cols-7 gap-3 min-h-[100px] p-6 bg-neutral-50 dark:bg-neutral-950/30 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] items-start transition-all hover:bg-neutral-100/50 dark:hover:bg-neutral-900/40"
          >
            {fieldsOfThisModel.length === 0 ? (
              <div className="col-span-7 flex flex-col items-center justify-center py-4 space-y-2 opacity-50">
                <Plus className="w-4 h-4 text-neutral-400" />
                <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Arraste campos de "{model.display_name || model.db_table_name}" para cá</p>
              </div>
            ) : (
              <SortableContext items={fieldsOfThisModel.map((id: string) => `form-${id}`)} strategy={rectSortingStrategy}>
                {fieldsOfThisModel.map((id: string) => (
                  <SortableFieldChip
                    key={`form-${id}`}
                    id={`form-${id}`}
                    itemValue={id}
                    toggleField={toggleField}
                    zoneType="form"
                    onEdit={() => { setEditingFieldId(id); setEditingFieldZone('form'); setIsDrawerOpen(true); }}
                  >
                    <span
                      style={{
                        fontFamily: getFieldMeta(id, 'form').label?.font,
                        fontSize: getFieldMeta(id, 'form').label?.size,
                        color: getFieldMeta(id, 'form').label?.color || undefined
                      }}
                      className={cn(
                        "text-[10px] font-black tracking-wider",
                        !getFieldMeta(id, 'form').label?.font && "uppercase"
                      )}
                    >
                      {getFieldMeta(id, 'form').label?.text || getFieldName(id)}
                    </span>
                  </SortableFieldChip>
                ))}
              </SortableContext>
            )}
          </DroppableZone>
        )}
        {(!hiddenDetails.has(model.id)) && !retractedModels.has(model.id) && model.children && model.children.length > 0 && (
          <div className="pt-2">
            {model.children.map((child: any, cIdx: number) => <StepLayoutModelZone key={child.id || cIdx} model={child} depth={depth + 1} index={cIdx} config={config} setConfig={setConfig} models={models} relations={relations} hiddenDetails={hiddenDetails} setHiddenDetails={setHiddenDetails} retractedModels={retractedModels} setRetractedModels={setRetractedModels} setEditingFieldId={setEditingFieldId} setEditingTabId={setEditingTabId} setEditingFieldZone={setEditingFieldZone} setDrawerActiveTab={setDrawerActiveTab} setIsDrawerOpen={setIsDrawerOpen} toggleField={toggleField} getFieldMeta={getFieldMeta} getFieldName={getFieldName} t={t} />)}
          </div>
        )}
      </div>
    )
}
