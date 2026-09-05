'use client'

import React from 'react'
import { ShieldAlert, X, Loader2, Send } from 'lucide-react'
import { useI18n } from '@/i18n'
import { Guest, TeamData } from './types'

interface TeamMemberListItemProps {
  guest: Guest
  teamData: TeamData | null
  resendingGuestId: string | null
  onResetMfa: (userId: string) => void
  onRemoveGuest: (userId: string) => void
  onResendInvite: (email: string | null, guestId: string) => void
  onOpenAccessEditor: (guest: Guest) => void
}

export function TeamMemberListItem({
  guest,
  teamData,
  resendingGuestId,
  onResetMfa,
  onRemoveGuest,
  onResendInvite,
  onOpenAccessEditor
}: TeamMemberListItemProps) {
  const { t } = useI18n()

  const allowedWorkspaces = guest.workspaces
    .map((gw) => {
      const name = teamData?.workspaces?.find((w) => w.id === gw.workspace_id)?.name
      if (!name) return null
      const actions = []
      if (gw.can_create) actions.push(t('team_drawer.btn_new', 'NOVO'))
      if (gw.can_delete) actions.push(t('team_drawer.btn_delete', 'EXCLUIR'))
      return `${name}${actions.length > 0 ? ` (${actions.join(' + ')})` : ''}`
    })
    .filter(Boolean) as string[]

  const allowedProjects = guest.projects
    .map((gp) => {
      const name = teamData?.projects?.find((p) => p.id === gp.project_id)?.name
      if (!name) return null
      const actions = []
      if (gp.can_create) actions.push(t('team_drawer.btn_new', 'NOVO'))
      if (gp.can_delete) actions.push(t('team_drawer.btn_delete', 'EXCLUIR'))
      return `${name}${actions.length > 0 ? ` (${actions.join(' + ')})` : ''}`
    })
    .filter(Boolean) as string[]

  return (
    <li className="p-4 flex flex-col gap-3 group hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors first:rounded-t-2xl last:rounded-b-2xl">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 rounded-xl flex items-center justify-center font-bold uppercase text-sm">
            {(guest.full_name || guest.email || 'U')[0]}
          </div>
          <div>
            <p className="text-xs font-bold text-neutral-900 dark:text-white">
              {guest.full_name || t('team_drawer.guest_fallback_name', 'Usuário Convidado')}
            </p>
            <p className="text-[10px] text-neutral-500 mt-0.5">{guest.email}</p>
          </div>
        </div>

        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => onResetMfa(guest.user_id)}
            className="p-2 hover:bg-amber-50 dark:hover:bg-amber-500/10 text-neutral-400 hover:text-amber-500 rounded-lg transition-colors"
            title={t('team_drawer.reset_mfa_tooltip', 'Resetar MFA')}
          >
            <ShieldAlert className="w-4 h-4" />
          </button>
          <button
            onClick={() => onRemoveGuest(guest.user_id)}
            className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 text-neutral-400 hover:text-red-500 rounded-lg transition-colors"
            title={t('team_drawer.remove_guest_tooltip', 'Remover Convidado')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800/50">
        <div className="relative group/badge">
          <div
            className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider cursor-help select-none ${
              guest.access_level === 'global'
                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600'
                : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600'
            }`}
          >
            {t('team_drawer.access_badge', 'Acesso {level}').replace(
              '{level}',
              guest.access_level === 'global'
                ? t('team_drawer.global_access', 'Global')
                : t('team_drawer.granular_access', 'Granular')
            )}
          </div>

          <div className="absolute bottom-full left-0 mb-2.5 hidden group-hover/badge:block w-72 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-2xl p-4 shadow-xl z-[100] pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-200 text-left">
            {guest.access_level === 'global' ? (
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-650 dark:text-indigo-400">
                  {t('team_drawer.access_level_title', 'Nível de Acesso')}
                </p>
                <p className="text-xs font-black text-neutral-900 dark:text-white">
                  {t('team_drawer.global_access', 'Acesso Global')}
                </p>
                <p className="text-[10px] text-neutral-600 dark:text-neutral-350 leading-relaxed mt-1">
                  {t(
                    'team_drawer.global_access_desc',
                    'Permissão total para visualizar, criar e editar todos os Workspaces e Projetos do Studio.'
                  )}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-500">
                    {t('team_drawer.access_level_title', 'Nível de Acesso')}
                  </p>
                  <p className="text-xs font-black text-neutral-900 dark:text-white">
                    {t('team_drawer.granular_access', 'Acesso Granular')}
                  </p>
                </div>

                <div className="space-y-2 border-t border-neutral-100 dark:border-neutral-800 pt-2 text-[10px]">
                  <div>
                    <span className="font-bold text-neutral-450 dark:text-neutral-500 uppercase tracking-wider block mb-1">
                      {t('team_drawer.allowed_workspaces_count', 'Workspaces ({count}):').replace(
                        '{count}',
                        String(allowedWorkspaces.length)
                      )}
                    </span>
                    {allowedWorkspaces.length > 0 ? (
                      <p className="text-neutral-700 dark:text-neutral-200 font-semibold leading-relaxed">
                        {allowedWorkspaces.join(', ')}
                      </p>
                    ) : (
                      <p className="text-neutral-400 dark:text-neutral-600 italic">
                        {t('team_drawer.no_workspaces_granted', 'Nenhum workspace liberado')}
                      </p>
                    )}
                  </div>

                  <div className="pt-1">
                    <span className="font-bold text-neutral-450 dark:text-neutral-500 uppercase tracking-wider block mb-1">
                      {t('team_drawer.allowed_projects_count', 'Projetos ({count}):').replace(
                        '{count}',
                        String(allowedProjects.length)
                      )}
                    </span>
                    {allowedProjects.length > 0 ? (
                      <p className="text-neutral-700 dark:text-neutral-200 font-semibold leading-relaxed">
                        {allowedProjects.join(', ')}
                      </p>
                    ) : (
                      <p className="text-neutral-400 dark:text-neutral-600 italic">
                        {t('team_drawer.no_projects_granted', 'Nenhum projeto liberado')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div className="absolute top-full left-4 -translate-y-1 w-2.5 h-2.5 bg-white dark:bg-neutral-900 border-r border-b border-neutral-200 dark:border-neutral-800 rotate-45" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onResendInvite(guest.email, guest.id)}
            disabled={!guest.email || resendingGuestId === guest.id}
            className="p-2 hover:bg-neutral-100 dark:bg-neutral-800 text-neutral-400 hover:text-indigo-650 dark:text-neutral-350 dark:hover:text-indigo-400 rounded-lg transition-colors disabled:opacity-30 flex items-center justify-center"
            title={t('team_drawer.resend_invite_tooltip', 'Reenviar Convite')}
          >
            {resendingGuestId === guest.id ? (
              <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>

          <button
            onClick={() => onOpenAccessEditor(guest)}
            className="px-3 py-2 bg-neutral-100 hover:bg-indigo-550 dark:bg-neutral-800 dark:hover:bg-indigo-500/10 text-neutral-700 hover:text-indigo-600 dark:text-neutral-300 dark:hover:text-indigo-400 text-[10px] font-bold rounded-lg transition-colors border border-neutral-200 dark:border-neutral-700 hover:border-indigo-100"
          >
            {t('team_drawer.access_btn', 'Acessos')}
          </button>
        </div>
      </div>
    </li>
  )
}
