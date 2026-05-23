'use client'

import { useState } from 'react'
import {
  Building2,
  Plus,
  ChevronRight,
  Pencil,
  Trash2,
  AlertCircle,
  Activity,
  Users,
  Shield,
  Mail,
  UserPlus,
  X,
  Lock,
  Send,
  Loader2,
  Power,
  PowerOff
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { useRouter } from 'next/navigation'
import { Drawer } from '@/components/ui/Drawer'
import { Modal } from '@/components/ui/Modal'
import { useI18n } from '@/i18n/I18nContext'
import { cn } from '@/lib/utils'

interface Workspace {
  id: string
  name: string
  slug: string
  owner_id?: string
  projects?: { count: number }[]
  can_edit?: boolean
  can_delete?: boolean
}

interface Guest {
  id: string
  user_id: string
  access_level: 'global' | 'granular'
  created_at: string
  full_name: string | null
  email: string | null
  workspaces: { workspace_id: string; user_id: string; role: string; can_create?: boolean; can_edit?: boolean; can_delete?: boolean }[]
  projects: { workspace_id: string; user_id: string; project_id: string; can_create?: boolean; can_edit?: boolean; can_deactivate?: boolean; can_delete?: boolean }[]
}

import { CheckoutClient } from '@/components/checkout/CheckoutClient'

interface TeamData {
  guests: Guest[]
  workspaces: { id: string; name: string; slug: string }[]
  projects: { id: string; name: string; slug: string; workspace_id: string }[]
  allowedGuests: number
  usedGuests: number
}

interface WorkspaceManagerProps {
  initialWorkspaces: Workspace[]
  userName: string
  teamData?: TeamData | null
  plans?: any[]
  user?: any
  profile?: any
  isGuest?: boolean
  initialGuestAccessLevel?: 'global' | 'granular' | null
}

export function WorkspaceManager({ 
  initialWorkspaces, 
  userName, 
  teamData, 
  plans, 
  user, 
  profile,
  isGuest = false,
  initialGuestAccessLevel = null
}: WorkspaceManagerProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(initialWorkspaces)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null)
  const [formData, setFormData] = useState({ name: '', slug: '' })
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  // Team management states
  const [isTeamDrawerOpen, setIsTeamDrawerOpen] = useState(false)
  const [isInvitingGuest, setIsInvitingGuest] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [selectedGuestAccess, setSelectedGuestAccess] = useState<Guest | null>(null)
  const [guestWorkspaces, setGuestWorkspaces] = useState<{ id: string; can_create: boolean; can_edit: boolean; can_delete: boolean }[]>([])
  const [guestProjects, setGuestProjects] = useState<{ id: string; can_create: boolean; can_edit: boolean; can_deactivate: boolean; can_delete: boolean }[]>([])
  const [guestAccessLevel, setGuestAccessLevel] = useState<'global' | 'granular'>('granular')
  const [isSavingAccess, setIsSavingAccess] = useState(false)
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false)
  const [isDeleteGuestModalOpen, setIsDeleteGuestModalOpen] = useState(false)
  const [guestToDelete, setGuestToDelete] = useState<string | null>(null)
  const [isDeletingGuest, setIsDeletingGuest] = useState(false)
  const [resendingGuestId, setResendingGuestId] = useState<string | null>(null)

  const supabase = createClient()
  const { toast } = useToast()
  const router = useRouter()
  const { t } = useI18n()

  const canCreateWorkspace = !isGuest || initialGuestAccessLevel === 'global'

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
        router.refresh()
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
        router.refresh()
      } else {
        toast(res.error || 'Erro ao remover convidado.', 'error')
      }
    } catch (err: any) {
      toast(err.message || 'Erro ao remover convidado.', 'error')
    } finally {
      setIsDeletingGuest(false)
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
        router.refresh()
      } else {
        toast(res.error || 'Erro ao atualizar permissões.', 'error')
      }
    } catch (err: any) {
      toast(err.message || 'Erro ao salvar permissões.', 'error')
    } finally {
      setIsSavingAccess(false)
    }
  }

  const openDrawer = (workspace: Workspace | null = null) => {
    setSelectedWorkspace(workspace)
    setFormData(workspace ? { name: workspace.name, slug: workspace.slug } : { name: '', slug: '' })
    setIsDrawerOpen(true)
  }

  const closeDrawer = () => {
    setIsDrawerOpen(false)
    setSelectedWorkspace(null)
    setFormData({ name: '', slug: '' })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Não autenticado')

      if (selectedWorkspace) {
        // Edit
        const { error } = await supabase
          .from('workspaces')
          .update({ name: formData.name, slug: formData.slug.toLowerCase() })
          .eq('id', selectedWorkspace.id)

        if (error) throw error
      } else {
        // Create
        const { error } = await supabase
          .from('workspaces')
          .insert({
            name: formData.name,
            slug: formData.slug.toLowerCase(),
            owner_id: user.id
          })

        if (error) throw error
      }

      // Refresh data
      const { data } = await supabase
        .from('workspaces')
        .select('*, projects(count)')
        .order('created_at', { ascending: false })

      setWorkspaces(data || [])
      closeDrawer()
      router.refresh()
    } catch (err: any) {
      toast(err.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const openDeleteModal = (workspace: Workspace) => {
    setSelectedWorkspace(workspace)
    setIsDeleteModalOpen(true)
  }

  const handleDelete = async () => {
    if (!selectedWorkspace) return
    setIsDeleting(true)

    try {
      const { error } = await supabase
        .from('workspaces')
        .delete()
        .eq('id', selectedWorkspace.id)

      if (error) throw error

      setWorkspaces(workspaces.filter(w => w.id !== selectedWorkspace.id))
      setIsDeleteModalOpen(false)
      setSelectedWorkspace(null)
      router.refresh()
    } catch (err: any) {
      toast(err.message, 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">

      {/* Banner de Boas Vindas */}
      <div className="relative py-6 px-12 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] overflow-hidden group shadow-sm dark:shadow-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/5 blur-[100px] -mr-48 -mt-48 group-hover:bg-indigo-600/10 transition-all duration-700"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 rounded-full border border-indigo-500/20 text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest">
              {t('dashboard.admin_panel')}
            </div>
            <h2 className="text-3xl font-black tracking-tight leading-tight text-neutral-900 dark:text-white">
              {t('dashboard.welcome')}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-indigo-400 dark:from-white dark:to-neutral-500">{userName}</span>
            </h2>
            <p className="text-neutral-500 dark:text-neutral-400 text-base leading-relaxed">
              {t('dashboard.manage_workspaces')}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Só exibe para owner ou convidado com Acesso Global */}
            {teamData && (!isGuest || initialGuestAccessLevel === 'global') && (
              <button
                onClick={() => setIsTeamDrawerOpen(true)}
                className="flex items-center gap-2 px-7 py-3 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white rounded-2xl font-bold transition-all shadow-sm text-sm border border-neutral-200 dark:border-neutral-700 whitespace-nowrap active:scale-95"
              >
                <Users className="w-5 h-5" /> Gerenciar Equipe
              </button>
            )}
            {canCreateWorkspace && (
              <button
                onClick={() => openDrawer()}
                className="flex items-center gap-2 px-7 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold transition-all shadow-[0_0_30px_rgba(79,70,229,0.3)] whitespace-nowrap text-sm active:scale-95"
              >
                <Plus className="w-5 h-5" /> {t('dashboard.new_workspace')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: t('dashboard.stats.active_workspaces'), value: workspaces.length, icon: Building2, color: 'blue' },
          { label: t('dashboard.stats.total_projects'), value: workspaces.reduce((acc, w) => acc + (w.projects?.[0]?.count || 0), 0), icon: Activity, color: 'indigo' },
          { label: t('dashboard.stats.bandwidth'), value: '1.2 GB', icon: Activity, color: 'green' }
        ].map((stat, i) => (
          <div key={i} className="p-4 bg-white dark:bg-neutral-950/50 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-center justify-between shadow-sm dark:shadow-none">
            <div>
              <p className="text-neutral-500 text-[11px] font-medium uppercase tracking-widest">{stat.label}</p>
              <p className="text-2xl font-black mt-0.5 text-neutral-900 dark:text-white">{stat.value}</p>
            </div>
            <div className={`p-3.5 rounded-xl border ${stat.color === 'blue' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
              stat.color === 'indigo' ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' :
                'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
              }`}>
              <stat.icon className="w-5 h-5" />
            </div>
          </div>
        ))}
      </div>

      <section className="space-y-6">
        <h3 className="text-xl font-bold flex items-center gap-3">
          <Building2 className="w-6 h-6 text-indigo-500" />
          {t('dashboard.your_workspaces')}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {workspaces.map((workspace) => (
            <div
              key={workspace.id}
              className="group relative bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] hover:border-indigo-500/50 transition-all duration-500 overflow-hidden shadow-sm hover:shadow-xl dark:shadow-none"
            >
              {/* Efeito de Glow no Hover */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/5 blur-[60px] group-hover:bg-indigo-600/20 transition-all"></div>

              <div className="p-6 h-full flex flex-col justify-between gap-6 relative z-10">
                <div className="flex justify-between items-start">
                  <Link href={`/admin/${workspace.slug}`} className="space-y-3 flex-1">
                    <div className="w-12 h-12 bg-neutral-100 dark:bg-neutral-800 rounded-xl flex items-center justify-center border border-neutral-200 dark:border-neutral-700 group-hover:bg-indigo-500/10 group-hover:border-indigo-500/20 transition-all">
                      <Building2 className="w-6 h-6 text-neutral-400 group-hover:text-indigo-400" />
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="text-lg font-bold text-neutral-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-white transition-colors">{workspace.name}</h4>
                      <p className="text-xs text-neutral-500 font-mono">/{workspace.slug}</p>
                    </div>
                  </Link>

                  {/* Exibe para quem tem permissão de editar ou excluir */}
                  {(workspace.can_edit || workspace.can_delete) && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {workspace.can_edit && (
                        <button
                          onClick={() => openDrawer(workspace)}
                          className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-neutral-500 hover:text-indigo-400"
                          title={t('dashboard.edit_workspace')}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                      {workspace.can_delete && (
                        <button
                          onClick={() => openDeleteModal(workspace)}
                          className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-neutral-500 hover:text-red-400"
                          title={t('dashboard.delete_workspace')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <Link href={`/admin/${workspace.slug}`} className="flex items-center justify-between pt-4 border-t border-neutral-100 dark:border-neutral-800/50">
                  <span className="text-xs font-bold text-neutral-500 tracking-tighter">
                    {workspace.projects?.[0]?.count || 0} {t('dashboard.projects_count')}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center group-hover:bg-indigo-600 transition-all">
                    <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-white" />
                  </div>
                </Link>
              </div>
            </div>
          ))}

          {/* Add New Card */}
          {canCreateWorkspace && (
            <button
              onClick={() => openDrawer()}
              className="group p-8 bg-neutral-50 dark:bg-neutral-950 border border-dashed border-neutral-300 dark:border-neutral-800 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 hover:bg-white dark:hover:bg-neutral-800 hover:border-indigo-500/30 transition-all min-h-[280px] shadow-inner dark:shadow-none"
            >
              <div className="w-16 h-16 bg-white dark:bg-neutral-950 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm dark:shadow-none">
                <Plus className="w-8 h-8 text-neutral-400 group-hover:text-indigo-500" />
              </div>
              <div className="text-center">
                <p className="font-bold text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-neutral-200 transition-colors">{t('dashboard.new_workspace')}</p>
                <p className="text-xs text-neutral-400 dark:text-neutral-600 mt-1">{t('dashboard.create_environment')}</p>
              </div>
            </button>
          )}
        </div>
      </section>

      {/* Drawer para Criar/Editar */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        title={selectedWorkspace ? t('dashboard.edit_workspace') : t('dashboard.new_workspace')}
      >
        <form onSubmit={handleSave} className="space-y-8">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">{t('dashboard.workspace_name')}</label>
              <input
                required
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value, slug: selectedWorkspace ? formData.slug : e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-') })}
                placeholder="Ex: Minha Empresa"
                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all text-neutral-900 dark:text-white"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">{t('dashboard.slug_url')}</label>
              <div className="flex items-center gap-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3">
                <span className="text-neutral-400 dark:text-neutral-600 text-sm">/</span>
                <input
                  required
                  type="text"
                  value={formData.slug}
                  onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-') })}
                  placeholder="minha-empresa"
                  className="flex-1 bg-transparent border-none text-sm focus:ring-0 outline-none text-neutral-900 dark:text-white"
                />
              </div>
              <p className="text-[10px] text-neutral-500 dark:text-neutral-600">{t('dashboard.slug_hint')}</p>
            </div>
          </div>

          <div className="pt-6 border-t border-neutral-900">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 text-white rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)]"
            >
              {isSaving ? t('common.loading') : selectedWorkspace ? t('common.save') : t('dashboard.new_workspace')}
            </button>
          </div>
        </form>
      </Drawer>

      {/* Modal de Exclusão */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={t('dashboard.confirm_delete')}
      >
        <div className="space-y-6">
          <div className="flex items-start gap-4 p-4 bg-red-500/5 border border-red-500/20 rounded-2xl">
            <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-500">{t('dashboard.confirm_delete')}</p>
              <p className="text-xs text-neutral-500 mt-1">{t('dashboard.delete_desc')}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:bg-neutral-800 text-white rounded-2xl font-bold transition-all shadow-[0_0_20px_rgba(220,38,38,0.2)]"
            >
              {isDeleting ? t('common.loading') : t('dashboard.yes_delete')}
            </button>
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              className="w-full py-4 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white rounded-2xl font-bold transition-all"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </Modal>

      <Drawer
        isOpen={isTeamDrawerOpen}
        onClose={() => setIsTeamDrawerOpen(false)}
        title="Gerenciamento de Equipe do Studio"
      >
        <div className="space-y-6">
          {/* Quota Banner */}
          <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 block">Licenças de Convidados</span>
              <p className="text-sm font-bold text-neutral-900 dark:text-white mt-1">
                {teamData?.usedGuests} de {teamData?.allowedGuests} convidados contratados
              </p>
            </div>
            <Users className="w-5 h-5 text-indigo-500" />
          </div>

          {/* Invite Form / Premium Upsell */}
          {teamData && teamData.allowedGuests === 0 ? (
            /* Premium Upsell Banner */
            <div className="relative p-6 rounded-3xl overflow-hidden bg-gradient-to-br from-indigo-900 to-indigo-950 dark:from-neutral-900 dark:to-neutral-950 border border-indigo-500/25 dark:border-neutral-800 text-white shadow-xl shadow-indigo-500/5">
              {/* Blur glow */}
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
                  onClick={() => {
                    setIsCheckoutModalOpen(true)
                    setIsTeamDrawerOpen(false)
                  }}
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
                onClick={() => {
                  setIsCheckoutModalOpen(true)
                  setIsTeamDrawerOpen(false)
                }}
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
                      {/* Top Row: User details & Remove Button */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 rounded-xl flex items-center justify-center font-bold uppercase text-sm">
                            {(guest.full_name || guest.email || 'U')[0]}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-neutral-900 dark:text-white">{guest.full_name || 'Usuário Convidado'}</p>
                            <p className="text-[10px] text-neutral-505 mt-0.5">{guest.email}</p>
                          </div>
                        </div>

                        <button
                          onClick={() => handleRemoveGuest(guest.user_id)}
                          className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 text-neutral-400 hover:text-red-500 rounded-lg transition-colors shrink-0"
                          title="Remover Convidado"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Bottom Row: Access Level Badge & Actions (Resend Invite, Access Settings) */}
                      <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800/50">
                        <div className="relative group/badge">
                          <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider cursor-help select-none ${guest.access_level === 'global'
                              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600'
                              : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600'
                            }`}>
                            Acesso {guest.access_level === 'global' ? 'Global' : 'Granular'}
                          </div>

                          {/* Custom Tooltip on Hover */}
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
                            {/* Tooltip Arrow */}
                            <div className="absolute top-full left-4 -translate-y-1 w-2.5 h-2.5 bg-white dark:bg-neutral-900 border-r border-b border-neutral-200 dark:border-neutral-800 rotate-45" />
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleResendInvite(guest.email, guest.id)}
                            disabled={!guest.email || resendingGuestId === guest.id}
                            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-indigo-650 dark:text-neutral-350 dark:hover:text-indigo-400 rounded-lg transition-colors disabled:opacity-30 flex items-center justify-center"
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

      {/* Modal elegante de edição de acessos do convidado */}
      <Modal
        isOpen={!!selectedGuestAccess}
        onClose={() => setSelectedGuestAccess(null)}
        title={`Permissões — ${selectedGuestAccess?.full_name || selectedGuestAccess?.email}`}
        description="Configure quais Workspaces e Projetos este implementador pode visualizar e atuar."
        size="2xl"
        zIndex={300}
      >
        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-1">
          <p className="text-xs text-neutral-550 dark:text-neutral-450 leading-relaxed">
            Configure quais Workspaces e Projetos este implementador pode visualizar e atuar. Ele não terá acesso ao que não for selecionado abaixo.
          </p>

          {/* Access Level Selector */}
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

          {/* Granular Checkboxes List */}
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

          {/* Action Buttons */}
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

      {/* Modal de Checkout / Assinaturas */}
      {isCheckoutModalOpen && plans && (
        <Modal
          isOpen={isCheckoutModalOpen}
          onClose={() => setIsCheckoutModalOpen(false)}
          title="Assinatura MetaBuilder PRO"
          size="4xl"
        >
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <CheckoutClient 
              plans={plans}
              user={user}
              profile={profile}
            />
          </div>
        </Modal>
      )}

      {/* Modal de Confirmação de Remoção de Convidado */}
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
    </div>
  )
}
