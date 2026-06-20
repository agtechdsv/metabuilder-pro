'use client'

import { useState, useEffect } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { useRouter } from 'next/navigation'
import { 
  Users, 
  Shield, 
  AlertCircle, 
  UserPlus, 
  Mail, 
  X, 
  Send, 
  Loader2, 
  Lock, 
  Plus, 
  Pencil, 
  Power,
  Trash2,
  ShieldAlert
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getStudioTeamData } from '@/app/actions/workspace'

interface Guest {
  id: string
  user_id: string
  email: string | null
  full_name: string | null
  access_level: 'global' | 'granular'
  workspaces: { workspace_id: string; can_create?: boolean; can_edit?: boolean; can_delete?: boolean }[]
  projects: { workspace_id: string; user_id: string; project_id: string; can_create?: boolean; can_edit?: boolean; can_deactivate?: boolean; can_delete?: boolean }[]
}

interface TeamData {
  guests: Guest[]
  workspaces: { id: string; name: string; slug: string }[]
  projects: { id: string; name: string; slug: string; workspace_id: string }[]
  allowedGuests: number
  usedGuests: number
}

interface TeamDrawerProps {
  isOpen: boolean
  onClose: () => void
  onRequestSubscriptionUpdate?: () => void
}

export function TeamDrawer({ isOpen, onClose, onRequestSubscriptionUpdate }: TeamDrawerProps) {
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
        toast(res.message || 'Convite reenviado!', 'success')
      } else {
        toast(res.error || 'Erro ao reenviar convite.', 'error')
      }
    } catch (err: any) {
      toast(err.message || 'Erro ao processar reenvio.', 'error')
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
        toast(res.message || 'Convite enviado!', 'success')
        setInviteEmail('')
        loadTeamData()
      } else {
        toast(res.error || 'Erro ao convidar usuário.', 'error')
      }
    } catch (err: any) {
      toast(err.message || 'Erro ao processar convite.', 'error')
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
        toast('Convidado removido com sucesso.', 'success')
        setIsDeleteGuestModalOpen(false)
        setGuestToDelete(null)
        loadTeamData()
      } else {
        toast(res.error || 'Erro ao remover convidado.', 'error')
      }
    } catch (err: any) {
      toast(err.message || 'Erro ao remover convidado.', 'error')
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
        toast('MFA do usuário resetado com sucesso!', 'success')
        setGuestToResetMfa(null)
      } else {
        toast(res.error || 'Erro ao resetar MFA.', 'error')
      }
    } catch (err: any) {
      toast(err.message || 'Erro inesperado.', 'error')
    } finally {
      setIsResettingMfa(false)
    }
  }

  const openAccessEditor = (guest: Guest) => {
    setSelectedGuestAccess(guest)
    setGuestAccessLevel(guest.access_level)
    setGuestWorkspaces(guest.workspaces.map(w => ({
      id: w.workspace_id,
      can_create: w.can_create || false,
      can_edit: w.can_edit || false,
      can_delete: w.can_delete || false
    })))
    setGuestProjects(guest.projects.map(p => ({
      id: p.project_id,
      can_create: p.can_create || false,
      can_edit: p.can_edit || false,
      can_deactivate: p.can_deactivate || false,
      can_delete: p.can_delete || false
    })))
  }

  const toggleWorkspacePermission = (wsId: string, permission: 'can_create' | 'can_edit' | 'can_delete') => {
    setGuestWorkspaces(prev => prev.map(w =>
      w.id === wsId ? { ...w, [permission]: !w[permission] } : w
    ))
  }

  const toggleProjectPermission = (projId: string, permission: 'can_create' | 'can_edit' | 'can_deactivate' | 'can_delete') => {
    setGuestProjects(prev => prev.map(p =>
      p.id === projId ? { ...p, [permission]: !p[permission] } : p
    ))
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
        toast('Permissões atualizadas com sucesso.', 'success')
        setSelectedGuestAccess(null)
        loadTeamData()
      } else {
        toast(res.error || 'Erro ao atualizar permissões.', 'error')
      }
    } catch (err: any) {
      toast(err.message || 'Erro ao salvar permissões.', 'error')
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
        title="Gerenciamento de Equipe do Studio"
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
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 block">Licenças de Convidados</span>
              <p className="text-sm font-bold text-neutral-900 dark:text-white mt-1">
                {teamData?.usedGuests ?? 0} de {teamData?.allowedGuests ?? 0} convidados contratados
              </p>
            </div>
            <Users className="w-5 h-5 text-indigo-500" />
          </div>

          {/* Invite Form / Premium Upsell */}
          {teamData && teamData.allowedGuests === 0 ? (
            /* Premium Upsell Banner */
            <div className="relative p-6 rounded-3xl overflow-hidden bg-gradient-to-br from-indigo-900 to-indigo-950 dark:from-neutral-900 dark:to-neutral-950 border border-indigo-500/25 dark:border-neutral-800 text-white shadow-xl shadow-indigo-500/5">
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-500/20 rounded-full blur-[40px]"></div>

              <div className="relative z-10 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-500/20 text-indigo-300 rounded-xl">
                    <Shield className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Recurso Premium</span>
                </div>

                <div className="space-y-1">
                  <h4 className="text-sm font-black">Multiplique sua Produtividade</h4>
                  <p className="text-[11px] text-neutral-300 leading-relaxed">
                    Convide desenvolvedores / analistas para atuar juntos no seu Studio. Defina quais workspaces e projetos cada membro pode gerenciar de forma granular.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleUpgradeClick}
                  className="inline-flex w-full items-center justify-center h-10 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 cursor-pointer"
                >
                  Liberar Trabalho em Equipe
                </button>
              </div>
            </div>
          ) : teamData && teamData.usedGuests >= teamData.allowedGuests ? (
            /* Seats Limit Reached Banner */
            <div className="p-5 border border-amber-200/55 dark:border-amber-900/30 rounded-2xl bg-amber-500/5 dark:bg-amber-500/5 space-y-3">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-505">
                <AlertCircle className="w-4 h-4" />
                <h4 className="text-xs font-bold">Limite de Convidados Atingido</h4>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Você atingiu o limite de {teamData.allowedGuests} convidados do seu plano atual. Remova algum membro existente ou faça upgrade para liberar mais licenças.
              </p>
              <button
                type="button"
                onClick={handleUpgradeClick}
                className="inline-flex items-center text-xs font-bold text-indigo-650 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors cursor-pointer"
              >
                Adicionar licenças de convidados &rarr;
              </button>
            </div>
          ) : (
            /* Invite Form */
            <form onSubmit={handleInviteGuest} className="p-5 border border-neutral-200 dark:border-neutral-800 rounded-2xl bg-neutral-50 dark:bg-neutral-950 space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-neutral-500 flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> Convidar Membro para o Studio
              </h4>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="email"
                    required
                    placeholder="email@exemplo.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs focus:border-indigo-500 outline-none transition-all dark:text-white"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isInvitingGuest}
                  className="h-11 px-5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-400 text-white text-xs font-bold rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-1.5"
                >
                  {isInvitingGuest ? 'Enviando...' : 'Convidar'}
                </button>
              </div>
            </form>
          )}

          {/* Members List */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Membros da Equipe</h4>
            {teamData?.guests && teamData.guests.length > 0 ? (
              <ul className="divide-y divide-neutral-100 dark:divide-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-2xl bg-white dark:bg-neutral-950 shadow-sm">
                {teamData.guests.map(guest => {
                  const allowedWorkspaces = guest.workspaces
                    .map(gw => {
                      const name = teamData?.workspaces?.find(w => w.id === gw.workspace_id)?.name
                      if (!name) return null
                      const actions = []
                      if (gw.can_create) actions.push('NOVO')
                      if (gw.can_delete) actions.push('EXCLUIR')
                      return `${name}${actions.length > 0 ? ` (${actions.join(' + ')})` : ''}`
                    })
                    .filter(Boolean) as string[]

                  const allowedProjects = guest.projects
                    .map(gp => {
                      const name = teamData?.projects?.find(p => p.id === gp.project_id)?.name
                      if (!name) return null
                      const actions = []
                      if (gp.can_create) actions.push('NOVO')
                      if (gp.can_delete) actions.push('EXCLUIR')
                      return `${name}${actions.length > 0 ? ` (${actions.join(' + ')})` : ''}`
                    })
                    .filter(Boolean) as string[]

                  return (
                    <li key={guest.id} className="p-4 flex flex-col gap-3 group hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors first:rounded-t-2xl last:rounded-b-2xl">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 rounded-xl flex items-center justify-center font-bold uppercase text-sm">
                            {(guest.full_name || guest.email || 'U')[0]}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-neutral-900 dark:text-white">{guest.full_name || 'Usuário Convidado'}</p>
                            <p className="text-[10px] text-neutral-500 mt-0.5">{guest.email}</p>
                          </div>
                        </div>

                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => setGuestToResetMfa(guest.user_id)}
                            className="p-2 hover:bg-amber-50 dark:hover:bg-amber-500/10 text-neutral-400 hover:text-amber-500 rounded-lg transition-colors"
                            title="Resetar MFA"
                          >
                            <ShieldAlert className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveGuest(guest.user_id)}
                            className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 text-neutral-400 hover:text-red-500 rounded-lg transition-colors"
                            title="Remover Convidado"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800/50">
                        <div className="relative group/badge">
                          <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider cursor-help select-none ${guest.access_level === 'global'
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600'
                            : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600'
                            }`}>
                            Acesso {guest.access_level === 'global' ? 'Global' : 'Granular'}
                          </div>

                          <div className="absolute bottom-full left-0 mb-2.5 hidden group-hover/badge:block w-72 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-2xl p-4 shadow-xl z-[100] pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-200 text-left">
                            {guest.access_level === 'global' ? (
                              <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-650 dark:text-indigo-400">Nível de Acesso</p>
                                <p className="text-xs font-black text-neutral-900 dark:text-white">Acesso Global</p>
                                <p className="text-[10px] text-neutral-600 dark:text-neutral-350 leading-relaxed mt-1">
                                  Permissão total para visualizar, criar e editar todos os Workspaces e Projetos do Studio.
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <div>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-500">Nível de Acesso</p>
                                  <p className="text-xs font-black text-neutral-900 dark:text-white">Acesso Granular</p>
                                </div>

                                <div className="space-y-2 border-t border-neutral-100 dark:border-neutral-800 pt-2 text-[10px]">
                                  <div>
                                    <span className="font-bold text-neutral-450 dark:text-neutral-500 uppercase tracking-wider block mb-1">Workspaces ({allowedWorkspaces.length}):</span>
                                    {allowedWorkspaces.length > 0 ? (
                                      <p className="text-neutral-700 dark:text-neutral-200 font-semibold leading-relaxed">{allowedWorkspaces.join(', ')}</p>
                                    ) : (
                                      <p className="text-neutral-400 dark:text-neutral-600 italic">Nenhum workspace liberado</p>
                                    )}
                                  </div>

                                  <div className="pt-1">
                                    <span className="font-bold text-neutral-450 dark:text-neutral-500 uppercase tracking-wider block mb-1">Projetos ({allowedProjects.length}):</span>
                                    {allowedProjects.length > 0 ? (
                                      <p className="text-neutral-700 dark:text-neutral-200 font-semibold leading-relaxed">{allowedProjects.join(', ')}</p>
                                    ) : (
                                      <p className="text-neutral-400 dark:text-neutral-600 italic">Nenhum projeto liberado</p>
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
                            onClick={() => handleResendInvite(guest.email, guest.id)}
                            disabled={!guest.email || resendingGuestId === guest.id}
                            className="p-2 hover:bg-neutral-100 dark:bg-neutral-800 text-neutral-400 hover:text-indigo-650 dark:text-neutral-350 dark:hover:text-indigo-400 rounded-lg transition-colors disabled:opacity-30 flex items-center justify-center"
                            title="Reenviar Convite"
                          >
                            {resendingGuestId === guest.id ? (
                              <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                          </button>

                          <button
                            onClick={() => openAccessEditor(guest)}
                            className="px-3 py-2 bg-neutral-100 hover:bg-indigo-550 dark:bg-neutral-800 dark:hover:bg-indigo-500/10 text-neutral-700 hover:text-indigo-600 dark:text-neutral-300 dark:hover:text-indigo-400 text-[10px] font-bold rounded-lg transition-colors border border-neutral-200 dark:border-neutral-700 hover:border-indigo-100"
                          >
                            Acessos
                          </button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="p-8 text-center border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl text-neutral-500">
                <Users className="w-8 h-8 text-neutral-300 dark:text-neutral-700 mx-auto mb-2" />
                <p className="text-xs font-medium">Nenhum convidado adicionado à sua equipe.</p>
              </div>
            )}
          </div>
        </div>
      </Drawer>

      <Modal
        isOpen={!!selectedGuestAccess}
        onClose={() => setSelectedGuestAccess(null)}
        title={`Permissões — ${selectedGuestAccess?.full_name || selectedGuestAccess?.email}`}
        description="Configure quais Workspaces e Projetos este colaborador pode visualizar e atuar."
        size="2xl"
        zIndex={300}
      >
        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-1">
          <p className="text-xs text-neutral-550 dark:text-neutral-450 leading-relaxed">
            Configure quais Workspaces e Projetos este colaborador pode visualizar e atuar. Ele não terá acesso ao que não for selecionado abaixo.
          </p>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Nível Geral de Acesso</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setGuestAccessLevel('global')}
                className={`p-4 border rounded-2xl flex flex-col items-start gap-2 text-left transition-all ${guestAccessLevel === 'global'
                  ? 'border-indigo-650 bg-indigo-50/20 dark:bg-indigo-500/10'
                  : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900'
                  }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs text-neutral-900 dark:text-white">
                  <Shield className="w-4 h-4 text-indigo-500" /> Acesso Global
                </div>
                <span className="text-[10px] text-neutral-500 leading-normal">
                  Acesso completo e irrestrito a todos os workspaces e projetos do Studio.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setGuestAccessLevel('granular')}
                className={`p-4 border rounded-2xl flex flex-col items-start gap-2 text-left transition-all ${guestAccessLevel === 'granular'
                  ? 'border-indigo-650 bg-indigo-50/20 dark:bg-indigo-500/10'
                  : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900'
                  }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs text-neutral-900 dark:text-white">
                  <Lock className="w-4 h-4 text-indigo-500" /> Acesso Granular
                </div>
                <span className="text-[10px] text-neutral-500 leading-normal">
                  Selecione individualmente quais Workspaces e quais Projetos estarão liberados.
                </span>
              </button>
            </div>
          </div>

          {guestAccessLevel === 'granular' && (
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 block">Workspaces e Projetos Autorizados</label>

              {teamData?.workspaces && teamData.workspaces.length > 0 ? (
                <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
                  {teamData.workspaces.map(ws => {
                    const isWsChecked = guestWorkspaces.some(w => w.id === ws.id)
                    const isWsCreateChecked = guestWorkspaces.find(w => w.id === ws.id)?.can_create || false
                    const isWsEditChecked = guestWorkspaces.find(w => w.id === ws.id)?.can_edit || false
                    const isWsDeleteChecked = guestWorkspaces.find(w => w.id === ws.id)?.can_delete || false
                    const wsProjects = teamData.projects.filter(p => p.workspace_id === ws.id)

                    return (
                      <div key={ws.id} className="border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 bg-neutral-50 dark:bg-neutral-900/40 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <label className="flex items-center gap-2.5 cursor-pointer font-bold text-xs text-neutral-900 dark:text-white">
                              <input
                                type="checkbox"
                                checked={isWsChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setGuestWorkspaces([...guestWorkspaces, { id: ws.id, can_create: false, can_edit: false, can_delete: false }])
                                    setGuestProjects([
                                      ...guestProjects,
                                      ...wsProjects.map(p => ({ id: p.id, can_create: false, can_edit: false, can_deactivate: false, can_delete: false }))
                                    ])
                                  } else {
                                    setGuestWorkspaces(guestWorkspaces.filter(w => w.id !== ws.id))
                                    setGuestProjects(guestProjects.filter(p => !wsProjects.some(wp => wp.id === p.id)))
                                  }
                                }}
                                className="w-4 h-4 text-indigo-600 border-neutral-300 dark:border-neutral-700 rounded focus:ring-indigo-500 bg-white dark:bg-neutral-900"
                              />
                              {ws.name}
                            </label>
                            <span className="text-[9px] text-neutral-500 font-mono bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded">/{ws.slug}</span>
                          </div>

                          {isWsChecked && (
                            <div className="flex items-center gap-1.5 self-end sm:self-auto">
                              <button
                                type="button"
                                onClick={() => toggleWorkspacePermission(ws.id, 'can_create')}
                                className={cn(
                                  "px-2 py-1 rounded-lg border transition-all flex items-center justify-center gap-1 text-[9px] font-black uppercase tracking-wider cursor-pointer active:scale-95",
                                  isWsCreateChecked
                                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 border-transparent hover:text-neutral-600 dark:hover:text-neutral-300"
                                )}
                                title="Permitir criar projetos"
                              >
                                <Plus className="w-3 h-3" /> NOVO
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleWorkspacePermission(ws.id, 'can_edit')}
                                className={cn(
                                  "px-2 py-1 rounded-lg border transition-all flex items-center justify-center gap-1 text-[9px] font-black uppercase tracking-wider cursor-pointer active:scale-95",
                                  isWsEditChecked
                                    ? "bg-amber-500/10 text-amber-550 border-amber-500/30"
                                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 border-transparent hover:text-neutral-600 dark:hover:text-neutral-300"
                                )}
                                title="Permitir editar workspace"
                              >
                                <Pencil className="w-3 h-3" /> EDITAR
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleWorkspacePermission(ws.id, 'can_delete')}
                                className={cn(
                                  "px-2 py-1 rounded-lg border transition-all flex items-center justify-center gap-1 text-[9px] font-black uppercase tracking-wider cursor-pointer active:scale-95",
                                  isWsDeleteChecked
                                    ? "bg-red-500/10 text-red-500 border-red-500/30"
                                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 border-transparent hover:text-neutral-600 dark:hover:text-neutral-300"
                                )}
                                title="Permitir excluir projetos"
                              >
                                <Trash2 className="w-3 h-3" /> EXCLUIR
                              </button>
                            </div>
                          )}
                        </div>

                        {isWsChecked && wsProjects.length > 0 && (
                          <div className="pl-6 pt-3 border-t border-neutral-200/50 dark:border-neutral-800/50 space-y-2">
                            <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-2">Projetos Liberados</p>
                            <div className="flex flex-col gap-2">
                              {wsProjects.map(project => {
                                const isProjChecked = guestProjects.some(p => p.id === project.id)
                                const isProjCreateChecked = guestProjects.find(p => p.id === project.id)?.can_create || false
                                const isProjEditChecked = guestProjects.find(p => p.id === project.id)?.can_edit || false
                                const isProjDeactivateChecked = guestProjects.find(p => p.id === project.id)?.can_deactivate || false
                                const isProjDeleteChecked = guestProjects.find(p => p.id === project.id)?.can_delete || false

                                return (
                                  <div key={project.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-1.5 rounded-xl hover:bg-neutral-100/40 dark:hover:bg-neutral-800/20">
                                    <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-colors">
                                      <input
                                        type="checkbox"
                                        checked={isProjChecked}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setGuestProjects([...guestProjects, { id: project.id, can_create: false, can_edit: false, can_deactivate: false, can_delete: false }])
                                          } else {
                                            setGuestProjects(guestProjects.filter(p => p.id !== project.id))
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
                                            "px-1.5 py-0.5 rounded border transition-all flex items-center justify-center gap-0.5 text-[8px] font-black uppercase cursor-pointer active:scale-95",
                                            isProjCreateChecked
                                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                                              : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 border-transparent hover:text-neutral-600 dark:hover:text-neutral-300"
                                          )}
                                          title="Permitir criar tabelas/telas"
                                        >
                                          <Plus className="w-2.5 h-2.5" /> NOVO
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => toggleProjectPermission(project.id, 'can_deactivate')}
                                          className={cn(
                                            "px-1.5 py-0.5 rounded border transition-all flex items-center justify-center gap-0.5 text-[8px] font-black uppercase cursor-pointer active:scale-95",
                                            isProjDeactivateChecked
                                              ? "bg-orange-500/10 text-orange-600 border-orange-500/30"
                                              : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 border-transparent hover:text-neutral-600 dark:hover:text-neutral-300"
                                          )}
                                          title="Permitir ativar/desativar projeto"
                                        >
                                          <Power className="w-2.5 h-2.5" /> DESATIVAR
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => toggleProjectPermission(project.id, 'can_edit')}
                                          className={cn(
                                            "px-1.5 py-0.5 rounded border transition-all flex items-center justify-center gap-0.5 text-[8px] font-black uppercase cursor-pointer active:scale-95",
                                            isProjEditChecked
                                              ? "bg-amber-500/10 text-amber-550 border-amber-500/30"
                                              : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 border-transparent hover:text-neutral-600 dark:hover:text-neutral-300"
                                          )}
                                          title="Permitir editar projeto"
                                        >
                                          <Pencil className="w-2.5 h-2.5" /> EDITAR
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => toggleProjectPermission(project.id, 'can_delete')}
                                          className={cn(
                                            "px-1.5 py-0.5 rounded border transition-all flex items-center justify-center gap-0.5 text-[8px] font-black uppercase cursor-pointer active:scale-95",
                                            isProjDeleteChecked
                                              ? "bg-red-500/10 text-red-500 border-red-500/30"
                                              : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 border-transparent hover:text-neutral-600 dark:hover:text-neutral-300"
                                          )}
                                          title="Permitir excluir tabelas/telas"
                                        >
                                          <Trash2 className="w-2.5 h-2.5" /> EXCLUIR
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
                <p className="text-xs text-neutral-550 dark:text-neutral-450 italic">Você não possui nenhum workspace criado no momento.</p>
              )}
            </div>
          )}

          <div className="pt-6 border-t border-neutral-200 dark:border-neutral-800 flex gap-3">
            <button
              onClick={() => setSelectedGuestAccess(null)}
              className="flex-1 py-3.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-850 dark:hover:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-bold rounded-xl transition-colors active:scale-95"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveGuestAccess}
              disabled={isSavingAccess}
              className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-400 text-white text-xs font-bold rounded-xl transition-colors shadow-lg active:scale-95 flex items-center justify-center gap-1.5"
            >
              {isSavingAccess ? 'Salvando...' : 'Salvar Permissões'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isDeleteGuestModalOpen}
        onClose={() => {
          setIsDeleteGuestModalOpen(false)
          setGuestToDelete(null)
        }}
        title="Confirmar Remoção de Convidado"
      >
        <div className="space-y-6">
          <div className="flex items-start gap-4 p-4 bg-red-500/5 border border-red-500/20 rounded-2xl">
            <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-500">Deseja remover este convidado?</p>
              <p className="text-xs text-neutral-500 mt-1">O acesso deste membro ao Studio e a todos os workspaces e projetos atribuídos será revogado imediatamente.</p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleConfirmRemoveGuest}
              disabled={isDeletingGuest}
              className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:bg-neutral-800 text-white rounded-2xl font-bold transition-all shadow-[0_0_20px_rgba(220,38,38,0.2)]"
            >
              {isDeletingGuest ? 'Removendo...' : 'Sim, Remover'}
            </button>
            <button
              onClick={() => {
                setIsDeleteGuestModalOpen(false)
                setGuestToDelete(null)
              }}
              className="w-full py-4 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white rounded-2xl font-bold transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!guestToResetMfa}
        onClose={() => setGuestToResetMfa(null)}
        title="Resetar MFA do Usuário"
        description="Tem certeza que deseja desvincular o Authenticator deste usuário? Ele precisará configurar novamente no próximo login caso a política de MFA esteja ativa no Workspace."
        size="sm"
      >
        <div className="flex items-center gap-4 mt-6">
          <button
            onClick={() => setGuestToResetMfa(null)}
            disabled={isResettingMfa}
            className="flex-1 h-11 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold rounded-xl text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmResetMfa}
            disabled={isResettingMfa}
            className="flex-1 h-11 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20 active:scale-95 disabled:opacity-50"
          >
            {isResettingMfa ? 'Resetando...' : 'Sim, Resetar MFA'}
          </button>
        </div>
      </Modal>
    </>
  )
}
