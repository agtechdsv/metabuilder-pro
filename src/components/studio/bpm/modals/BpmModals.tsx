import React from "react";
import { Loader2, Search, Users, X, Info, Check, Trash2 } from "lucide-react";
import { wrapEmailInTemplate, EmailTemplateType } from "@/utils/emailTemplates";
import RichTextEditor from "../RichTextEditor";
import { Modal } from "@/components/ui/Modal";

export function BpmModals(props: any) {
  const {
    selectedGroupForModal,
    setSelectedGroupForModal,
    isLoadingGroupUsers,
    modalSearchTerm,
    setModalSearchTerm,
    groupUsers,
    selectedUsersInModal,
    setSelectedUsersInModal,
    updateNodeData,
    selectedNode,
    editingEmailNode,
    setEditingEmailNode,
    tempEmailData,
    setTempEmailData,
    isPreviewEmailOpen,
    setIsPreviewEmailOpen,
    isDeleteModalOpen,
    setIsDeleteModalOpen,
    confirmDelete,
    t,
    cursorPos,
    setCursorPos,
    dbModels,
    dbFields
  } = props;

  return (
    <>
      <Modal
        isOpen={!!selectedGroupForModal}
        onClose={() => setSelectedGroupForModal(null)}
        title={t('bpm.canvas.users_group').replace('{name}', selectedGroupForModal?.name || '')}
        description={t('bpm.canvas.select_users_desc')}
        size="md"
        zIndex={200}
      >
        <div className="space-y-4">
          {isLoadingGroupUsers ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
              <p className="text-sm text-neutral-500">{t('bpm.canvas.searching_users')}</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
              <label className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
                <input
                  type="checkbox"
                  checked={selectedUsersInModal === 'all'}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedUsersInModal('all');
                    } else {
                      setSelectedUsersInModal([]);
                    }
                  }}
                  className="w-4 h-4 text-indigo-600 rounded border-neutral-300 focus:ring-indigo-600"
                />
                <span className="text-sm font-bold text-neutral-900 dark:text-white">{t('bpm.canvas.send_to_all')}</span>
              </label>

              {groupUsers.length > 0 && (
                <div className="pt-2 pb-1 border-t border-neutral-100 dark:border-neutral-800">
                  <input
                    type="text"
                    placeholder={t('bpm.canvas.search_user_placeholder')}
                    value={modalSearchTerm}
                    onChange={(e) => setModalSearchTerm(e.target.value)}
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              )}

              {groupUsers.length > 0 ? (
                <div className="pt-2 space-y-2">
                  {groupUsers.filter((u: any) => u.name?.toLowerCase().includes(modalSearchTerm.toLowerCase()) || u.email?.toLowerCase().includes(modalSearchTerm.toLowerCase())).map((u: any) => {
                    const isChecked = selectedUsersInModal === 'all' || (Array.isArray(selectedUsersInModal) && selectedUsersInModal.includes(u.id));
                    return (
                      <label key={u.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${isChecked && selectedUsersInModal !== 'all' ? 'bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800' : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50'}`}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={selectedUsersInModal === 'all'}
                          onChange={(e) => {
                            if (selectedUsersInModal === 'all') return;
                            const current = Array.isArray(selectedUsersInModal) ? selectedUsersInModal : [];
                            if (e.target.checked) {
                              setSelectedUsersInModal([...current, u.id]);
                            } else {
                              setSelectedUsersInModal(current.filter(id => id !== u.id));
                            }
                          }}
                          className="w-4 h-4 text-indigo-600 rounded border-neutral-300 focus:ring-indigo-600 disabled:opacity-50"
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-neutral-900 dark:text-white">{u.name}</span>
                          {u.email && <span className="text-xs text-neutral-500">{u.email}</span>}
                        </div>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-neutral-500 border border-dashed rounded-xl border-neutral-200 dark:border-neutral-800">
                  {t('bpm.canvas.no_users_found_group')}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between items-center pt-4 border-t border-neutral-100 dark:border-neutral-800 mt-4">
            <button
              onClick={() => {
                if (selectedNode && selectedGroupForModal) {
                  const currentGroupsUsers: Record<string, any> = { ...(selectedNode.data?.emailGroupsUsers || {}) };
                  delete currentGroupsUsers[selectedGroupForModal.name];
                  updateNodeData(selectedNode.id, { emailGroupsUsers: currentGroupsUsers });
                  setSelectedGroupForModal(null);
                }
              }}
              className="text-sm text-red-600 hover:text-red-700 font-medium px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              {t('bpm.canvas.remove_group')}
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedGroupForModal(null)}
                className="px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => {
                  if (selectedNode && selectedGroupForModal) {
                    const currentGroupsUsers: Record<string, any> = { ...(selectedNode.data?.emailGroupsUsers || {}) };
                    currentGroupsUsers[selectedGroupForModal.name] = selectedUsersInModal;
                    updateNodeData(selectedNode.id, { emailGroupsUsers: currentGroupsUsers });
                    setSelectedGroupForModal(null);
                  }
                }}
                className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
              >
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal de Configuração de E-mail */}
      <Modal
        isOpen={!!editingEmailNode}
        onClose={() => setEditingEmailNode(null)}
        title={t('bpm.canvas.configure_email')}
        size="2xl"
      >
        <div className="space-y-4">
          <div className="bg-neutral-50 dark:bg-neutral-900/50 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest block mb-2">{t('bpm.canvas.visual_template')}</label>
            <select 
              value={tempEmailData.template}
              onChange={(e) => setTempEmailData((prev: any) => ({ ...prev, template: e.target.value as EmailTemplateType }))}
              className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 mb-4"
            >
              <option value="free">{t('bpm.canvas.template_free')}</option>
              <option value="modern">{t('bpm.canvas.template_modern')}</option>
              <option value="alert">{t('bpm.canvas.template_alert')}</option>
              <option value="classic">{t('bpm.canvas.template_classic')}</option>
            </select>

            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest block mb-1">{t('bpm.canvas.subject')}</label>
              <select 
                value=""
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  const currentText = tempEmailData.subject;
                  let newText = currentText + ` {{${val}}}`;
                  if (cursorPos && cursorPos.field === 'actionSubject') {
                    newText = currentText.substring(0, cursorPos.start) + `{{${val}}}` + currentText.substring(cursorPos.end);
                  }
                  setTempEmailData((prev: any) => ({ ...prev, subject: newText }));
                  e.target.value = '';
                  setCursorPos(null);
                }}
                className="bg-transparent border-none text-[10px] text-indigo-500 font-bold uppercase tracking-widest cursor-pointer focus:ring-0 w-28 text-right p-0"
              >
                <option value="" className="text-left text-neutral-900 dark:text-neutral-100 normal-case tracking-normal text-sm font-normal">{t('bpm.canvas.plus_variable')}</option>
                {[...dbModels].sort((a, b) => (a.display_name || a.db_table_name || a.name).localeCompare(b.display_name || b.db_table_name || b.name)).map(m => {
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
              placeholder={t('bpm.canvas.subject_placeholder')}
              value={tempEmailData.subject} 
              onChange={(e) => setTempEmailData((prev: any) => ({ ...prev, subject: e.target.value }))}
              onBlur={(e) => setCursorPos({ field: 'actionSubject', start: e.target.selectionStart || 0, end: e.target.selectionEnd || 0 })}
              className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="bg-neutral-50 dark:bg-neutral-900/50 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest block mb-1">{t('bpm.canvas.body_html_text')}</label>
              <select 
                value=""
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  // Como o RichText usa contentEditable, a posição do cursor não é fácil de pegar com selectionStart, vamos inserir no final
                  const newText = tempEmailData.body + ` {{${val}}}`;
                  setTempEmailData((prev: any) => ({ ...prev, body: newText }));
                  e.target.value = '';
                }}
                className="bg-transparent border-none text-[10px] text-indigo-500 font-bold uppercase tracking-widest cursor-pointer focus:ring-0 w-28 text-right p-0"
              >
                <option value="" className="text-left text-neutral-900 dark:text-neutral-100 normal-case tracking-normal text-sm font-normal">{t('bpm.canvas.plus_variable')}</option>
                {[...dbModels].sort((a, b) => (a.display_name || a.db_table_name || a.name).localeCompare(b.display_name || b.db_table_name || b.name)).map(m => {
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
              value={tempEmailData.body}
              onChange={(val: any) => setTempEmailData((prev: any) => ({ ...prev, body: val }))}
              placeholder={t('bpm.canvas.body_placeholder')}
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => setIsPreviewEmailOpen(true)}
              className="flex-none px-4 py-3 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
              title={t('bpm.canvas.preview')}
            >
              {t('bpm.canvas.preview')}
            </button>
            <button
              onClick={() => setEditingEmailNode(null)}
              className="flex-1 px-4 py-3 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white rounded-xl font-bold transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={() => {
                if (editingEmailNode) {
                  updateNodeData(editingEmailNode, {
                    actionSubject: tempEmailData.subject,
                    actionBody: tempEmailData.body,
                    emailTemplate: tempEmailData.template
                  });
                  setEditingEmailNode(null);
                }
              }}
              className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
            >
              <Check size={18} />
              {t('bpm.canvas.save_config')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal de Preview de E-mail */}
      <Modal
        isOpen={isPreviewEmailOpen}
        onClose={() => setIsPreviewEmailOpen(false)}
        title={t('bpm.canvas.email_preview_title')}
        size="4xl"
        zIndex={200}
      >
        <div className="space-y-4">
          <div className="bg-neutral-100 dark:bg-neutral-900 rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800" style={{ height: '600px' }}>
            <iframe 
              srcDoc={wrapEmailInTemplate(tempEmailData.template, tempEmailData.body || `<p>${t('bpm.canvas.type_something_preview')}</p>`)} 
              className="w-full h-full border-none"
              title="Email Preview"
            />
          </div>
          <div className="flex justify-end pt-2">
            <button
              onClick={() => setIsPreviewEmailOpen(false)}
              className="px-6 py-3 text-sm font-bold text-white bg-neutral-800 hover:bg-neutral-900 dark:bg-neutral-700 dark:hover:bg-neutral-600 rounded-xl transition-colors shadow-sm"
            >
              {t('bpm.canvas.close_preview')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal de Exclusão */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={t('bpm.canvas.delete_flow_title')}
        description={t('bpm.canvas.delete_flow_confirm')}
      >
        <div className="space-y-6">
          <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl flex gap-4 text-red-600 dark:text-red-400">
            <Trash2 className="w-5 h-5 shrink-0" />
            <div className="text-sm">
              <p className="font-bold mb-1">{t('common.attention')}</p>
              <p>{t('bpm.canvas.delete_flow_warning')}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              className="flex-1 px-4 py-3 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white rounded-xl font-bold transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={confirmDelete}
              className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-colors"
            >
              {t('bpm.canvas.yes_delete_flow')}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
