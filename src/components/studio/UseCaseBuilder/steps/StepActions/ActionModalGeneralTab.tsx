import React from 'react'
import { cn } from '@/lib/utils'
import DynamicIcon from '@/components/runtime/DynamicIcon'
import { IconPicker } from '../../../IconPicker'

interface ActionModalGeneralTabProps {
  editingAction: any
  setEditingAction: (action: any) => void
  isIconPickerOpen: boolean
  setIsIconPickerOpen: (open: boolean) => void
  t: (key: string, fallback?: string) => string
  config: any
  models: any[]
  useCases: any[]
  relations: any[]
}

export function ActionModalGeneralTab({
  editingAction,
  setEditingAction,
  isIconPickerOpen,
  setIsIconPickerOpen,
  t,
  config,
  models,
  useCases,
  relations
}: ActionModalGeneralTabProps) {
  const availableLocations = (() => {
    const locs = [];
    if (config.logic_type === 'pesquisa_cadastro') {
      const masterUc = useCases?.find((uc: any) => uc.slug === config.layout_config.master_use_case_slug);
      locs.push({ id: 'search', label: 'Tela de Pesquisa (Lista)', modelId: masterUc?.model_id || '', depth: 0 });
    }
    
    if (config.logic_type === 'pesquisa_cadastro' || config.logic_type === 'personalizado') {
      const rootId = config.layout_config.master_model_id || config.selected_models?.[0];
      const rootModel = models.find((m: any) => m.id === rootId);
      const masterLabel = (config.layout_config as any).master_tab_title || rootModel?.display_name || rootModel?.db_table_name || 'Mestre';
      locs.push({ id: 'master', label: `Aba Mestre (${masterLabel})`, modelId: rootId || '', depth: 0 });
    }

    if (config.logic_type === 'pesquisa_cadastro') {
      const rootId = config.layout_config.master_model_id || config.selected_models?.[0];
      const rootModel = models.find((m: any) => m.id === rootId);
      const maxDepth = config.layout_config?.max_relation_depth || 2;
      
      const buildTree = (modelId: string, depth: number, visited: Set<string>): any[] => {
        if (depth >= maxDepth + 1) return [];
        const childRelations = relations.filter((r: any) => r.to_model_id === modelId && !visited.has(r.from_model_id));
        return childRelations.map((r: any) => {
          const childModel = models.find((m: any) => m.id === r.from_model_id);
          if (!childModel) return null;
          const newVisited = new Set(visited);
          newVisited.add(r.from_model_id);
          return { ...childModel, children: buildTree(childModel.id, depth + 1, newVisited) };
        }).filter(Boolean);
      };
      
      const localFormTree = rootModel ? [{ ...rootModel, children: buildTree(rootId, 1, new Set([rootId])) }] : [];
      
      const modelHasFields = (node: any, isMaster: boolean = false) => {
        const formFields = config.layout_config?.form_fields || [];
        const fieldsOfThisModel = formFields.filter((fid: string) => {
          if (fid.startsWith('virt_')) {
            const meta = (config.layout_config?.fields_metadata || {})[fid] || {};
            return meta.virtual_model_id === node.id || (!meta.virtual_model_id && isMaster);
          }
          return node.fields?.some((f: any) => f.id === fid);
        });
        return fieldsOfThisModel.length > 0;
      };

      const traverseTree = (nodes: any[], currentDepth: number) => {
        nodes.forEach((node: any) => {
          if (currentDepth > 0) {
            const isUsed = modelHasFields(node, false);
            if (isUsed) {
              const typeLabel = currentDepth === 1 ? 'Aba Detalhe' : 'Aba Sub-Detalhe';
              const customTitle = (config.layout_config as any).details_tab_titles?.[node.id];
              const nodeLabel = customTitle || node.display_name || node.db_table_name || node.name;
              locs.push({ id: `detail:${node.id}`, label: `${typeLabel} (${nodeLabel})`, modelId: node.id, depth: currentDepth });
            }
          }
          if (node.children && Array.isArray(node.children)) {
            traverseTree(node.children, currentDepth + 1);
          }
        });
      };
      traverseTree(localFormTree, 0);
    }

    if (config.logic_type === 'personalizado') {
      (config.layout_config.custom_slots || []).forEach((slot: any) => {
        const slotUc = useCases?.find((uc: any) => uc.slug === slot.use_case_slug);
        locs.push({ id: `slot:${slot.id}`, label: `Aba ${slot.title} (${slotUc?.name || 'Desconhecido'})`, modelId: slotUc?.model_id || '', depth: 0 });
      });
    }
    return locs;
  })();

  const placements = editingAction.placements || [];

  const toggleContext = (locId: string, ctx: string) => {
    const currentPlacements = [...placements];
    const pIndex = currentPlacements.findIndex(p => p.location === locId);
    if (pIndex > -1) {
      const p = { ...currentPlacements[pIndex], contexts: [...currentPlacements[pIndex].contexts] };
      if (p.contexts.includes(ctx)) {
        p.contexts = p.contexts.filter((c: string) => c !== ctx);
        if (p.contexts.length === 0) {
          currentPlacements.splice(pIndex, 1);
        } else {
          currentPlacements[pIndex] = p;
        }
      } else {
        p.contexts.push(ctx);
        currentPlacements[pIndex] = p;
      }
    } else {
      currentPlacements.push({ location: locId, contexts: [ctx], group_fields: [] });
    }
    setEditingAction({ ...editingAction, placements: currentPlacements });
  };

  const toggleGroupField = (locId: string, field: string) => {
    const currentPlacements = [...placements];
    const pIndex = currentPlacements.findIndex(p => p.location === locId);
    if (pIndex > -1) {
      const p = { ...currentPlacements[pIndex], group_fields: [...(currentPlacements[pIndex].group_fields || [])] };
      if (p.group_fields.includes(field)) {
        p.group_fields = p.group_fields.filter((f: string) => f !== field);
      } else {
        p.group_fields.push(field);
      }
      currentPlacements[pIndex] = p;
      setEditingAction({ ...editingAction, placements: currentPlacements });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Left: Button properties */}
      <div className="lg:col-span-5 space-y-5">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.actions.button_name')}</label>
          <input
            type="text"
            value={editingAction.label}
            onChange={e => setEditingAction({ ...editingAction, label: e.target.value })}
            className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold focus:border-indigo-500 outline-none transition-all"
          />
        </div>

        <div className="space-y-2 relative">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.actions.icon')}</label>
          <button
            type="button"
            onClick={() => setIsIconPickerOpen(true)}
            className="w-full flex items-center justify-between bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 transition-all hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <div className="flex items-center gap-3">
              <DynamicIcon icon={editingAction.icon || 'Zap'} className="w-5 h-5 text-indigo-500" />
              <span>{editingAction.icon || t('wizard.actions.select_icon_placeholder')}</span>
            </div>
            <span className="text-[10px] uppercase text-neutral-400 font-bold">{t('wizard.actions.change')}</span>
          </button>
          {isIconPickerOpen && (
            <IconPicker
              currentIcon={editingAction.icon || 'Zap'}
              onSelect={(icon: string) => {
                setEditingAction({ ...editingAction, icon })
                setIsIconPickerOpen(false)
              }}
              onClose={() => setIsIconPickerOpen(false)}
            />
          )}
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.actions.color')}</label>
          <select
            value={editingAction.color}
            onChange={e => setEditingAction({ ...editingAction, color: e.target.value })}
            className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 transition-all"
          >
            <option value="indigo">{t('wizard.actions.colors.indigo', 'Indigo')}</option>
            <option value="emerald">{t('wizard.actions.colors.emerald', 'Emerald')}</option>
            <option value="red">{t('wizard.actions.colors.red', 'Red')}</option>
            <option value="amber">{t('wizard.actions.colors.amber', 'Amber')}</option>
            <option value="purple">{t('wizard.actions.colors.purple', 'Purple')}</option>
          </select>
        </div>
      </div>

      {/* Right: Context checkboxes */}
      <div className="lg:col-span-7 space-y-4">
        <div className="space-y-4">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">
            Locais de Renderização <span className="normal-case font-normal">(Seleção Múltipla)</span>
          </label>
          <div className="space-y-3 max-h-[55vh] overflow-y-auto custom-scrollbar pr-2 pb-2">
            {availableLocations.map(loc => {
              const p = placements.find((pl: any) => pl.location === loc.id);
              const isActive = !!p && p.contexts.length > 0;
              const isSearch = loc.id === 'search';
              
              const renderOptions = [];
              if (isSearch) {
                renderOptions.push({ value: 'global_top', label: 'Ação Global (Topo da Pesquisa)' });
                renderOptions.push({ value: 'row', label: 'Ação de Linha (Grid)' });
                renderOptions.push({ value: 'bulk', label: 'Ação em Massa (Multi-seleção)' });
              } else {
                renderOptions.push({ value: 'global_top', label: 'Ação Global (Topo)' });
                if (loc.id !== 'master') {
                  renderOptions.push({ value: 'row', label: 'Ação de Linha (Grid/Lista)' });
                }
                renderOptions.push({ value: 'field_group', label: 'Agrupado ao Campo' });
              }

              return (
                <div key={loc.id} style={{ marginLeft: loc.depth ? `${loc.depth * 1.5}rem` : '0' }} className={cn("border rounded-xl transition-all overflow-hidden relative", isActive ? "border-indigo-500 shadow-md ring-1 ring-indigo-500/20" : "border-neutral-200 dark:border-neutral-800")}>
                  {loc.depth > 0 && (
                    <div className={cn("absolute top-0 left-0 bottom-0 w-1", loc.depth === 1 ? "bg-amber-500 dark:bg-amber-700" : "bg-amber-400 dark:bg-amber-600")}></div>
                  )}
                  <div className={cn("p-3 flex items-center gap-3 bg-neutral-50 dark:bg-neutral-900")}>
                    <div className="flex-1 flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", isActive ? "bg-indigo-500" : "bg-neutral-300 dark:bg-neutral-700")} />
                      <span className={cn("text-xs font-bold", isActive ? "text-indigo-700 dark:text-indigo-400" : "text-neutral-600 dark:text-neutral-400")}>{loc.label}</span>
                    </div>
                  </div>
                  <div className="p-3 bg-white dark:bg-neutral-950 border-t border-neutral-100 dark:border-neutral-800 space-y-3">
                    <div className="grid grid-cols-1 gap-1.5">
                      {renderOptions.map(opt => {
                        const isChecked = p ? p.contexts.includes(opt.value) : false;
                        return (
                          <label key={opt.value} className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors border border-transparent hover:border-neutral-200 dark:hover:border-neutral-800">
                            <div
                              onClick={(e) => { e.preventDefault(); toggleContext(loc.id, opt.value); }}
                              className={cn(`w-4 h-4 rounded border-2 flex items-center justify-center transition-all cursor-pointer flex-shrink-0`, isChecked ? 'bg-indigo-600 border-indigo-600' : 'border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900')}
                            >
                              {isChecked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            <span className={cn("text-xs font-semibold", isChecked ? "text-neutral-900 dark:text-white" : "text-neutral-600 dark:text-neutral-400")}>{opt.label}</span>
                          </label>
                        );
                      })}
                    </div>

                    {p?.contexts.includes('field_group') && (
                      <div className="p-3 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-xl space-y-3 mt-2 animate-in fade-in slide-in-from-top-2">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black uppercase tracking-[0.1em] text-indigo-500">Campos Alvo</label>
                          <div className="max-h-40 overflow-y-auto custom-scrollbar border border-indigo-100 dark:border-indigo-900/30 rounded-lg bg-white dark:bg-neutral-950 p-2 space-y-1">
                            {(() => {
                              const targetModel = models.find((m: any) => m.id === loc.modelId);
                              if (!targetModel || !targetModel.fields || targetModel.fields.length === 0) {
                                return <p className="text-[10px] text-neutral-400 italic p-2">Nenhum campo encontrado no model.</p>;
                              }
                              return targetModel.fields.map((f: any) => {
                                const val = f.db_column_name;
                                const isChecked = p.group_fields?.includes(val) || false;
                                return (
                                  <label key={f.id} className="flex items-center gap-2 cursor-pointer group p-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-900 rounded-md">
                                    <input type="checkbox" checked={isChecked} onChange={() => toggleGroupField(loc.id, val)} className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900" />
                                    <span className="text-xs text-neutral-700 dark:text-neutral-300 group-hover:text-indigo-600 transition-colors truncate">{f.display_name || f.db_column_name}</span>
                                  </label>
                                );
                              });
                            })()}
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black uppercase tracking-[0.1em] text-indigo-500">Posição no Input</label>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => setEditingAction({ ...editingAction, group_position: 'left' })} className={cn("flex-1 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded-md transition-all border", (editingAction.group_position || 'right') === 'left' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-neutral-900 text-neutral-500 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50')}>Esquerda</button>
                            <button type="button" onClick={() => setEditingAction({ ...editingAction, group_position: 'right' })} className={cn("flex-1 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded-md transition-all border", (editingAction.group_position || 'right') === 'right' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-neutral-900 text-neutral-500 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50')}>Direita</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
