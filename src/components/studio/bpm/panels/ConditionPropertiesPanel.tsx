import React from "react";
import { Plus, Trash2, X } from "lucide-react";

export function ConditionPropertiesPanel(props: any) {
  const { selectedNode, updateNodeData, dbModels, dbFields, t, enums } = props;
  const groups = (selectedNode.data?.conditionGroups as any[]) || [];
                  
  return (
    <>
                  <div className="space-y-4 p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xs font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest flex items-center gap-2">
                        {t('bpm.canvas.logic_ifelse_title')}
                      </h4>
                      <button
                        onClick={() => {
                          const newGroupId = `g_${Math.random().toString(36).substr(2, 9)}`;
                          updateNodeData(selectedNode.id, { 
                            conditionGroups: [...groups, { id: newGroupId, groupLogic: 'AND', logic: 'AND', rules: [] }]
                          });
                        }}
                        className="text-[9px] bg-amber-500 text-white px-2 py-1 rounded font-bold uppercase tracking-widest hover:bg-amber-600 transition-colors"
                      >
                        {t('bpm.canvas.add_group')}
                      </button>
                    </div>

                    {groups.length === 0 && (
                      <div 
                        className="text-[10px] text-neutral-500 text-center py-6 border border-dashed border-amber-500/30 rounded-xl"
                        dangerouslySetInnerHTML={{ __html: t('bpm.canvas.no_conditions') }}
                      />
                    )}

                    <div className="space-y-4">
                      {groups.map((group, gIndex) => (
                        <div key={group.id} className="relative">
                          {gIndex > 0 && (
                            <div className="flex justify-center -my-3 relative z-10">
                              <select
                                value={group.groupLogic}
                                onChange={(e: any) => {
                                  const newGroups = [...groups];
                                  newGroups[gIndex].groupLogic = e.target.value;
                                  updateNodeData(selectedNode.id, { conditionGroups: newGroups });
                                }}
                                className="bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 text-[9px] font-bold uppercase rounded px-2 py-0.5 border border-amber-300 dark:border-amber-700 focus:ring-0 cursor-pointer"
                              >
                                <option value="AND">{t('bpm.canvas.and_gate')}</option>
                                <option value="OR">{t('bpm.canvas.or_gate')}</option>
                              </select>
                            </div>
                          )}

                          <div className="bg-white dark:bg-neutral-900 border border-amber-200 dark:border-amber-900 rounded-xl p-3 shadow-sm">
                            <div className="flex items-center justify-between mb-3 pb-2 border-b border-neutral-100 dark:border-neutral-800">
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">{t('bpm.canvas.rules_must_be')}</span>
                                <select
                                  value={group.logic}
                                  onChange={(e: any) => {
                                    const newGroups = [...groups];
                                    newGroups[gIndex].logic = e.target.value;
                                    updateNodeData(selectedNode.id, { conditionGroups: newGroups });
                                  }}
                                  className="bg-transparent border-none text-[10px] font-black text-amber-600 dark:text-amber-500 p-0 pr-4 focus:ring-0 cursor-pointer"
                                >
                                  <option value="AND">{t('bpm.canvas.all_and')}</option>
                                  <option value="OR">{t('bpm.canvas.any_or')}</option>
                                </select>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    const newGroups = [...groups];
                                    newGroups[gIndex].rules.push({ id: `r_${Math.random().toString(36).substr(2, 9)}`, modelId: '', field: '', operator: '==', value: '' });
                                    updateNodeData(selectedNode.id, { conditionGroups: newGroups });
                                  }}
                                  className="text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10 p-1.5 rounded transition-colors"
                                  title={t('bpm.canvas.add_rule')}
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    const newGroups = groups.filter((_, i) => i !== gIndex);
                                    updateNodeData(selectedNode.id, { conditionGroups: newGroups });
                                  }}
                                  className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 p-1.5 rounded transition-colors"
                                  title={t('bpm.canvas.delete_group')}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="space-y-3">
                              {(!group.rules || group.rules.length === 0) && (
                                <div className="text-[10px] text-neutral-400 text-center py-2">
                                  {t('bpm.canvas.no_rules_in_group')}
                                </div>
                              )}
                              
                              {group.rules?.map((rule: any, rIndex: number) => (
                                <div key={rule.id} className="relative">
                                  {rIndex > 0 && (
                                    <div className="absolute -top-2.5 left-3 text-[8px] font-bold text-amber-500 bg-white dark:bg-neutral-950 px-1 z-10">
                                      {group.logic === 'AND' ? t('bpm.canvas.and_gate') : t('bpm.canvas.or_gate')}
                                    </div>
                                  )}
                                  <div className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg p-2 pt-3 space-y-2 relative group/rule">
                                    
                                    <button
                                      onClick={() => {
                                        const newGroups = [...groups];
                                        newGroups[gIndex].rules = newGroups[gIndex].rules.filter((_: any, i: number) => i !== rIndex);
                                        updateNodeData(selectedNode.id, { conditionGroups: newGroups });
                                      }}
                                      className="absolute top-1 right-1 text-neutral-400 hover:text-red-500 opacity-0 group-hover/rule:opacity-100 transition-opacity p-0.5"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>

                                    <div className="grid grid-cols-2 gap-2">
                                      <select 
                                        value={rule.modelId} 
                                        onChange={(e: any) => {
                                          const newGroups = [...groups];
                                          newGroups[gIndex].rules[rIndex].modelId = e.target.value;
                                          newGroups[gIndex].rules[rIndex].field = '';
                                          updateNodeData(selectedNode.id, { conditionGroups: newGroups });
                                        }}
                                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded px-2 py-1.5 text-[10px] focus:ring-1 focus:ring-amber-500"
                                      >
                                        <option value="">{t('bpm.canvas.table_select')}</option>
                                        {dbModels.map((m: any) => <option key={m.id} value={m.id}>{m.display_name || m.db_table_name || m.name}</option>)}
                                      </select>

                                      <select 
                                        value={rule.field} 
                                        onChange={(e: any) => {
                                          const newGroups = [...groups];
                                          newGroups[gIndex].rules[rIndex].field = e.target.value;
                                          updateNodeData(selectedNode.id, { conditionGroups: newGroups });
                                        }}
                                        disabled={!rule.modelId}
                                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded px-2 py-1.5 text-[10px] focus:ring-1 focus:ring-amber-500 disabled:opacity-50"
                                      >
                                        <option value="">{t('bpm.canvas.field_select')}</option>
                                        {dbFields.filter((f: any) => f.model_id === rule.modelId).map((f: any) => (
                                          <option key={f.id} value={f.db_column_name || f.name}>{f.display_name || f.db_column_name || f.name}</option>
                                        ))}
                                      </select>
                                    </div>

                                    <div className="grid grid-cols-[1fr_2fr] gap-2">
                                      <select 
                                        value={rule.operator || '=='} 
                                        onChange={(e: any) => {
                                          const newGroups = [...groups];
                                          newGroups[gIndex].rules[rIndex].operator = e.target.value;
                                          updateNodeData(selectedNode.id, { conditionGroups: newGroups });
                                        }}
                                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded px-2 py-1.5 text-[10px] focus:ring-1 focus:ring-amber-500"
                                      >
                                        <option value="==">{t('bpm.canvas.op_equal')}</option>
                                        <option value="!=">{t('bpm.canvas.op_not_equal')}</option>
                                        <option value=">">{t('bpm.canvas.op_greater')}</option>
                                        <option value=">=">{t('bpm.canvas.op_greater_equal')}</option>
                                        <option value="<">{t('bpm.canvas.op_less')}</option>
                                        <option value="<=">{t('bpm.canvas.op_less_equal')}</option>
                                        <option value="contains">{t('bpm.canvas.op_contains')}</option>
                                      </select>

                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2 justify-end mb-1">
                                          <span className="text-[9px] text-neutral-400">{t('bpm.canvas.use_enum')}</span>
                                          <input 
                                            type="checkbox" 
                                            checked={!!rule.useEnum}
                                            onChange={(e: any) => {
                                              const newGroups = [...groups];
                                              newGroups[gIndex].rules[rIndex].useEnum = e.target.checked;
                                              updateNodeData(selectedNode.id, { conditionGroups: newGroups });
                                            }}
                                            className="rounded w-3 h-3 bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-amber-500 focus:ring-amber-500" 
                                          />
                                        </div>

                                        {rule.useEnum ? (
                                          <div className="space-y-2">
                                            <select 
                                              value={rule.enumId || ''}
                                              onChange={(e: any) => {
                                                const newGroups = [...groups];
                                                newGroups[gIndex].rules[rIndex].enumId = e.target.value;
                                                newGroups[gIndex].rules[rIndex].value = '';
                                                updateNodeData(selectedNode.id, { conditionGroups: newGroups });
                                              }}
                                              className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded px-2 py-1.5 text-[10px] focus:ring-1 focus:ring-amber-500"
                                            >
                                              <option value="">Selecione o Enum...</option>
                                              {enums.map((en: any) => <option key={en.id} value={en.id}>{en.name}</option>)}
                                            </select>
                                            
                                            {!!rule.enumId && (
                                              <select 
                                                value={rule.value || ''}
                                                onChange={(e: any) => {
                                                  const newGroups = [...groups];
                                                  newGroups[gIndex].rules[rIndex].value = e.target.value;
                                                  updateNodeData(selectedNode.id, { conditionGroups: newGroups });
                                                }}
                                                className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded px-2 py-1.5 text-[10px] focus:ring-1 focus:ring-amber-500"
                                              >
                                                <option value="">Selecione o Valor...</option>
                                                {enums.find((e: any) => e.id === rule.enumId)?.values?.map((v: any) => (
                                                  <option key={v.value} value={v.value}>{v.description ? `${String(v.value)} - ${String(v.description)}` : String(v.value)}</option>
                                                ))}
                                              </select>
                                            )}
                                          </div>
                                        ) : (
                                          <input 
                                            type="text" 
                                            placeholder="Valor..."
                                            value={rule.value || ''} 
                                            onChange={(e: any) => {
                                              const newGroups = [...groups];
                                              newGroups[gIndex].rules[rIndex].value = e.target.value;
                                              updateNodeData(selectedNode.id, { conditionGroups: newGroups });
                                            }}
                                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded px-2 py-1.5 text-[10px] focus:ring-1 focus:ring-amber-500"
                                          />
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
    </>
  );
}