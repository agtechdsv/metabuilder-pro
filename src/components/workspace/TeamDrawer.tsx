'use client'

import { useState, useEffect } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { useToast } from '@/components/ui/Toast'
import { useRouter } from 'next/navigation'
import {
  Users,
  Shield,
  AlertCircle,
  UserPlus,
  Mail,
  Loader2
} from 'lucide-react'
import { getStudioTeamData } from '@/app/actions/workspace'
import { useI18n } from '@/i18n'

import { Guest, TeamData } from './team/types'
import { TeamMemberListItem } from './team/TeamMemberListItem'
import { GuestAccessModal } from './team/GuestAccessModal'
import { RemoveGuestModal } from './team/RemoveGuestModal'
import { ResetMfaModal } from './team/ResetMfaModal'

interface TeamDrawerProps {
  isOpen: boolean
  onClose: () => void
  onRequestSubscriptionUpdate?: () => void
}

export function TeamDrawer({ isOpen, onClose, onRequestSubscriptionUpdate }: TeamDrawerProps) {
  const { t } = useI18n()
  const [teamData, setTeamData] = useState<TeamData | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const [isInvitingGuest, setIsInvitingGuest] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [selectedGuestAccess, setSelectedGuestAccess] = useState<Guest | null>(null)
  const [guestWorkspaces, setGuestWorkspaces] = useState<{ id: string; can_create: boolean; can_edit: boolean; can_delete: boolean }[]>([])
  const [guestProjects, setGuestProjects] = useState<{ id: string; can_create: boolean; can_edit: boolean; can_deactivate: boolean; can_delete: boolean }[]>([])
  const [guestAccessLevel, setGuestAccessLevel] = useState<'global' | 'granular'>('granular')
  const [isSavingAccess, setIsSavingAccess] = useState(false)
  const [isDeleteGuestModalOpen, setIsDeleteGuestModalOpen] = useState(false)
  const [guestToDelete, setGuestToDelete] = useState<string | null>(null)
  const [isDeletingGuest, setIsDeletingGuest] = useState(false)
  const [resendingGuestId, setResendingGuestId] = useState<string | null>(null)
  const [guestToResetMfa, setGuestToResetMfa] = useState<string | null>(null)
  const [isResettingMfa, setIsResettingMfa] = useState(false)

  const { toast } = useToast()
  const router = useRouter()

  const loadTeamData = async () => {
    setIsLoading(true)
    const result = await getStudioTeamData()
    if (result.success && result.data) {
      setTeamData(result.data)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    if (isOpen && !teamData) {
      loadTeamData()
    }
  }, [isOpen])

  const handleResendInvite = async (email: string | null, guestId: string) => {
    if (!email) return
    setResendingGuestId(guestId)
    try {
      const { resendStudioGuestInvite } = await import('@/app/actions/workspace')
      const res = await resendStudioGuestInvite(email)
      if (res.success) {
        toast(res.message || t('team_drawer.invite_resent_toast', 'Convite reenviado!'), 'success')
      } else {
        toast(res.error || t('team_drawer.invite_resend_error', 'Erro ao reenviar convite.'), 'error')
      }
    } catch (err: any) {
      toast(err.message || t('team_drawer.resend_process_error', 'Erro ao processar reenvio.'), 'error')
    } finally {
      setResendingGuestId(null)
    }
  }

  const handleInviteGuest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail) return
    setIsInvitingGuest(true)
    try {
      const { inviteStudioGuest } = await import('@/app/actions/workspace')
      const res = await inviteStudioGuest(inviteEmail)
      if (res.success) {
        toast(res.message || t('team_drawer.invite_sent_toast', 'Convite enviado!'), 'success')
        setInviteEmail('')
        loadTeamData()
      } else {
        toast(res.error || t('team_drawer.invite_error_toast', 'Erro ao convidar usuário.'), 'error')
      }
    } catch (err: any) {
      toast(err.message || t('team_drawer.invite_process_error', 'Erro ao processar convite.'), 'error')
    } finally {
      setIsInvitingGuest(false)
    }
  }

  const handleRemoveGuest = (guestUserId: string) => {
    setGuestToDelete(guestUserId)
    setIsDeleteGuestModalOpen(true)
  }

  const handleConfirmRemoveGuest = async () => {
    if (!guestToDelete) return
    setIsDeletingGuest(true)
    try {
      const { removeStudioGuest } = await import('@/app/actions/workspace')
      const res = await removeStudioGuest(guestToDelete)
      if (res.success) {
        toast(t('team_drawer.remove_guest_success', 'Convidado removido com sucesso.'), 'success')
        setIsDeleteGuestModalOpen(false)
        setGuestToDelete(null)
        loadTeamData()
      } else {
        toast(res.error || t('team_drawer.remove_guest_error', 'Erro ao remover convidado.'), 'error')
      }
    } catch (err: any) {
      toast(err.message || t('team_drawer.remove_guest_process_error', 'Erro ao processar remoção.'), 'error')
    } finally {
      setIsDeletingGuest(false)
    }
  }

  const handleConfirmResetMfa = async () => {
    if (!guestToResetMfa) return
    setIsResettingMfa(true)
    try {
      const { resetMemberMfa } = await import('@/app/auth/actions')
      const res = await resetMemberMfa(guestToResetMfa)
      if (res.success) {
        toast(t('team_drawer.mfa_reset_success', 'MFA do usuário resetado com sucesso!'), 'success')
        setGuestToResetMfa(null)
      } else {
        toast(res.error || t('team_drawer.mfa_reset_error', 'Erro ao resetar MFA.'), 'error')
      }
    } catch (err: any) {
      toast(err.message || t('team_drawer.mfa_reset_process_error', 'Erro ao processar reset de MFA.'), 'error')
    } finally {
      setIsResettingMfa(false)
    }
  }

  const openAccessEditor = (guest: Guest) => {
    setSelectedGuestAccess(guest)
    setGuestAccessLevel(guest.access_level)
    setGuestWorkspaces(
      guest.workspaces.map((w) => ({
        id: w.workspace_id,
        can_create: w.can_create || false,
        can_edit: w.can_edit || false,
        can_delete: w.can_delete || false
      }))
    )
    setGuestProjects(
      guest.projects.map((p) => ({
        id: p.project_id,
        can_create: p.can_create || false,
        can_edit: p.can_edit || false,
        can_deactivate: p.can_deactivate || false,
        can_delete: p.can_delete || false
      }))
    )
  }

  const handleSaveGuestAccess = async () => {
    if (!selectedGuestAccess) return
    setIsSavingAccess(true)
    try {
      const { updateGuestAccess } = await import('@/app/actions/workspace')
      const res = await updateGuestAccess(
        selectedGuestAccess.user_id,
        guestAccessLevel,
        guestWorkspaces,
        guestProjects
      )
      if (res.success) {
        toast(t('team_drawer.permissions_saved_success', 'Permissões atualizadas com sucesso.'), 'success')
        setSelectedGuestAccess(null)
        loadTeamData()
      } else {
        toast(res.error || t('team_drawer.permissions_saved_error', 'Erro ao atualizar permissões.'), 'error')
      }
    } catch (err: any) {
      toast(err.message || t('team_drawer.permissions_save_process_error', 'Erro ao salvar permissões.'), 'error')
    } finally {
      setIsSavingAccess(false)
    }
  }

  const handleUpgradeClick = () => {
    if (onRequestSubscriptionUpdate) {
      onRequestSubscriptionUpdate()
      onClose()
    } else {
      router.push('/checkout')
    }
  }

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title={t('team_drawer.title', 'Gerenciamento de Equipe do Studio')}
      >
        <div className="space-y-6 relative">
          {isLoading && !teamData && (
            <div className="absolute inset-0 bg-white/50 dark:bg-[#050505]/50 z-10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
          )}

          {/* Quota Banner */}
          <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 block">
                {t('team_drawer.guest_licenses', 'Licenças de Convidados')}
              </span>
              <p className="text-sm font-bold text-neutral-900 dark:text-white mt-1">
                {t('team_drawer.guests_count', '{used} de {allowed} convidados contratados')
                  .replace('{used}', String(teamData?.usedGuests ?? 0))
                  .replace('{allowed}', String(teamData?.allowedGuests ?? 0))}
              </p>
            </div>
            <Users className="w-5 h-5 text-indigo-500" />
          </div>

          {/* Invite Form / Premium Upsell */}
          {teamData && teamData.allowedGuests === 0 ? (
            <div className="relative p-6 rounded-3xl overflow-hidden bg-gradient-to-br from-indigo-900 to-indigo-950 dark:from-neutral-900 dark:to-neutral-950 border border-indigo-500/25 dark:border-neutral-800 text-white shadow-xl shadow-indigo-500/5">
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-500/20 rounded-full blur-[40px]" />

              <div className="relative z-10 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-500/20 text-indigo-300 rounded-xl">
                    <Shield className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">
                    {t('team_drawer.premium_feature', 'Recurso Premium')}
                  </span>
                </div>

                <div className="space-y-1">
                  <h4 className="text-sm font-black">
                    {t('team_drawer.multiply_prod_title', 'Multiplique sua Produtividade')}
                  </h4>
                  <p className="text-[11px] text-neutral-300 leading-relaxed">
                    {t(
                      'team_drawer.multiply_prod_desc',
                      'Convide desenvolvedores / analistas para atuar juntos no seu Studio. Defina quais workspaces e projetos cada membro pode gerenciar de forma granular.'
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleUpgradeClick}
                  className="inline-flex w-full items-center justify-center h-10 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 cursor-pointer"
                >
                  {t('team_drawer.unlock_teamwork_btn', 'Liberar Trabalho em Equipe')}
                </button>
              </div>
            </div>
          ) : teamData && teamData.usedGuests >= teamData.allowedGuests ? (
            <div className="p-5 border border-amber-200/55 dark:border-amber-900/30 rounded-2xl bg-amber-500/5 dark:bg-amber-500/5 space-y-3">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-505">
                <AlertCircle className="w-4 h-4" />
                <h4 className="text-xs font-bold">{t('team_drawer.limit_reached_title', 'Limite de Convidados Atingido')}</h4>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                {t(
                  'team_drawer.limit_reached_desc',
                  'Você atingiu o limite de {allowed} convidados do seu plano atual. Remova algum membro existente ou faça upgrade para liberar mais licenças.'
                ).replace('{allowed}', String(teamData.allowedGuests))}
              </p>
              <button
                type="button"
                onClick={handleUpgradeClick}
                className="inline-flex items-center text-xs font-bold text-indigo-650 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors cursor-pointer"
              >
                {t('team_drawer.add_licenses_link', 'Adicionar licenças de convidados →')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleInviteGuest} className="p-5 border border-neutral-200 dark:border-neutral-800 rounded-2xl bg-neutral-50 dark:bg-neutral-950 space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-neutral-500 flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> {t('team_drawer.invite_member_title', 'Convidar Membro para o Studio')}
              </h4>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="email"
                    required
                    placeholder={t('team_drawer.email_placeholder', 'email@exemplo.com')}
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs focus:border-indigo-500 outline-none transition-all dark:text-white"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isInvitingGuest}
                  className="h-11 px-5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-400 text-white text-xs font-bold rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-1.5"
                >
                  {isInvitingGuest ? t('team_drawer.inviting_btn', 'Enviando...') : t('team_drawer.invite_btn', 'Convidar')}
                </button>
              </div>
            </form>
          )}

          {/* Members List */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
              {t('team_drawer.members_title', 'Membros da Equipe')}
            </h4>
            {teamData?.guests && teamData.guests.length > 0 ? (
              <ul className="divide-y divide-neutral-100 dark:divide-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-2xl bg-white dark:bg-neutral-950 shadow-sm">
                {teamData.guests.map((guest) => (
                  <TeamMemberListItem
                    key={guest.id}
                    guest={guest}
                    teamData={teamData}
                    resendingGuestId={resendingGuestId}
                    onResetMfa={(userId) => setGuestToResetMfa(userId)}
                    onRemoveGuest={handleRemoveGuest}
                    onResendInvite={handleResendInvite}
                    onOpenAccessEditor={openAccessEditor}
                  />
                ))}
              </ul>
            ) : (
              <div className="p-8 text-center border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl text-neutral-500">
                <Users className="w-8 h-8 text-neutral-300 dark:text-neutral-700 mx-auto mb-2" />
                <p className="text-xs font-medium">{t('team_drawer.no_guests', 'Nenhum convidado adicionado à sua equipe.')}</p>
              </div>
            )}
          </div>
        </div>
      </Drawer>

      <GuestAccessModal
        selectedGuestAccess={selectedGuestAccess}
        onClose={() => setSelectedGuestAccess(null)}
        teamData={teamData}
        guestAccessLevel={guestAccessLevel}
        setGuestAccessLevel={setGuestAccessLevel}
        guestWorkspaces={guestWorkspaces}
        setGuestWorkspaces={setGuestWorkspaces}
        guestProjects={guestProjects}
        setGuestProjects={setGuestProjects}
        onSave={handleSaveGuestAccess}
        isSaving={isSavingAccess}
      />

      <RemoveGuestModal
        isOpen={isDeleteGuestModalOpen}
        onClose={() => {
          setIsDeleteGuestModalOpen(false)
          setGuestToDelete(null)
        }}
        onConfirm={handleConfirmRemoveGuest}
        isDeleting={isDeletingGuest}
      />

      <ResetMfaModal
        isOpen={!!guestToResetMfa}
        onClose={() => setGuestToResetMfa(null)}
        onConfirm={handleConfirmResetMfa}
        isResetting={isResettingMfa}
      />
    </>
  )
}
