import React from 'react';
import Link from 'next/link';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import { ActionModalGeneralTab } from './ActionModalGeneralTab';
import { ActionModalTriggerTab } from './ActionModalTriggerTab';
import { Workflow } from 'lucide-react';

export interface CustomActionModalProps {
  isActionModalOpen: boolean;
  setIsActionModalOpen: (isOpen: boolean) => void;
  editingAction: any;
  setEditingAction: (action: any) => void;
  activeModalTab: 'general' | 'trigger' | 'appearance' | 'bpm';
  setActiveModalTab: (tab: 'general' | 'trigger' | 'appearance' | 'bpm') => void;
  isIconPickerOpen: boolean;
  setIsIconPickerOpen: (isOpen: boolean) => void;
  handleSaveAction: (action: any) => void;
  bpmWorkflows: any[];
  workspace_slug: string;
  project_slug: string;
  config: any;
  models: any[];
  useCases: any[];
  relations: any[];
  t: (key: string, defaultText?: string) => string;
  isDownloadsActive?: boolean;
}

export function CustomActionModal({
  isActionModalOpen,
  setIsActionModalOpen,
  editingAction,
  setEditingAction,
  activeModalTab,
  setActiveModalTab,
  isIconPickerOpen,
  setIsIconPickerOpen,
  handleSaveAction,
  bpmWorkflows,
  workspace_slug,
  project_slug,
  config,
  models,
  useCases,
  relations,
  t,
  isDownloadsActive
}: CustomActionModalProps) {
  return (
    <Modal
      isOpen={isActionModalOpen}
      onClose={() => setIsActionModalOpen(false)}
      title={editingAction?.id ? t('wizard.actions.custom_action_edit', 'Editar Ação') : t('wizard.actions.custom_action_new', 'Nova Ação')}
      size="2xl"
    >
      {editingAction && (
        <div className="space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar p-1">
          {/* Nav Tabs */}
          <div className="flex border-b border-neutral-200 dark:border-neutral-800 -mx-1 mb-4 shrink-0">
            <button
              type="button"
              onClick={() => setActiveModalTab('general')}
              className={cn(
                "px-5 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2",
                activeModalTab === 'general'
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              )}
            >
              <span className={cn(
                "w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] border",
                activeModalTab === 'general' ? "bg-indigo-600 border-indigo-600 text-white font-bold" : "border-neutral-300 dark:border-neutral-700"
              )}>1</span>
              {t('wizard.actions.tab_identification', 'Identificação')}
            </button>
            <button
              type="button"
              onClick={() => setActiveModalTab('trigger')}
              className={cn(
                "px-5 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2",
                activeModalTab === 'trigger'
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              )}
            >
              <span className={cn(
                "w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] border",
                activeModalTab === 'trigger' ? "bg-indigo-600 border-indigo-600 text-white font-bold" : "border-neutral-300 dark:border-neutral-700"
              )}>2</span>
              {t('wizard.actions.tab_behavior', 'Comportamento')}
            </button>
            <button
              type="button"
              onClick={() => setActiveModalTab('bpm')}
              className={cn(
                "px-5 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2",
                activeModalTab === 'bpm'
                  ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                  : "border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              )}
            >
              <span className={cn(
                "w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] border",
                activeModalTab === 'bpm' ? "bg-emerald-600 border-emerald-600 text-white font-bold" : "border-neutral-300 dark:border-neutral-700"
              )}>3</span>
              {t('wizard.actions.tab_bpm', 'BPM / Automação')}
            </button>
          </div>

          {/* General Tab */}
          {activeModalTab === 'general' && (
            <ActionModalGeneralTab
              editingAction={editingAction}
              setEditingAction={setEditingAction}
              isIconPickerOpen={isIconPickerOpen}
              setIsIconPickerOpen={setIsIconPickerOpen}
              t={t}
              config={config}
              models={models}
              useCases={useCases}
              relations={relations}
            />
          )}
  
          {/* Trigger Tab */}
          {activeModalTab === 'trigger' && (
            <ActionModalTriggerTab
              editingAction={editingAction}
              setEditingAction={setEditingAction}
              t={t}
              config={config}
              models={models}
              useCases={useCases}
              relations={relations}
              isDownloadsActive={isDownloadsActive}
            />
          )}
  
          {/* BPM / Automação Tab */}
          {activeModalTab === 'bpm' && (
            <div className="grid grid-cols-1 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="space-y-4">
                <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-4 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-800/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                    <Workflow className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-1">{t('wizard.actions.bpm_integration_title', 'Integração com BPM')}</h4>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300/80 leading-relaxed">
                      {t('wizard.actions.bpm_integration_desc', 'Selecione quais fluxos automatizados (BPM) serão disparados quando o usuário clicar neste botão. Você também pode configurar esta ligação diretamente na tela de Automações.')}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.actions.available_workflows', 'Workflows Disponíveis')}</label>
                  <div className="grid grid-cols-1 gap-2 p-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl max-h-[300px] overflow-y-auto custom-scrollbar">
                    {bpmWorkflows.length === 0 ? (
                      <div className="text-center py-6">
                        <p className="text-xs text-neutral-500">{t('wizard.actions.no_workflows', 'Nenhum fluxo de automação criado neste projeto.')}</p>
                        <Link href={`/admin/${workspace_slug}/${project_slug}/automations`} target="_blank" className="text-xs text-emerald-600 hover:underline font-bold mt-2 inline-block">
                          {t('wizard.actions.create_first_flow', 'Criar Primeiro Fluxo')}
                        </Link>
                      </div>
                    ) : (
                      bpmWorkflows.map((workflow: any) => {
                        const linkedWorkflows = editingAction.linked_bpm_workflows || [];
                        const isChecked = linkedWorkflows.includes(workflow.id);
                        return (
                          <label key={workflow.id} className={cn(
                            "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border-2",
                            isChecked
                              ? "bg-white dark:bg-neutral-800 border-emerald-500 shadow-sm"
                              : "bg-white dark:bg-neutral-800 border-transparent hover:border-emerald-200 dark:hover:border-emerald-800"
                          )}>
                            <div className={cn(
                              "w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all",
                              isChecked ? "bg-emerald-500 text-white" : "border-2 border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-900"
                            )}>
                              {isChecked && <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn("text-sm font-bold truncate transition-colors", isChecked ? "text-emerald-700 dark:text-emerald-400" : "text-neutral-700 dark:text-neutral-300")}>
                                {workflow.name}
                              </p>
                            </div>
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={isChecked}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...linkedWorkflows, workflow.id]
                                  : linkedWorkflows.filter((id: string) => id !== workflow.id);
                                setEditingAction({ ...editingAction, linked_bpm_workflows: next });
                              }}
                            />
                          </label>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-6 border-t border-neutral-100 dark:border-neutral-800 mt-6">
            <button type="button" onClick={() => setIsActionModalOpen(false)} className="flex-1 px-4 py-3 bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all">{t('common.cancel', 'Cancelar')}</button>
            <button type="button" onClick={() => handleSaveAction(editingAction)} className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-500 shadow-xl shadow-indigo-500/20 transition-all active:scale-95">{t('wizard.actions.save_action', 'Salvar Ação')}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
