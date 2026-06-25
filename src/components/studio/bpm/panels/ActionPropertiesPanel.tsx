import React, { useState } from "react";
import { Check, Info, Loader2, X, Edit2, MessageSquare, Settings2 } from "lucide-react";
import RichTextEditor from "../RichTextEditor";

export function ActionPropertiesPanel(props: any) {
  const { selectedNode, updateNodeData, dbModels, dbFields, setCursorPos, roles, openGroupUsersModal, setEditingEmailNode, setTempEmailData, setIsPreviewEmailOpen, renderActionFilters, t, enums, cursorPos } = props;
  const [activeTab, setActiveTab] = useState<'geral' | 'mensagem'>('geral');

  return (
    <div className="space-y-4">
      <div className="flex bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('geral')}
          className={`flex-1 text-[10px] font-bold py-1.5 rounded transition-colors flex justify-center items-center gap-1 ${activeTab === 'geral' ? 'bg-white dark:bg-neutral-700 text-indigo-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
        >
          <Settings2 size={12} /> {t('bpm.canvas.general') || 'Geral'}
        </button>
        <button
          onClick={() => setActiveTab('mensagem')}
          className={`flex-1 text-[10px] font-bold py-1.5 rounded transition-colors flex justify-center items-center gap-1 ${activeTab === 'mensagem' ? 'bg-white dark:bg-neutral-700 text-indigo-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
        >
          <MessageSquare size={12} /> {t('bpm.canvas.message') || 'Mensagem'}
        </button>
      </div>

      {activeTab === 'geral' && (
        <div className="space-y-4 p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl">
                    <h4 className="text-xs font-black text-indigo-600 dark:text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                      {t('bpm.canvas.action_config')}
                    </h4>

                    <div>
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">{t('bpm.canvas.action_type')}</label>
                      <select 
                        value={(selectedNode.data?.actionType as string) || ''} 
                        onChange={(e: any) => updateNodeData(selectedNode.id, { actionType: e.target.value })}
                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="">{t('bpm.canvas.select_action')}</option>
                        <option value="insert">{t('bpm.nodes.insert_record')}</option>
                        <option value="update">{t('bpm.nodes.update_record')}</option>
                        <option value="mutate">{t('bpm.nodes.mutate_record', 'Atualizar Dados do Formulário')}</option>
                        <option value="delete">{t('bpm.nodes.delete_record')}</option>
                        <option value="email">{t('bpm.nodes.send_email')}</option>
                        <option value="webhook">{t('bpm.canvas.webhook_api_call')}</option>
                      </select>
                    </div>

                    {['insert', 'update', 'delete', 'mutate'].includes(selectedNode.data?.actionType as string) && (() => {
                      const actionFields = (selectedNode.data?.actionFields as any[]) || [];
                      const actionFilters = (selectedNode.data?.actionFilters as any[]) || [];

                      return (
                      <div className="space-y-4 pt-4 border-t border-indigo-500/20">
                        {['insert', 'update', 'delete', 'mutate'].includes(selectedNode.data?.actionType as string) && (
                          <div>
                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">{t('bpm.canvas.target_table')}</label>
                            <select 
                              value={(selectedNode.data?.actionModelId as string) || ''} 
                              onChange={(e: any) => updateNodeData(selectedNode.id, { actionModelId: e.target.value, actionFields: [], actionFilters: [] })}
                              className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500"
                            >
                              <option value="">{t('bpm.canvas.select_table_option')}</option>
                              {dbModels.map((m: any) => (
                                <option key={m.id} value={m.id}>{m.display_name || m.db_table_name || m.name}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Múltiplos Campos para Insert / Update / Mutate */}
                        {((['insert', 'update'].includes(selectedNode.data?.actionType as string) && !!selectedNode.data?.actionModelId) || selectedNode.data?.actionType === 'mutate') && (
                          <div className="bg-white dark:bg-neutral-900 border border-indigo-200 dark:border-indigo-900 rounded-xl p-3 shadow-sm mt-4">
                            <div className="flex items-center justify-between mb-3 pb-2 border-b border-neutral-100 dark:border-neutral-800">
                              <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">
                                {selectedNode.data?.actionType === 'insert' 
                                  ? t('bpm.canvas.fields_to_insert') 
                                  : selectedNode.data?.actionType === 'mutate'
                                    ? t('bpm.canvas.fields_to_mutate', 'Campos para Atualizar')
                                    : t('bpm.canvas.fields_to_update')}
                              </span>
                              <button
                                onClick={() => {
                                  updateNodeData(selectedNode.id, { 
                                    actionFields: [...actionFields, { field: '', value: '', useEnum: false, enumId: '' }]
                                  });
                                }}
                                className="text-[9px] bg-indigo-500 text-white px-2 py-1 rounded font-bold uppercase tracking-widest hover:bg-indigo-600 transition-colors"
                              >
                                {t('bpm.canvas.add_field')}
                              </button>
                            </div>

                            {actionFields.length === 0 && (
                              <div className="text-[9px] text-neutral-400 text-center py-2 italic">
                                {t('bpm.canvas.no_fields_defined')}
                              </div>
                            )}

                            <div className="space-y-3">
                              {actionFields.map((fld: any, index: number) => (
                                <div key={index} className="relative group/field border border-neutral-100 dark:border-neutral-800 rounded p-2 bg-neutral-50 dark:bg-neutral-950">
                                  <button
                                    onClick={() => {
                                      const newFields = [...actionFields];
                                      newFields.splice(index, 1);
                                      updateNodeData(selectedNode.id, { actionFields: newFields });
                                    }}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover/field:opacity-100 transition-opacity shadow"
                                    title="Remover campo"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                  
                                  <div className="grid grid-cols-1 gap-2 mb-2">
                                    <select 
                                      value={fld.field || ''} 
                                      onChange={(e: any) => {
                                        const newFields = [...actionFields];
                                        newFields[index].field = e.target.value;
                                        updateNodeData(selectedNode.id, { actionFields: newFields });
                                      }}
                                      className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded px-2 py-1 text-[10px] focus:ring-1 focus:ring-indigo-500"
                                    >
                                      <option value="">{t('bpm.canvas.select_field_option')}</option>
                                      {dbFields.filter((f: any) => f.model_id === selectedNode.data?.actionModelId).map((f: any) => (
                                        <option key={f.id} value={f.db_column_name || f.name}>{f.display_name || f.db_column_name || f.name}</option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-[9px] text-neutral-400">{t('bpm.canvas.use_enum')}</span>
                                    <input 
                                      type="checkbox" 
                                      checked={!!fld.useEnum}
                                      onChange={(e: any) => {
                                        const newFields = [...actionFields];
                                        newFields[index].useEnum = e.target.checked;
                                        updateNodeData(selectedNode.id, { actionFields: newFields });
                                      }}
                                      className="rounded w-3 h-3 bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-indigo-500 focus:ring-indigo-500" 
                                    />
                                  </div>

                                  {fld.useEnum ? (
                                    <div className="space-y-2">
                                      <select 
                                        value={fld.enumId || ''}
                                        onChange={(e: any) => {
                                          const newFields = [...actionFields];
                                          newFields[index].enumId = e.target.value;
                                          newFields[index].value = '';
                                          updateNodeData(selectedNode.id, { actionFields: newFields });
                                        }}
                                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded px-2 py-1 text-[10px] focus:ring-1 focus:ring-indigo-500"
                                      >
                                        <option value="">{t('bpm.canvas.enum_select_option')}</option>
                                        {enums.map((en: any) => <option key={en.id} value={en.id}>{en.name}</option>)}
                                      </select>
                                      
                                      {!!fld.enumId && (
                                        <select 
                                          value={fld.value || ''}
                                          onChange={(e: any) => {
                                            const newFields = [...actionFields];
                                            newFields[index].value = e.target.value;
                                            updateNodeData(selectedNode.id, { actionFields: newFields });
                                          }}
                                          className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded px-2 py-1 text-[10px] focus:ring-1 focus:ring-indigo-500"
                                        >
                                          <option value="">{t('bpm.canvas.value_select_option')}</option>
                                          {enums.find((e: any) => e.id === fld.enumId)?.values?.map((v: any) => (
                                            <option key={v.value} value={v.value}>{v.description ? `${String(v.value)} - ${String(v.description)}` : String(v.value)}</option>
                                          ))}
                                        </select>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="flex gap-1">
                                      <input 
                                        type="text" 
                                        placeholder={t('bpm.canvas.field_value_placeholder')}
                                        value={fld.value || ''} 
                                        onChange={(e: any) => {
                                          const newFields = [...actionFields];
                                          newFields[index].value = e.target.value;
                                          updateNodeData(selectedNode.id, { actionFields: newFields });
                                        }}
                                        className="flex-1 min-w-0 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded px-2 py-1 text-[10px] focus:ring-1 focus:ring-indigo-500"
                                      />
                                      <select
                                        value=""
                                        onChange={(e: any) => {
                                          if (!e.target.value) return;
                                          const newFields = [...actionFields];
                                          newFields[index].value = (newFields[index].value || '') + `{{${e.target.value}}}`;
                                          updateNodeData(selectedNode.id, { actionFields: newFields });
                                          e.target.value = '';
                                        }}
                                        className="w-8 shrink-0 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-transparent rounded px-1 py-1 focus:ring-1 focus:ring-indigo-500 cursor-pointer text-[10px] appearance-none"
                                        style={{ backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="%236366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>')`, backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }}
                                        title={t('bpm.canvas.insert_variable')}
                                      >
                                        <option value="" className="text-neutral-900 dark:text-neutral-100">{t('bpm.canvas.plus_var')}</option>
                                        {[...dbModels].map((m: any) => {
                                          const fields = dbFields.filter((f: any) => f.model_id === m.id);
                                          if (fields.length === 0) return null;
                                          return (
                                            <optgroup key={m.id} label={m.display_name || m.db_table_name || m.name} className="text-left text-indigo-600 dark:text-indigo-400 normal-case tracking-normal text-sm font-bold bg-neutral-50 dark:bg-neutral-900">
                                              {fields.map((f: any) => (
                                                <option key={f.id} value={`${m.db_table_name || m.name}.${f.db_column_name || f.name}`} className="text-left text-neutral-900 dark:text-neutral-100 normal-case tracking-normal text-sm font-normal">
                                                  {f.display_name || f.db_column_name || f.name}
                                                </option>
                                              ))}
                                            </optgroup>
                                          );
                                        })}
                                      </select>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Filtros ONDE (WHERE) para Update / Delete */}
                        {['update', 'delete'].includes(selectedNode.data?.actionType as string) && !!selectedNode.data?.actionModelId && renderActionFilters()}
                      </div>
                      )
                    })()}

                    {selectedNode.data?.actionType === 'email' && (
                      <div className="space-y-4 pt-4 border-t border-indigo-500/20">
                        <div>
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-2">{t('bpm.canvas.recipients')}</label>
                          <div className="flex bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg">
                            <button
                              onClick={() => updateNodeData(selectedNode.id, { emailRecipientType: 'system' })}
                              className={`flex-1 text-[10px] font-bold py-1.5 rounded transition-colors ${(!selectedNode.data?.emailRecipientType || selectedNode.data?.emailRecipientType === 'system') ? 'bg-white dark:bg-neutral-700 text-indigo-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
                            >
                              {t('bpm.canvas.groups_users')}
                            </button>
                            <button
                              onClick={() => updateNodeData(selectedNode.id, { emailRecipientType: 'table' })}
                              className={`flex-1 text-[10px] font-bold py-1.5 rounded transition-colors ${selectedNode.data?.emailRecipientType === 'table' ? 'bg-white dark:bg-neutral-700 text-indigo-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
                            >
                              {t('bpm.canvas.dynamic_table')}
                            </button>
                          </div>
                        </div>

                        {(!selectedNode.data?.emailRecipientType || selectedNode.data?.emailRecipientType === 'system') && (
                          <div className="bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-xl p-3 space-y-3">
                            <div>
                              <label className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block mb-1">{t('bpm.canvas.send_to_access_groups')}</label>
                              <div className="text-[10px] text-neutral-500 mb-2 leading-tight">{t('bpm.canvas.send_to_access_groups_desc')}</div>
                              <div className="flex flex-wrap gap-2">
                                {roles.length > 0 ? roles.map((grupo: any) => {
                                  const currentGroupsUsers: any = selectedNode.data?.emailGroupsUsers || {};
                                  const selection = currentGroupsUsers[grupo.name];
                                  const isSelected = !!selection;
                                  
                                  let statusText = '';
                                  if (isSelected) {
                                    statusText = selection === 'all' ? `(${t('bpm.canvas.send_to_all')})` : `(${selection.length} sel.)`;
                                  }

                                  return (
                                    <button
                                      key={grupo.id}
                                      onClick={() => openGroupUsersModal(grupo)}
                                      className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all border flex items-center gap-1 ${isSelected ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20' : 'bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:border-indigo-300'}`}
                                    >
                                      {grupo.name}
                                      {statusText && <span className={isSelected ? 'text-indigo-200 font-normal' : 'text-neutral-400 font-normal'}>{statusText}</span>}
                                    </button>
                                  );
                                }) : <span className="text-[10px] text-neutral-400">{t('bpm.canvas.no_groups_found', 'Nenhum grupo encontrado')}</span>}
                              </div>
                            </div>
                            
                            <div>
                              <label className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block mb-1 mt-4">{t('bpm.canvas.specific_emails')}</label>
                              <input 
                                type="text"
                                placeholder={t('bpm.canvas.specific_emails_placeholder')}
                                value={(selectedNode.data?.emailSpecificUsers as string) || ''}
                                onChange={(e: any) => updateNodeData(selectedNode.id, { emailSpecificUsers: e.target.value })}
                                className="w-full bg-white dark:bg-neutral-900 border border-indigo-200 dark:border-indigo-900/50 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                          </div>
                        )}

                        {selectedNode.data?.emailRecipientType === 'table' && (
                          <div className="bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800/50 rounded-xl p-3 space-y-3">
                            <div>
                              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">{t('bpm.canvas.target_table_email')}</label>
                              <select 
                                value={(selectedNode.data?.actionModelId as string) || ''} 
                                onChange={(e: any) => updateNodeData(selectedNode.id, { actionModelId: e.target.value, actionEmailField: '' })}
                                className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500"
                              >
                                <option value="">{t('bpm.canvas.select_table_option')}</option>
                                {dbModels.map((m: any) => (
                                  <option key={m.id} value={m.id}>{m.display_name || m.db_table_name || m.name}</option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">{t('bpm.canvas.email_field')}</label>
                              <select 
                                value={(selectedNode.data?.actionEmailField as string) || ''} 
                                onChange={(e: any) => updateNodeData(selectedNode.id, { actionEmailField: e.target.value })}
                                disabled={!selectedNode.data?.actionModelId}
                                className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                              >
                                <option value="">{t('bpm.canvas.select_email_field')}</option>
                                {dbFields
                                  .filter((f: any) => f.model_id === selectedNode.data?.actionModelId)
                                  .map((f: any) => (
                                    <option key={f.id} value={f.db_column_name || f.name}>{f.display_name || f.db_column_name || f.name}</option>
                                  ))}
                              </select>
                            </div>
                            <div className="text-[10px] text-neutral-500 italic">
                              {t('bpm.canvas.email_filters_hint')}
                            </div>
                            {renderActionFilters()}
                          </div>
                        )}

                        <div className="pt-2">
                          <button
                            onClick={() => setEditingEmailNode(selectedNode.id)}
                            className="w-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 font-bold text-[10px] uppercase tracking-widest py-3 rounded-lg flex items-center justify-center gap-2 transition-all"
                          >
                            <Edit2 size={14} />
                            {t('bpm.canvas.configure_email')}
                          </button>
                          
                          {Boolean(selectedNode.data?.actionSubject || selectedNode.data?.actionBody) && (
                            <div className="mt-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-3 text-xs">
                              <div className="font-bold text-neutral-700 dark:text-neutral-300 mb-1 flex items-center gap-1">
                                <span className="text-neutral-400 text-[10px] uppercase">{t('bpm.canvas.subject_label')}</span> 
                                <span className="truncate">{selectedNode.data?.actionSubject as string || t('bpm.canvas.no_subject')}</span>
                              </div>
                              <div className="text-neutral-500 line-clamp-2 mt-2 border-t border-neutral-100 dark:border-neutral-800 pt-2 text-[11px] leading-relaxed">
                                {((selectedNode.data?.actionBody as string) || t('bpm.canvas.no_body')).replace(/<[^>]*>?/gm, '')}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {selectedNode.data?.actionType === 'webhook' && (
                      <div className="space-y-4 pt-4 border-t border-indigo-500/20">
                        <div>
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">{t('bpm.canvas.http_method')}</label>
                          <select 
                            value={(selectedNode.data?.webhookMethod as string) || 'POST'} 
                            onChange={(e: any) => updateNodeData(selectedNode.id, { webhookMethod: e.target.value })}
                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 font-mono"
                          >
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="PATCH">PATCH</option>
                            <option value="DELETE">DELETE</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">{t('bpm.canvas.api_url')}</label>
                          <input 
                            type="text" 
                            placeholder="https://api.exemplo.com/v1/..."
                            value={(selectedNode.data?.webhookUrl as string) || ''} 
                            onChange={(e: any) => updateNodeData(selectedNode.id, { webhookUrl: e.target.value })}
                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 font-mono"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1 flex items-center justify-between">
                            <span>{t('bpm.canvas.headers_optional')}</span>
                          </label>
                          <textarea 
                            rows={3}
                            placeholder={'{\n  "Authorization": "Bearer token"\n}'}
                            value={(selectedNode.data?.webhookHeaders as string) || ''} 
                            onChange={(e: any) => updateNodeData(selectedNode.id, { webhookHeaders: e.target.value })}
                            className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 resize-none font-mono text-[10px]"
                          />
                        </div>

                        {['POST', 'PUT', 'PATCH'].includes((selectedNode.data?.webhookMethod as string) || 'POST') && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-0">{t('bpm.canvas.body_json')}</label>
                              <select 
                                value=""
                                onChange={(e: any) => {
                                  const val = e.target.value;
                                  if (!val) return;
                                  const currentText = (selectedNode.data?.webhookBody as string) || '';
                                  let newText = currentText + `{{${val}}}`;
                                  if (cursorPos && cursorPos.field === 'webhookBody') {
                                    newText = currentText.substring(0, cursorPos.start) + `{{${val}}}` + currentText.substring(cursorPos.end);
                                  }
                                  updateNodeData(selectedNode.id, { webhookBody: newText });
                                  e.target.value = '';
                                  setCursorPos(null);
                                }}
                                className="bg-transparent border-none text-[9px] text-indigo-500 font-bold uppercase tracking-widest cursor-pointer focus:ring-0 w-24 text-right p-0"
                              >
                                <option value="" className="text-left text-neutral-900 dark:text-neutral-100 normal-case tracking-normal text-sm font-normal">{t('bpm.canvas.plus_variable')}</option>
                                {[...dbModels]
                                  .sort((a, b) => {
                                    const nameA = a.display_name || a.db_table_name || a.name;
                                    const nameB = b.display_name || b.db_table_name || b.name;
                                    return nameA.localeCompare(nameB);
                                  })
                                  .map((m: any) => {
                                    const tableName = m.display_name || m.db_table_name || m.name;
                                    const fields = dbFields.filter((f: any) => f.model_id === m.id);
                                    if (fields.length === 0) return null;
                                    
                                    return (
                                      <optgroup key={m.id} label={tableName} className="text-left text-indigo-600 dark:text-indigo-400 normal-case tracking-normal text-sm font-bold bg-neutral-50 dark:bg-neutral-900">
                                        {[...fields]
                                          .sort((a, b) => {
                                            const nameA = a.display_name || a.db_column_name || a.name;
                                            const nameB = b.display_name || b.db_column_name || b.name;
                                            return nameA.localeCompare(nameB);
                                          })
                                          .map((f: any) => (
                                            <option key={f.id} value={`${m.db_table_name || m.name}.${f.db_column_name || f.name}`} className="text-left text-neutral-900 dark:text-neutral-100 normal-case tracking-normal text-sm font-normal">
                                              {f.display_name || f.db_column_name || f.name}
                                            </option>
                                          ))}
                                      </optgroup>
                                    );
                                  })
                                }
                              </select>
                            </div>
                            <textarea 
                              rows={6}
                              placeholder={'{\n  "cliente_id": "{{orders.customer_id}}"\n}'}
                              value={(selectedNode.data?.webhookBody as string) || ''} 
                              onChange={(e: any) => updateNodeData(selectedNode.id, { webhookBody: e.target.value })}
                              onBlur={(e: any) => setCursorPos({ field: 'webhookBody', start: e.target.selectionStart || 0, end: e.target.selectionEnd || 0 })}
                              className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 resize-none font-mono text-[10px]"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
      )}

      {activeTab === 'mensagem' && (
        <div className="space-y-4 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
          <div className="text-[10px] text-neutral-500 italic">
            {t('bpm.canvas.message_tab_desc') || 'Defina uma mensagem para ser exibida após a execução desta ação, caso queira.'}
          </div>

          <div>
            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-2">{t('bpm.canvas.visual_template') || 'Template Visual'}</label>
            <select 
              value={(selectedNode.data?.successMessageTemplate as string) || 'alert'}
              onChange={(e) => updateNodeData(selectedNode.id, { successMessageTemplate: e.target.value })}
              className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500"
            >
              <option value="alert">{t('bpm.canvas.template_alert') || 'Alerta Padrão'}</option>
              <option value="modern">{t('bpm.canvas.template_modern') || 'Moderno'}</option>
              <option value="classic">{t('bpm.canvas.template_classic') || 'Clássico'}</option>
              <option value="free">{t('bpm.canvas.template_free') || 'Texto Livre'}</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block">{t('bpm.canvas.subject') || 'Assunto'}</label>
              <select 
                value=""
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  const currentText = (selectedNode.data?.successMessageSubject as string) || '';
                  const newText = currentText ? currentText + ` {{${val}}}` : `{{${val}}}`;
                  updateNodeData(selectedNode.id, { successMessageSubject: newText });
                  e.target.value = '';
                }}
                className="bg-transparent border-none text-[9px] text-indigo-500 font-bold uppercase tracking-widest cursor-pointer focus:ring-0 w-28 text-right p-0"
              >
                <option value="" className="text-left text-neutral-900 dark:text-neutral-100 normal-case tracking-normal text-sm font-normal">{t('bpm.canvas.plus_variable') || '+ Variável'}</option>
                {[...dbModels].sort((a, b) => (a.display_name || a.db_table_name || a.name).localeCompare(b.display_name || b.db_table_name || b.name)).map((m: any) => {
                  const tableName = m.display_name || m.db_table_name || m.name;
                  const fields = dbFields.filter((f: any) => f.model_id === m.id);
                  if (fields.length === 0) return null;
                  return (
                    <optgroup key={m.id} label={tableName} className="text-left text-indigo-600 dark:text-indigo-400 normal-case tracking-normal text-sm font-bold bg-neutral-50 dark:bg-neutral-900">
                      {[...fields].sort((a, b) => (a.display_name || a.db_column_name || a.name).localeCompare(b.display_name || b.db_column_name || b.name)).map((f: any) => (
                        <option key={f.id} value={`${m.db_table_name || m.name}.${f.db_column_name || f.name}`} className="text-left text-neutral-900 dark:text-neutral-100 normal-case tracking-normal text-sm font-normal">
                          {f.display_name || f.db_column_name || f.name}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </div>
            <input 
              type="text" 
              placeholder={t('bpm.canvas.subject_placeholder') || 'Ex: Operação realizada com sucesso!'}
              value={(selectedNode.data?.successMessageSubject as string) || ''} 
              onChange={(e) => updateNodeData(selectedNode.id, { successMessageSubject: e.target.value })}
              className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">{t('bpm.canvas.body_html_text') || 'Corpo (HTML/Texto)'}</label>
              <select 
                value=""
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  const currentText = (selectedNode.data?.successMessageBody as string) || '';
                  const newText = currentText ? currentText + ` {{${val}}}` : `{{${val}}}`;
                  updateNodeData(selectedNode.id, { successMessageBody: newText });
                  e.target.value = '';
                }}
                className="bg-transparent border-none text-[9px] text-indigo-500 font-bold uppercase tracking-widest cursor-pointer focus:ring-0 w-28 text-right p-0"
              >
                <option value="" className="text-left text-neutral-900 dark:text-neutral-100 normal-case tracking-normal text-sm font-normal">{t('bpm.canvas.plus_variable') || '+ Variável'}</option>
                {[...dbModels].sort((a, b) => (a.display_name || a.db_table_name || a.name).localeCompare(b.display_name || b.db_table_name || b.name)).map((m: any) => {
                  const tableName = m.display_name || m.db_table_name || m.name;
                  const fields = dbFields.filter((f: any) => f.model_id === m.id);
                  if (fields.length === 0) return null;
                  return (
                    <optgroup key={m.id} label={tableName} className="text-left text-indigo-600 dark:text-indigo-400 normal-case tracking-normal text-sm font-bold bg-neutral-50 dark:bg-neutral-900">
                      {[...fields].sort((a, b) => (a.display_name || a.db_column_name || a.name).localeCompare(b.display_name || b.db_column_name || b.name)).map((f: any) => (
                        <option key={f.id} value={`${m.db_table_name || m.name}.${f.db_column_name || f.name}`} className="text-left text-neutral-900 dark:text-neutral-100 normal-case tracking-normal text-sm font-normal">
                          {f.display_name || f.db_column_name || f.name}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </div>
            <RichTextEditor 
              value={(selectedNode.data?.successMessageBody as string) || ''}
              onChange={(val: any) => updateNodeData(selectedNode.id, { successMessageBody: val })}
              placeholder={t('bpm.canvas.body_placeholder') || 'Digite a mensagem de sucesso aqui...'}
            />
          </div>
        </div>
      )}
    </div>
  );
}