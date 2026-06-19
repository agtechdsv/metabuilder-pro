import React from "react";
import { Check, Box, X } from "lucide-react";

export function TriggerPropertiesPanel(props: any) {
  const { selectedNode, updateNodeData, dbModels, dbFields, localViews, setLocalViews, currentWorkflowId, supabase, toast, t } = props;
  const triggerTypes = (selectedNode.data?.triggerType as string[]) || (selectedNode.data?.triggerType ? [selectedNode.data?.triggerType as string] : []);
                  const requiresModel = triggerTypes.some(t => ['insert', 'update', 'delete'].includes(t));
  const hasUpdate = triggerTypes.includes('update');

  return (
    <>
                  <div className="space-y-4 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
                    <h4 className="text-xs font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                      {t('bpm.canvas.trigger_config')}
                    </h4>
                    
                    <div>
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-2">{t('bpm.canvas.events_multi')}</label>
                      <div className="space-y-2">
                        {[
                          { id: 'insert', label: t('bpm.nodes.on_insert') },
                          { id: 'update', label: t('bpm.nodes.on_update') },
                          { id: 'delete', label: t('bpm.nodes.on_delete') },
                          { id: 'scheduled', label: t('bpm.canvas.scheduled_cron') },
                          { id: 'webhook', label: t('bpm.canvas.webhook_inbound', 'Webhook Inbound') }
                        ].map(evt => {
                          const isChecked = triggerTypes.includes(evt.id);
                          return (
                            <label key={evt.id} className="flex items-center gap-2 cursor-pointer group">
                              <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${isChecked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-neutral-300 dark:border-neutral-700 group-hover:border-emerald-500'}`}>
                                {isChecked && <Check className="w-3 h-3" />}
                              </div>
                              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors">{evt.label}</span>
                              <input 
                                type="checkbox"
                                className="hidden"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    updateNodeData(selectedNode.id, { triggerType: [...triggerTypes, evt.id] });
                                  } else {
                                    updateNodeData(selectedNode.id, { triggerType: triggerTypes.filter(t => t !== evt.id) });
                                  }
                                }}
                              />
                            </label>
                          )
                        })}
                      </div>
                    </div>

                    {requiresModel && (
                      <div>
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">{t('bpm.canvas.target_table')}</label>
                        <select 
                          value={(selectedNode.data?.triggerModelId as string) || ''} 
                          onChange={(e) => updateNodeData(selectedNode.id, { triggerModelId: e.target.value, triggerField: '' })}
                          className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500"
                        >
                          <option value="">{t('bpm.canvas.select_table')}</option>
                          {dbModels.map((m: any) => (
                            <option key={m.id} value={m.id}>{m.display_name || m.db_table_name || m.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {hasUpdate && (
                      <>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-0">{t('bpm.canvas.restrict_to_field')}</label>
                            <input 
                              type="checkbox" 
                              checked={!!selectedNode.data?.triggerSpecificField}
                              onChange={(e) => updateNodeData(selectedNode.id, { triggerSpecificField: e.target.checked })}
                              className="rounded bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-emerald-500 focus:ring-emerald-500" 
                            />
                          </div>
                        </div>

                        {selectedNode.data?.triggerSpecificField && (
                          <div className="space-y-4 pt-2 border-t border-emerald-500/20 mt-4">
                            <div>
                              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">{t('bpm.canvas.which_field')}</label>
                              <select 
                                value={(selectedNode.data?.triggerField as string) || ''} 
                                onChange={(e) => updateNodeData(selectedNode.id, { triggerField: e.target.value })}
                                disabled={!selectedNode.data?.triggerModelId}
                                className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                              >
                                <option value="">{t('bpm.canvas.select_field')}</option>
                                {dbFields
                                  .filter((f: any) => f.model_id === selectedNode.data?.triggerModelId)
                                  .map((f: any) => (
                                    <option key={f.id} value={f.db_column_name || f.name}>{f.display_name || f.db_column_name || f.name}</option>
                                  ))}
                              </select>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">{t('bpm.canvas.from_optional')}</label>
                                <input 
                                  type="text" 
                                  placeholder={t('bpm.canvas.any')}
                                  value={(selectedNode.data?.triggerFromValue as string) || ''} 
                                  onChange={(e) => updateNodeData(selectedNode.id, { triggerFromValue: e.target.value })}
                                  className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">{t('bpm.canvas.to_optional')}</label>
                                <input 
                                  type="text" 
                                  placeholder={t('bpm.canvas.any')}
                                  value={(selectedNode.data?.triggerToValue as string) || ''} 
                                  onChange={(e) => updateNodeData(selectedNode.id, { triggerToValue: e.target.value })}
                                  className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {(() => {
                      const useCasesWithActions = localViews
                        .map((v: any) => ({
                          ...v,
                          layout_config: typeof v.layout_config === 'string' ? JSON.parse(v.layout_config) : (v.layout_config || {})
                        }))
                        .filter((v: any) => v.layout_config?.custom_actions && Array.isArray(v.layout_config.custom_actions) && v.layout_config.custom_actions.length > 0)
                        .map((v: any) => ({
                          id: v.id,
                          name: v.name,
                          actions: v.layout_config.custom_actions.map((act: any) => {
                            const activeContexts: string[] = act.contexts
                              ? (Array.isArray(act.contexts) ? act.contexts : [act.contexts])
                              : (act.context ? [act.context] : ['row']);
                            
                            const contextLabels = activeContexts.map(c => {
                              if (c === 'row') return t('wizard.actions.contexts.row');
                              if (c === 'bulk') return t('wizard.actions.contexts.bulk');
                              if (c === 'master_top') return t('wizard.actions.contexts.master_top');
                              if (c === 'detail_top') return t('wizard.actions.contexts.detail_top');
                              if (c === 'detail_row') return t('wizard.actions.contexts.detail_row');
                              if (c === 'form') return t('wizard.actions.contexts.field_group');
                              return c;
                            }).join(', ');

                            return {
                              id: act.id || act.label,
                              name: act.label || t('bpm.canvas.action_no_name', 'Ação Sem Nome'),
                              context: contextLabels || t('bpm.canvas.action_global', 'Ação Global'),
                              icon: act.icon || 'Zap',
                              color: act.color || 'indigo',
                              linked_workflows: act.linked_bpm_workflows || []
                            }
                          })
                        }));

                      const toggleCustomAction = async (viewId: string, actId: string) => {
                        if (!currentWorkflowId || currentWorkflowId === 'new') {
                          toast(t('bpm.canvas.toasts.save_flow_first', 'Salve o fluxo primeiro antes de vincular botões.'), 'error');
                          return;
                        }

                        // Encontra a view e ação
                        const viewIndex = localViews.findIndex((v: any) => v.id === viewId);
                        if (viewIndex === -1) return;
                        const view = localViews[viewIndex];
                        const layoutConfig = typeof view.layout_config === 'string' ? JSON.parse(view.layout_config) : (view.layout_config || {});
                        const customActions = layoutConfig.custom_actions || [];
                        const actionIndex = customActions.findIndex((a: any) => (a.id || a.label) === actId);
                        if (actionIndex === -1) return;

                        const action = customActions[actionIndex];
                        const linkedWorkflows = action.linked_bpm_workflows || [];
                        const isLinked = linkedWorkflows.includes(currentWorkflowId);
                        
                        const newLinkedWorkflows = isLinked
                          ? linkedWorkflows.filter((id: string) => id !== currentWorkflowId)
                          : [...linkedWorkflows, currentWorkflowId];

                        // Atualiza objeto em memória otimisticamente
                        const newActions = [...customActions];
                        newActions[actionIndex] = { ...action, linked_bpm_workflows: newLinkedWorkflows };
                        const newLayoutConfig = { ...layoutConfig, custom_actions: newActions };
                        
                        const newLocalViews = [...localViews];
                        newLocalViews[viewIndex] = { ...view, layout_config: newLayoutConfig };
                        setLocalViews(newLocalViews);

                        // Salva no banco de dados
                        try {
                          const { error } = await supabase
                            .from('ui_views')
                            .update({ layout_config: newLayoutConfig })
                            .eq('id', viewId);
                          
                          if (error) throw error;
                          toast(isLinked ? t('bpm.canvas.toasts.button_unlinked', 'Botão desvinculado do fluxo!') : t('bpm.canvas.toasts.button_linked', 'Botão vinculado ao fluxo!'), 'success');
                        } catch (err: any) {
                          // Rollback visual em caso de erro
                          setLocalViews(localViews);
                          toast(t('bpm.canvas.toasts.link_button_error', 'Erro ao vincular botão: ') + err.message, 'error');
                        }
                      };

                      return (
                      <div className="space-y-4 pt-4 border-t border-emerald-500/20 mt-4">
                        <h5 className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">{t('bpm.canvas.trigger_custom_actions')}</h5>
                        <p className="text-[9px] text-neutral-500 leading-relaxed mb-4">
                          {t('bpm.canvas.trigger_custom_actions_desc')}
                        </p>
                        
                        <div className="space-y-3">
                          {useCasesWithActions.length === 0 && (
                            <div className="text-center py-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg border border-neutral-100 dark:border-neutral-800">
                              <p className="text-[10px] text-neutral-500">{t('bpm.canvas.no_custom_actions')}</p>
                            </div>
                          )}

                          {useCasesWithActions.map((uc: any) => (
                            <div key={uc.id} className="bg-neutral-50 dark:bg-neutral-900/50 rounded-lg p-2 border border-neutral-100 dark:border-neutral-800">
                              <h6 className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-2 px-1 flex items-center gap-1">
                                <Box className="w-3 h-3" /> {uc.name}
                              </h6>
                              <div className="space-y-1">
                                {uc.actions.map((act: any) => {
                                  const isChecked = act.linked_workflows.includes(currentWorkflowId || '');
                                  return (
                                    <label key={act.id} className="flex items-center gap-3 p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md cursor-pointer transition-colors group/action">
                                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all flex-shrink-0 ${isChecked ? "bg-emerald-500 border-emerald-500 text-white" : "border-neutral-300 dark:border-neutral-600 group-hover/action:border-emerald-400"}`}>
                                        {isChecked && <Check className="w-3 h-3" />}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300 truncate leading-none mb-1">{act.name}</p>
                                        <p className="text-[9px] text-neutral-400 truncate uppercase tracking-widest leading-none">{act.context}</p>
                                      </div>
                                      
                                      <input 
                                        type="checkbox" 
                                        className="hidden"
                                        checked={isChecked}
                                        onChange={() => toggleCustomAction(uc.id, act.id)}
                                      />

                                    </label>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      )
                    })()}

                    {triggerTypes.includes('scheduled') && (() => {
                      const rawSchedules = selectedNode.data?.triggerSchedules as any[];
                      // Fallback para quem já tinha configurado antes (retrocompatibilidade) ou novo
                      const schedules = rawSchedules || [{
                        id: 'default_1',
                        type: (selectedNode.data?.triggerScheduleType as string) || 'recurring',
                        days: (selectedNode.data?.triggerScheduleDays as string[]) || [],
                        time: (selectedNode.data?.triggerScheduleTime as string) || '',
                        dateTime: (selectedNode.data?.triggerScheduleDateTime as string) || ''
                      }];

                      const updateSchedule = (id: string, newProps: any) => {
                        const newSchedules = schedules.map(s => s.id === id ? { ...s, ...newProps } : s);
                        updateNodeData(selectedNode.id, { triggerSchedules: newSchedules });
                      };

                      const removeSchedule = (id: string) => {
                        const newSchedules = schedules.filter(s => s.id !== id);
                        updateNodeData(selectedNode.id, { triggerSchedules: newSchedules.length > 0 ? newSchedules : schedules }); // Previne remover o último se quiser
                      };

                      const addSchedule = () => {
                        updateNodeData(selectedNode.id, { 
                          triggerSchedules: [...schedules, { id: Math.random().toString(), type: 'recurring', days: [], time: '', dateTime: '' }] 
                        });
                      };

                      return (
                      <div className="space-y-4 pt-4 border-t border-emerald-500/20 mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{t('bpm.canvas.schedule_config')}</h5>
                          <button
                            onClick={addSchedule}
                            className="text-[9px] bg-emerald-500 text-white px-2 py-1 rounded font-bold uppercase tracking-widest hover:bg-emerald-600 transition-colors shadow-sm shadow-emerald-500/30"
                          >
                            {t('bpm.canvas.add_schedule')}
                          </button>
                        </div>

                        <div className="space-y-3">
                          {schedules.map((sched, index) => (
                            <div key={sched.id} className="relative group/sched border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-3 bg-white dark:bg-neutral-950 shadow-sm">
                              {schedules.length > 1 && (
                                <button
                                  onClick={() => removeSchedule(sched.id)}
                                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover/sched:opacity-100 transition-opacity shadow z-10"
                                  title={t('bpm.canvas.remove_schedule')}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}

                              <div className="flex bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg mb-3">
                                <button
                                  onClick={() => updateSchedule(sched.id, { type: 'recurring' })}
                                  className={`flex-1 text-[10px] font-bold py-1.5 rounded transition-colors ${sched.type === 'recurring' ? 'bg-white dark:bg-neutral-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}
                                >
                                  {t('bpm.canvas.recurring')}
                                </button>
                                <button
                                  onClick={() => updateSchedule(sched.id, { type: 'once' })}
                                  className={`flex-1 text-[10px] font-bold py-1.5 rounded transition-colors ${sched.type === 'once' ? 'bg-white dark:bg-neutral-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}
                                >
                                  {t('bpm.canvas.once')}
                                </button>
                              </div>

                              <div className="mb-3">
                                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-2">{t('bpm.canvas.days_of_week')}</label>
                                <div className="flex flex-wrap gap-2">
                                  {[
                                    { val: '0', label: t('bpm.canvas.days.sunday') },
                                    { val: '1', label: t('bpm.canvas.days.monday') },
                                    { val: '2', label: t('bpm.canvas.days.tuesday') },
                                    { val: '3', label: t('bpm.canvas.days.wednesday') },
                                    { val: '4', label: t('bpm.canvas.days.thursday') },
                                    { val: '5', label: t('bpm.canvas.days.friday') },
                                    { val: '6', label: t('bpm.canvas.days.saturday') },
                                  ].map(day => {
                                    const isSelected = sched.days.includes(day.val);
                                    return (
                                      <button
                                        key={day.val}
                                        onClick={() => {
                                          const newDays = isSelected 
                                            ? sched.days.filter((d: string) => d !== day.val)
                                            : [...sched.days, day.val];
                                          updateSchedule(sched.id, { days: newDays });
                                        }}
                                        className={`w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${isSelected ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30' : 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-emerald-400 hover:text-emerald-500'}`}
                                      >
                                        {day.label}
                                      </button>
                                    )
                                  })}
                                </div>
                                {sched.days.length === 0 && (
                                  <p className="text-[9px] text-neutral-400 mt-2 italic">{t('bpm.canvas.executes_every_day')}</p>
                                )}
                              </div>

                              <div className="mb-2">
                                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">{t('bpm.canvas.time_hh_mm')}</label>
                                <input 
                                  type="time" 
                                  value={sched.time} 
                                  onChange={(e) => updateSchedule(sched.id, { time: e.target.value })}
                                  className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 font-mono"
                                />
                              </div>

                              {sched.type === 'once' && (
                                <div className="pt-3 mt-3 border-t border-emerald-100 dark:border-emerald-900/30">
                                  <label className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest block mb-1">{t('bpm.canvas.or_specific_datetime')}</label>
                                  <input 
                                    type="datetime-local" 
                                    value={sched.dateTime} 
                                    onChange={(e) => updateSchedule(sched.id, { dateTime: e.target.value })}
                                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 font-mono"
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      )
                    })()}

                    {triggerTypes.includes('webhook') && (
                      <div className="space-y-4 pt-4 border-t border-emerald-500/20 mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{t('bpm.canvas.webhook_config', 'Configuração Webhook')}</h5>
                        </div>
                        
                        <div className="bg-neutral-50 dark:bg-neutral-900/50 rounded-lg p-3 border border-neutral-100 dark:border-neutral-800">
                          <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">{t('bpm.canvas.webhook_url', 'URL do Webhook')}</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              readOnly
                              value={`https://api.metabuilderpro.com/v1/webhook/${currentWorkflowId || 'novo-fluxo'}`}
                              className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded px-2 py-1 text-[10px] text-neutral-500 font-mono"
                            />
                            <button 
                              onClick={(e) => {
                                e.preventDefault();
                                navigator.clipboard.writeText(`https://api.metabuilderpro.com/v1/webhook/${currentWorkflowId || 'novo-fluxo'}`);
                                toast(t('bpm.canvas.copied', 'Copiado para a área de transferência!'), 'success');
                              }}
                              className="px-2 py-1 bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded text-[10px] font-bold hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors"
                            >
                              Copy
                            </button>
                          </div>
                          
                          <p className="text-[9px] text-neutral-500 mt-2 leading-relaxed">
                            {t('bpm.canvas.webhook_hint', 'Envie uma requisição HTTP para esta URL para iniciar o fluxo. O JSON enviado no corpo (body) da requisição estará disponível nas variáveis do fluxo.')}
                          </p>
                        </div>
                        
                        <div>
                           <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">{t('bpm.canvas.http_method', 'Método HTTP Permitido')}</label>
                           <select 
                             value={(selectedNode.data?.triggerWebhookMethod as string) || 'POST'} 
                             onChange={(e) => updateNodeData(selectedNode.id, { triggerWebhookMethod: e.target.value })}
                             className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 font-mono"
                           >
                             <option value="POST">POST</option>
                             <option value="GET">GET</option>
                             <option value="PUT">PUT</option>
                             <option value="PATCH">PATCH</option>
                           </select>
                        </div>
                      </div>
                    )}
                  </div>
    </>
  );
}