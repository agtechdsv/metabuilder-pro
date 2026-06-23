import { cn } from '@/lib/utils'
import { Eye, EyeOff, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { DroppableZone, SortableFieldChip } from './dnd'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { StepLayoutModelZone } from './StepLayoutModelZone'

export function FieldZones({
  config, setConfig, models, toggleZone, hiddenZones, setHiddenZones, expandedZones, t, toggleField, setEditingFieldId, setEditingFieldZone, setIsDrawerOpen, getFieldMeta, getFieldName, formTree, relations, hiddenDetails, setHiddenDetails, retractedModels, setRetractedModels, setEditingTabId, setDrawerActiveTab
}: any) {
  return (
    <>
            {(config.logic_type.includes('pesquisa') ||
              config.logic_type === 'kanban' ||
              config.logic_type === 'mapa_mental' ||
              config.logic_type === 'master_detail' ||
              config.logic_type === 'scheduler' ||
              config.logic_type === 'galeria' ||
              config.logic_type === 'timeline' ||
              config.logic_type === 'gantt' ||
              config.logic_type === 'blueprint' ||
              config.logic_type === 'map' ||
              config.logic_type === 'personalizado' ||
              config.logic_type === 'analytics') && (
                <div className="p-4 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-[1.5rem] space-y-3 shadow-sm overflow-hidden transition-all duration-300">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => toggleZone('zone01')}
                  >
                    <div className="flex items-center gap-3">
                      <h4 className={cn("text-[9px] font-black uppercase tracking-[0.3em] transition-all", hiddenZones.has('zone01') ? "text-neutral-400" : "text-indigo-600")}>{t('wizard.layout.zones.zone_01')}: {t('wizard.layout.zones.filter')}</h4>
                      <span className="px-3 py-1 bg-indigo-500/10 text-indigo-600 rounded-full text-[9px] font-black tracking-widest">{config.layout_config.filter_fields.length} {t('dashboard.projects.studio.fields_count')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-indigo-50/50 dark:bg-indigo-900/20 px-2 py-1 rounded-lg border border-indigo-100 dark:border-indigo-900/50" onClick={e => e.stopPropagation()}>
                        <span className="text-[8px] font-bold text-indigo-500 uppercase tracking-widest">{t('wizard.layout.zones.grid_cols', 'GRID')}</span>
                        <select
                          value={config.layout_config.filter_grid_columns || '12'}
                          onChange={e => setConfig({ ...config, layout_config: { ...config.layout_config, filter_grid_columns: e.target.value }})}
                          className="bg-transparent text-[9px] font-black text-indigo-600 outline-none cursor-pointer"
                        >
                          <option value="1">1 COL</option>
                          <option value="2">2 COLS</option>
                          <option value="3">3 COLS</option>
                          <option value="4">4 COLS</option>
                          <option value="5">5 COLS</option>
                          <option value="6">6 COLS</option>
                          <option value="7">7 COLS</option>
                          <option value="8">8 COLS</option>
                          <option value="9">9 COLS</option>
                          <option value="10">10 COLS</option>
                          <option value="11">11 COLS</option>
                          <option value="12">12 COLS (PADRÃO)</option>
                        </select>
                      </div>
                      {config.layout_config.filter_fields.length > 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfig({ ...config, layout_config: { ...config.layout_config, filter_fields: [] } }) }}
                          className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                          title={t('common.clear_all', 'Limpar Tudo')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!hiddenZones.has('zone01')) {
                            setConfig({ ...config, layout_config: { ...config.layout_config, filter_fields: [] } })
                          }
                          setHiddenZones((prev: any) => { const n = new Set(prev); n.has('zone01') ? n.delete('zone01') : n.add('zone01'); return n; })
                        }}
                        className="p-1.5 text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-500 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-sm transition-all"
                        title={hiddenZones.has('zone01') ? "Exibir Zona" : "Ocultar Zona"}
                      >
                        {hiddenZones.has('zone01') ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <div className="p-1 text-indigo-600">
                        {expandedZones.zone01 ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {expandedZones.zone01 && !hiddenZones.has('zone01') && (
                    <div className="pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                      <DroppableZone id="droppable-filter" className="grid grid-cols-7 gap-3 min-h-[80px] p-6 bg-neutral-50 dark:bg-neutral-950/30 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-[2rem] items-start">
                        {config.layout_config.filter_fields.length === 0 ? (
                          <p className="text-xs text-neutral-400 font-medium w-full text-center italic">{t('wizard.layout.subtitle')}</p>
                        ) : (
                          <SortableContext items={config.layout_config.filter_fields.map((id: string) => `filter-${id}`)} strategy={rectSortingStrategy}>
                            {config.layout_config.filter_fields.map((id: string) => (
                              <SortableFieldChip
                                key={`filter-${id}`}
                                id={`filter-${id}`}
                                itemValue={id}
                                toggleField={toggleField}
                                zoneType="filter"
                                onEdit={() => { setEditingFieldId(id); setEditingFieldZone('filter'); setIsDrawerOpen(true); }}
                              >
                                <span
                                  style={{
                                    fontFamily: getFieldMeta(id, 'filter').label?.font,
                                    fontSize: getFieldMeta(id, 'filter').label?.size,
                                    color: getFieldMeta(id, 'filter').label?.color || undefined
                                  }}
                                  className={cn(
                                    "text-[10px] font-black tracking-wider",
                                    !getFieldMeta(id, 'filter').label?.font && "uppercase"
                                  )}
                                >
                                  {getFieldMeta(id, 'filter').label?.text || getFieldName(id)}
                                </span>
                              </SortableFieldChip>
                            ))}
                          </SortableContext>
                        )}
                      </DroppableZone>
                    </div>
                  )}
                </div>
              )}

            {/* ZONA: GRID */}
            {config.logic_type !== 'timeline' && config.logic_type !== 'map' && config.logic_type !== 'gantt' && config.logic_type !== 'cadastro' && (
              <div className="p-4 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-[1.5rem] space-y-3 shadow-sm">
                <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleZone('zone02')}>
                  <div className="space-y-1">
                    <h4 className={cn("text-[9px] font-black uppercase tracking-[0.3em] transition-all", hiddenZones.has('zone02') ? "text-neutral-400" : "text-emerald-600")}>
                      {config.logic_type === 'kanban' ? t('wizard.layout.zones.kanban_card', 'Campos do Card') : config.logic_type === 'mapa_mental' ? t('wizard.layout.zones.mindmap_nodes', 'Campos do Mapa (Níveis)') : `${t('wizard.layout.zones.zone_02')}: ${t('wizard.layout.zones.grid')}`}
                    </h4>
                    {config.logic_type !== 'kanban' && config.logic_type !== 'mapa_mental' && config.logic_type !== 'galeria' && (
                      <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-950 p-0.5 rounded-lg w-fit" onClick={e => e.stopPropagation()}>
                        {[
                          { id: 'list', label: t('wizard.layout.display_options.list') },
                          { id: 'card', label: t('wizard.layout.display_options.card') },
                          { id: 'both', label: t('wizard.layout.display_options.both') }
                        ].map(opt => (
                          <button
                            key={opt.id}
                            onClick={() => setConfig({
                              ...config,
                              layout_config: { ...config.layout_config, display_type: opt.id }
                            })}
                            className={cn(
                              "px-3 py-1 rounded-md text-[8px] font-black uppercase tracking-widest transition-all",
                              (config.layout_config.display_type || 'list') === opt.id
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                                : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-full text-[9px] font-black tracking-widest">{config.layout_config.grid_fields.length} {t('dashboard.projects.studio.fields_count')}</span>
                    {config.layout_config.grid_fields.length > 0 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfig({ ...config, layout_config: { ...config.layout_config, grid_fields: [] } }) }}
                        className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                        title={t('common.clear_all', 'Limpar Tudo')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!hiddenZones.has('zone02')) {
                          setConfig({ ...config, layout_config: { ...config.layout_config, grid_fields: [] } })
                        }
                        setHiddenZones((prev: any) => { const n = new Set(prev); n.has('zone02') ? n.delete('zone02') : n.add('zone02'); return n; })
                      }}
                      className="p-1.5 text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-500 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-sm transition-all"
                      title={hiddenZones.has('zone02') ? "Exibir Zona" : "Ocultar Zona"}
                    >
                      {hiddenZones.has('zone02') ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <div className="p-1 text-emerald-600">
                      {expandedZones.zone02 ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {expandedZones.zone02 && !hiddenZones.has('zone02') && (
                  <div className="pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <DroppableZone id="droppable-grid" className="grid grid-cols-7 gap-3 min-h-[100px] p-6 bg-neutral-50 dark:bg-neutral-950/30 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-[2rem] items-start">
                      {config.layout_config.grid_fields.length === 0 ? (
                        <p className="text-xs text-neutral-400 font-medium w-full text-center italic">{t('wizard.layout.subtitle')}</p>
                      ) : (
                        <SortableContext items={config.layout_config.grid_fields.map((id: string) => `grid-${id}`)} strategy={rectSortingStrategy}>
                          {config.layout_config.grid_fields.map((id: string) => (
                            <SortableFieldChip
                              key={`grid-${id}`}
                              id={`grid-${id}`}
                              itemValue={id}
                              toggleField={toggleField}
                              zoneType="grid"
                              onEdit={() => { setEditingFieldId(id); setEditingFieldZone('grid'); setIsDrawerOpen(true); }}
                            >
                              <span
                                style={{
                                  fontFamily: getFieldMeta(id, 'grid').label?.font,
                                  fontSize: getFieldMeta(id, 'grid').label?.size,
                                  color: getFieldMeta(id, 'grid').label?.color || undefined
                                }}
                                className={cn(
                                  "text-[10px] font-black tracking-wider",
                                  !getFieldMeta(id, 'grid').label?.font && "uppercase"
                                )}
                              >
                                {getFieldMeta(id, 'grid').label?.text || getFieldName(id)}
                              </span>
                            </SortableFieldChip>
                          ))}
                        </SortableContext>
                      )}
                    </DroppableZone>
                  </div>
                )}
              </div>
            )}

            {/* ZONA: FORMULÃƒÂRIO (RECURSIVO) */}
            {(config.logic_type.includes('cadastro') ||
              config.logic_type === 'master_detail' ||
              config.logic_type === 'kanban' ||
              config.logic_type === 'timeline' ||
              config.logic_type === 'map' ||
              config.logic_type === 'gantt' ||
              config.logic_type === 'scheduler' ||
              config.logic_type === 'mapa_mental' ||
              config.logic_type === 'galeria' ||
              config.logic_type === 'personalizado') && (
                <div className="p-4 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-[1.5rem] space-y-4 shadow-sm overflow-hidden transition-all duration-300">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => toggleZone('zone03')}
                  >
                    <div className="flex items-center gap-3">
                      <h4 className={cn("text-[9px] font-black uppercase tracking-[0.3em] transition-all", hiddenZones.has('zone03') ? "text-neutral-400" : "text-amber-600")}>{config.logic_type === 'cadastro' ? t('wizard.layout.zones.zone_01') : t('wizard.layout.zones.zone_03')}: {t('wizard.layout.zones.form')}</h4>
                      <span className="px-3 py-1 bg-amber-500/10 text-amber-600 rounded-full text-[9px] font-black tracking-widest">{config.layout_config.form_fields.length} {t('dashboard.projects.studio.fields_count')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {config.layout_config.form_fields.length > 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfig({ ...config, layout_config: { ...config.layout_config, form_fields: [] } }) }}
                          className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                          title={t('common.clear_all', 'Limpar Tudo')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!hiddenZones.has('zone03')) {
                            setConfig({ ...config, layout_config: { ...config.layout_config, form_fields: [] } })
                          }
                          setHiddenZones((prev: any) => { const n = new Set(prev); n.has('zone03') ? n.delete('zone03') : n.add('zone03'); return n; })
                        }}
                        className="p-1.5 text-neutral-400 hover:text-amber-600 dark:hover:text-amber-500 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-sm transition-all"
                        title={hiddenZones.has('zone03') ? "Exibir Zona" : "Ocultar Zona"}
                      >
                        {hiddenZones.has('zone03') ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <div className="p-1 text-amber-600">
                        {expandedZones.zone03 ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {expandedZones.zone03 && !hiddenZones.has('zone03') && (
                    <div className="space-y-6 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                      {formTree.map((node: any, nIdx: number) => <StepLayoutModelZone key={node.id || nIdx} model={node} depth={0} index={nIdx} config={config} setConfig={setConfig} models={models} relations={relations} hiddenDetails={hiddenDetails} setHiddenDetails={setHiddenDetails} retractedModels={retractedModels} setRetractedModels={setRetractedModels} setEditingFieldId={setEditingFieldId} setEditingTabId={setEditingTabId} setEditingFieldZone={setEditingFieldZone} setDrawerActiveTab={setDrawerActiveTab} setIsDrawerOpen={setIsDrawerOpen} toggleField={toggleField} getFieldMeta={getFieldMeta} getFieldName={getFieldName} t={t} />)}
                    </div>
                  )}
                </div>
              )}

            <div className="space-y-6 mt-8">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Configurações do Formulário</label>
              <div className="p-6 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] space-y-4 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Título do Formulário (Opcional)</label>
                    <input
                      type="text"
                      placeholder="Ex: Editar Registro"
                      value={(config.layout_config as any).form_header_title || ''}
                      onChange={e => setConfig({
                        ...config,
                        layout_config: { ...config.layout_config, form_header_title: e.target.value }
                      })}
                      className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-[10px] font-bold outline-none focus:border-indigo-500 transition-all"
                    />
                    <p className="text-[9px] text-neutral-400 mt-1 italic">Sobrescreve o título padrão do formulário (ex: "Editar", "Novo"). Suporta tradução se usar chaves de dicionário.</p>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Campo de Subtítulo (Opcional)</label>
                    <select
                      value={(config.layout_config as any).form_header_subtitle_field || ''}
                      onChange={e => setConfig({
                        ...config,
                        layout_config: { ...config.layout_config, form_header_subtitle_field: e.target.value }
                      })}
                      className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-[10px] font-bold outline-none focus:border-indigo-500 transition-all"
                    >
                      <option value="">Padrão (Exibe o ID do registro)</option>
                      {models.filter((m: any) => config.selected_models.includes(m.id)).flatMap((m: any) => m.fields).map((f: any) => (
                        <option key={`opt-sub-${f.id}`} value={f.db_column_name}>
                          {getFieldName(f.id)} ({f.data_type})
                        </option>
                      ))}
                    </select>
                    <p className="text-[9px] text-neutral-400 mt-1 italic">Substitui a exibição do ID do registro pelo valor deste campo no formulário.</p>
                  </div>
                </div>
              </div>
            </div>
    </>
  )
}

