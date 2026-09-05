'use client'

import React from 'react'
import { Modal } from '@/components/ui/Modal'
import { Shield, Lock, Plus, Pencil, Trash2, Power } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'
import { Guest, TeamData } from './types'

interface GuestAccessModalProps {
  selectedGuestAccess: Guest | null
  onClose: () => void
  teamData: TeamData | null
  guestAccessLevel: 'global' | 'granular'
  setGuestAccessLevel: (level: 'global' | 'granular') => void
  guestWorkspaces: { id: string; can_create: boolean; can_edit: boolean; can_delete: boolean }[]
  setGuestWorkspaces: React.Dispatch<React.SetStateAction<{ id: string; can_create: boolean; can_edit: boolean; can_delete: boolean }[]>>
  guestProjects: { id: string; can_create: boolean; can_edit: boolean; can_deactivate: boolean; can_delete: boolean }[]
  setGuestProjects: React.Dispatch<React.SetStateAction<{ id: string; can_create: boolean; can_edit: boolean; can_deactivate: boolean; can_delete: boolean }[]>>
  onSave: () => void
  isSaving: boolean
}

export function GuestAccessModal({
  selectedGuestAccess,
  onClose,
  teamData,
  guestAccessLevel,
  setGuestAccessLevel,
  guestWorkspaces,
  setGuestWorkspaces,
  guestProjects,
  setGuestProjects,
  onSave,
  isSaving
}: GuestAccessModalProps) {
  const { t } = useI18n()

  const toggleWorkspacePermission = (wsId: string, permission: 'can_create' | 'can_edit' | 'can_delete') => {
    setGuestWorkspaces((prev) =>
      prev.map((w) => (w.id === wsId ? { ...w, [permission]: !w[permission] } : w))
    )
  }

  const toggleProjectPermission = (
    projId: string,
    permission: 'can_create' | 'can_edit' | 'can_deactivate' | 'can_delete'
  ) => {
    setGuestProjects((prev) =>
      prev.map((p) => (p.id === projId ? { ...p, [permission]: !p[permission] } : p))
    )
  }

  return (
    <Modal
      isOpen={!!selectedGuestAccess}
      onClose={onClose}
      title={t('team_drawer.permissions_modal_title', 'Permissões — {name}').replace(
        '{name}',
        selectedGuestAccess?.full_name || selectedGuestAccess?.email || ''
      )}
      description={t(
        'team_drawer.permissions_modal_desc',
        'Configure quais Workspaces e Projetos este colaborador pode visualizar e atuar. Ele não terá acesso ao que não for selecionado abaixo.'
      )}
      size="2xl"
      zIndex={300}
    >
      <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-1">
        <p className="text-xs text-neutral-550 dark:text-neutral-450 leading-relaxed">
          {t(
            'team_drawer.permissions_modal_desc',
            'Configure quais Workspaces e Projetos este colaborador pode visualizar e atuar. Ele não terá acesso ao que não for selecionado abaixo.'
          )}
        </p>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
            {t('team_drawer.general_level_label', 'Nível Geral de Acesso')}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setGuestAccessLevel('global')}
              className={`p-4 border rounded-2xl flex flex-col items-start gap-2 text-left transition-all ${
                guestAccessLevel === 'global'
                  ? 'border-indigo-650 bg-indigo-50/20 dark:bg-indigo-500/10'
                  : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs text-neutral-900 dark:text-white">
                <Shield className="w-4 h-4 text-indigo-500" /> {t('team_drawer.global_access', 'Acesso Global')}
              </div>
              <span className="text-[10px] text-neutral-500 leading-normal">
                {t(
                  'team_drawer.global_card_desc',
                  'Acesso completo e irrestrito a todos os workspaces e projetos do Studio.'
                )}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setGuestAccessLevel('granular')}
              className={`p-4 border rounded-2xl flex flex-col items-start gap-2 text-left transition-all ${
                guestAccessLevel === 'granular'
                  ? 'border-indigo-650 bg-indigo-50/20 dark:bg-indigo-500/10'
                  : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs text-neutral-900 dark:text-white">
                <Lock className="w-4 h-4 text-indigo-500" /> {t('team_drawer.granular_access', 'Acesso Granular')}
              </div>
              <span className="text-[10px] text-neutral-500 leading-normal">
                {t(
                  'team_drawer.granular_card_desc',
                  'Selecione individualmente quais Workspaces e quais Projetos estarão liberados.'
                )}
              </span>
            </button>
          </div>
        </div>

        {guestAccessLevel === 'granular' && (
          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 block">
              {t('team_drawer.authorized_ws_and_projects', 'Workspaces e Projetos Autorizados')}
            </label>

            {teamData?.workspaces && teamData.workspaces.length > 0 ? (
              <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
                {teamData.workspaces.map((ws) => {
                  const isWsChecked = guestWorkspaces.some((w) => w.id === ws.id)
                  const isWsCreateChecked = guestWorkspaces.find((w) => w.id === ws.id)?.can_create || false
                  const isWsEditChecked = guestWorkspaces.find((w) => w.id === ws.id)?.can_edit || false
                  const isWsDeleteChecked = guestWorkspaces.find((w) => w.id === ws.id)?.can_delete || false
                  const wsProjects = teamData.projects.filter((p) => p.workspace_id === ws.id)

                  return (
                    <div
                      key={ws.id}
                      className="border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 bg-neutral-50 dark:bg-neutral-900/40 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <label className="flex items-center gap-2.5 cursor-pointer font-bold text-xs text-neutral-900 dark:text-white">
                            <input
                              type="checkbox"
                              checked={isWsChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setGuestWorkspaces([
                                    ...guestWorkspaces,
                                    { id: ws.id, can_create: false, can_edit: false, can_delete: false },
                                  ])
                                  setGuestProjects([
                                    ...guestProjects,
                                    ...wsProjects.map((p) => ({
                                      id: p.id,
                                      can_create: false,
                                      can_edit: false,
                                      can_deactivate: false,
                                      can_delete: false,
                                    })),
                                  ])
                                } else {
                                  setGuestWorkspaces(guestWorkspaces.filter((w) => w.id !== ws.id))
                                  setGuestProjects(guestProjects.filter((p) => !wsProjects.some((wp) => wp.id === p.id)))
                                }
                              }}
                              className="w-4 h-4 text-indigo-600 border-neutral-300 dark:border-neutral-700 rounded focus:ring-indigo-500 bg-white dark:bg-neutral-900"
                            />
                            {ws.name}
                          </label>
                          <span className="text-[9px] text-neutral-500 font-mono bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded">
                            /{ws.slug}
                          </span>
                        </div>

                        {isWsChecked && (
                          <div className="flex items-center gap-1.5 self-end sm:self-auto">
                            <button
                              type="button"
                              onClick={() => toggleWorkspacePermission(ws.id, 'can_create')}
                              className={cn(
                                'px-2 py-1 rounded-lg border transition-all flex items-center justify-center gap-1 text-[9px] font-black uppercase tracking-wider cursor-pointer active:scale-95',
                                isWsCreateChecked
                                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 border-transparent hover:text-neutral-600 dark:hover:text-neutral-300'
                              )}
                              title={t('team_drawer.permit_create_proj', 'Permitir criar projetos')}
                            >
                              <Plus className="w-3 h-3" /> {t('team_drawer.btn_new', 'NOVO')}
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleWorkspacePermission(ws.id, 'can_edit')}
                              className={cn(
                                'px-2 py-1 rounded-lg border transition-all flex items-center justify-center gap-1 text-[9px] font-black uppercase tracking-wider cursor-pointer active:scale-95',
                                isWsEditChecked
                                  ? 'bg-amber-500/10 text-amber-550 border-amber-500/30'
                                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 border-transparent hover:text-neutral-600 dark:hover:text-neutral-300'
                              )}
                              title={t('team_drawer.permit_edit_ws', 'Permitir editar workspace')}
                            >
                              <Pencil className="w-3 h-3" /> {t('team_drawer.btn_edit', 'EDITAR')}
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleWorkspacePermission(ws.id, 'can_delete')}
                              className={cn(
                                'px-2 py-1 rounded-lg border transition-all flex items-center justify-center gap-1 text-[9px] font-black uppercase tracking-wider cursor-pointer active:scale-95',
                                isWsDeleteChecked
                                  ? 'bg-red-500/10 text-red-500 border-red-500/30'
                                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 border-transparent hover:text-neutral-600 dark:hover:text-neutral-300'
                              )}
                              title={t('team_drawer.permit_delete_proj', 'Permitir excluir projetos')}
                            >
                              <Trash2 className="w-3 h-3" /> {t('team_drawer.btn_delete', 'EXCLUIR')}
                            </button>
                          </div>
                        )}
                      </div>

                      {isWsChecked && wsProjects.length > 0 && (
                        <div className="pl-6 pt-3 border-t border-neutral-200/50 dark:border-neutral-800/50 space-y-2">
                          <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-2">
                            {t('team_drawer.released_projects', 'Projetos Liberados')}
                          </p>
                          <div className="flex flex-col gap-2">
                            {wsProjects.map((project) => {
                              const isProjChecked = guestProjects.some((p) => p.id === project.id)
                              const isProjCreateChecked =
                                guestProjects.find((p) => p.id === project.id)?.can_create || false
                              const isProjEditChecked =
                                guestProjects.find((p) => p.id === project.id)?.can_edit || false
                              const isProjDeactivateChecked =
                                guestProjects.find((p) => p.id === project.id)?.can_deactivate || false
                              const isProjDeleteChecked =
                                guestProjects.find((p) => p.id === project.id)?.can_delete || false

                              return (
                                <div
                                  key={project.id}
                                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-1.5 rounded-xl hover:bg-neutral-100/40 dark:hover:bg-neutral-800/20"
                                >
                                  <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-colors">
                                    <input
                                      type="checkbox"
                                      checked={isProjChecked}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setGuestProjects([
                                            ...guestProjects,
                                            {
                                              id: project.id,
                                              can_create: false,
                                              can_edit: false,
                                              can_deactivate: false,
                                              can_delete: false,
                                            },
                                          ])
                                        } else {
                                          setGuestProjects(guestProjects.filter((p) => p.id !== project.id))
                                        }
                                      }}
                                      className="w-3.5 h-3.5 text-indigo-600 border-neutral-300 dark:border-neutral-700 rounded focus:ring-indigo-500 bg-white dark:bg-neutral-900"
                                    />
                                    {project.name}
                                  </label>

                                  {isProjChecked && (
                                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                                      <button
                                        type="button"
                                        onClick={() => toggleProjectPermission(project.id, 'can_create')}
                                        className={cn(
                                          'px-1.5 py-0.5 rounded border transition-all flex items-center justify-center gap-0.5 text-[8px] font-black uppercase cursor-pointer active:scale-95',
                                          isProjCreateChecked
                                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 border-transparent hover:text-neutral-600 dark:hover:text-neutral-300'
                                        )}
                                        title={t('team_drawer.permit_create_tables', 'Permitir criar tabelas/telas')}
                                      >
                                        <Plus className="w-2.5 h-2.5" /> {t('team_drawer.btn_new', 'NOVO')}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => toggleProjectPermission(project.id, 'can_deactivate')}
                                        className={cn(
                                          'px-1.5 py-0.5 rounded border transition-all flex items-center justify-center gap-0.5 text-[8px] font-black uppercase cursor-pointer active:scale-95',
                                          isProjDeactivateChecked
                                            ? 'bg-orange-500/10 text-orange-600 border-orange-500/30'
                                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 border-transparent hover:text-neutral-600 dark:hover:text-neutral-300'
                                        )}
                                        title={t('team_drawer.permit_toggle_proj', 'Permitir ativar/desativar projeto')}
                                      >
                                        <Power className="w-2.5 h-2.5" /> {t('team_drawer.btn_deactivate', 'DESATIVAR')}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => toggleProjectPermission(project.id, 'can_edit')}
                                        className={cn(
                                          'px-1.5 py-0.5 rounded border transition-all flex items-center justify-center gap-0.5 text-[8px] font-black uppercase cursor-pointer active:scale-95',
                                          isProjEditChecked
                                            ? 'bg-amber-500/10 text-amber-550 border-amber-500/30'
                                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 border-transparent hover:text-neutral-600 dark:hover:text-neutral-300'
                                        )}
                                        title={t('team_drawer.permit_edit_proj', 'Permitir editar projeto')}
                                      >
                                        <Pencil className="w-2.5 h-2.5" /> {t('team_drawer.btn_edit', 'EDITAR')}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => toggleProjectPermission(project.id, 'can_delete')}
                                        className={cn(
                                          'px-1.5 py-0.5 rounded border transition-all flex items-center justify-center gap-0.5 text-[8px] font-black uppercase cursor-pointer active:scale-95',
                                          isProjDeleteChecked
                                            ? 'bg-red-500/10 text-red-500 border-red-500/30'
                                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 border-transparent hover:text-neutral-600 dark:hover:text-neutral-300'
                                        )}
                                        title={t('team_drawer.permit_delete_tables', 'Permitir excluir tabelas/telas')}
                                      >
                                        <Trash2 className="w-2.5 h-2.5" /> {t('team_drawer.btn_delete', 'EXCLUIR')}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-neutral-550 dark:text-neutral-450 italic">
                {t('team_drawer.no_workspaces_owned', 'Você não possui nenhum workspace criado no momento.')}
              </p>
            )}
          </div>
        )}

        <div className="pt-6 border-t border-neutral-200 dark:border-neutral-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-850 dark:hover:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-bold rounded-xl transition-colors active:scale-95"
          >
            {t('team_drawer.cancel', 'Cancelar')}
          </button>
          <button
            onClick={onSave}
            disabled={isSaving}
            className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-400 text-white text-xs font-bold rounded-xl transition-colors shadow-lg active:scale-95 flex items-center justify-center gap-1.5"
          >
            {isSaving ? t('team_drawer.saving', 'Salvando...') : t('team_drawer.save_permissions', 'Salvar Permissões')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
