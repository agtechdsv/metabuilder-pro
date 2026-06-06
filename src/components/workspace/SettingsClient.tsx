'use client'

import { useState, useEffect } from 'react'
import { Users, UserPlus, Shield, X, Mail, RefreshCw, FolderLock, CreditCard } from 'lucide-react'
import { inviteWorkspaceMember, removeWorkspaceMember, toggleMemberProject } from '@/app/actions/workspace'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { useRouter } from 'next/navigation'
import BillingSettings from './BillingSettings'
import { useI18n } from '@/i18n/I18nContext'

interface Member {
  id: string
  user_id: string
  role: string
  profiles?: {
    full_name: string | null
    email: string | null
  }
}

interface SettingsClientProps {
  workspace: {
    id: string
    name: string
    slug: string
    owner_id: string
  }
  profile: {
    id: string
    full_name: string | null
    email: string | null
    is_super_admin?: boolean | null
    subscription_status?: string | null
    subscription_cycle?: string | null
    subscription_expires_at?: string | null
    asaas_customer_id?: string | null
    asaas_subscription_id?: string | null
  }
  initialMembers: Member[]
  currentUserRole: string
  workspaceProjects?: { id: string; name: string }[]
  initialMemberProjects?: { user_id: string; project_id: string }[]
  payments: any[]
  rules?: any
}

function getMemberDisplayName(member: Member) {
  if (member.profiles?.full_name && member.profiles.full_name.trim()) {
    return member.profiles.full_name
  }
  const email = member.profiles?.email
  if (email && email.includes('@')) {
    const localPart = email.split('@')[0]
    if (localPart) {
      return localPart.charAt(0).toUpperCase() + localPart.slice(1)
    }
  }
  return 'Usuário ' + member.user_id.substring(0, 5)
}

export function SettingsClient({ 
  workspace, 
  profile,
  initialMembers, 
  currentUserRole, 
  workspaceProjects, 
  initialMemberProjects,
  payments,
  rules
}: SettingsClientProps) {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<'team' | 'billing'>('team')
  const [members, setMembers] = useState<Member[]>(initialMembers)
  const [memberProjects, setMemberProjects] = useState(initialMemberProjects || [])

  // Sincroniza o estado local quando os dados do servidor (initialMembers) mudarem 
  // (ex: após um router.refresh() no botão de atualizar)
  useEffect(() => {
    setMembers(initialMembers)
    setMemberProjects(initialMemberProjects || [])
  }, [initialMembers, initialMemberProjects])
  
  const [isInviting, setIsInviting] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('developer')
  
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null)
  const [memberToManageProjects, setMemberToManageProjects] = useState<string | null>(null)
  const [isTogglingProject, setIsTogglingProject] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  const { toast } = useToast()
  const router = useRouter()

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail) return
    
    setIsInviting(true)
    const res = await inviteWorkspaceMember(workspace.id, workspace.slug, inviteEmail, inviteRole)
    
    if (res.success) {
      toast(res.message || 'Convite enviado!', 'success')
      setInviteEmail('')
      router.refresh() // Recarrega a página para buscar os membros atualizados
    } else {
      toast(res.error || 'Erro ao convidar', 'error')
    }
    setIsInviting(false)
  }

  const handleRemoveClick = (userId: string) => {
    setMemberToRemove(userId)
  }

  const confirmRemove = async () => {
    if (!memberToRemove) return
    
    const res = await removeWorkspaceMember(workspace.id, memberToRemove)
    if (res.success) {
      toast('Membro removido', 'success')
      setMembers(members.filter(m => m.user_id !== memberToRemove))
      setMemberToRemove(null)
      router.refresh()
    } else {
      toast(res.error || 'Erro ao remover', 'error')
    }
  }

  const handleToggleProject = async (userId: string, projectId: string, isCurrentlyAssigned: boolean) => {
    setIsTogglingProject(true)
    const res = await toggleMemberProject(workspace.id, userId, projectId, !isCurrentlyAssigned)
    if (res.success) {
      if (!isCurrentlyAssigned) {
        setMemberProjects([...memberProjects, { user_id: userId, project_id: projectId }])
      } else {
        setMemberProjects(memberProjects.filter(mp => !(mp.user_id === userId && mp.project_id === projectId)))
      }
      toast('Permissão atualizada', 'success')
      router.refresh()
    } else {
      toast(res.error || 'Erro ao atualizar permissão', 'error')
    }
    setIsTogglingProject(false)
  }

  const canManageTeam = currentUserRole === 'owner' || currentUserRole === 'admin'

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      
      {/* Abas */}
      <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-4">
        <button 
          onClick={() => setActiveTab('team')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'team' ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600' : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'}`}
        >
          <Users className="w-4 h-4" />
          {t('settings.team_tab')}
        </button>
        <button 
          onClick={() => setActiveTab('billing')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'billing' ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600' : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'}`}
        >
          <CreditCard className="w-4 h-4" />
          {t('settings.billing_tab')}
        </button>
      </div>

      {activeTab === 'team' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Lado Esquerdo: Lista de Membros */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] overflow-hidden shadow-sm">
              <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white">{t('settings.title')}</h3>
                  <p className="text-xs text-neutral-500 mt-1">{t('settings.subtitle')}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="px-3 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-xs font-bold rounded-full">
                    {members.length} {members.length === 1 ? t('settings.member') : t('settings.members')}
                  </div>
                  <button 
                    onClick={() => {
                      setIsRefreshing(true)
                      router.refresh()
                      setTimeout(() => setIsRefreshing(false), 800) // Feedback visual
                    }}
                    disabled={isRefreshing}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 transition-colors disabled:opacity-50"
                    title="Atualizar lista"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
              
              <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {members.map(member => {
                  const displayName = getMemberDisplayName(member)
                  return (
                    <li key={member.id} className="p-6 flex items-center justify-between group hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 rounded-2xl flex items-center justify-center font-bold text-lg uppercase">
                          {(displayName || 'U')[0]}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-neutral-900 dark:text-white">{displayName}</p>
                          <p className="text-xs text-neutral-500 mt-0.5">{member.profiles?.email || t('settings.no_email')}</p>
                        </div>
                      </div>
                    <div className="flex items-center gap-4">
                      <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                        member.role === 'owner' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-500' :
                        member.role === 'admin' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-500' :
                        'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                      }`}>
                        {member.role}
                      </div>
                      
                      {canManageTeam && member.role !== 'owner' && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          {member.role === 'developer' && (
                            <button 
                              onClick={() => setMemberToManageProjects(member.user_id)}
                              className="w-8 h-8 flex items-center justify-center rounded-xl text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all"
                              title="Gerenciar Projetos"
                            >
                              <FolderLock className="w-4 h-4" />
                            </button>
                          )}
                          <button 
                            onClick={() => handleRemoveClick(member.user_id)}
                            className="w-8 h-8 flex items-center justify-center rounded-xl text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                            title="Remover"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                )})}`
              </ul>
            </div>
          </div>

          {/* Lado Direito: Convidar Membro */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-600">
                  <UserPlus className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white">{t('settings.invite_title')}</h3>
              </div>

              {canManageTeam ? (
                <form onSubmit={handleInvite} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">{t('settings.user_email')}</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                      <input 
                        type="email" 
                        required
                        value={inviteEmail}
                        onChange={e => setInviteEmail(e.target.value)}
                        placeholder="exemplo@email.com"
                        className="w-full h-11 pl-10 pr-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm focus:border-indigo-500 outline-none transition-all dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">{t('settings.access_level')}</label>
                    <div className="relative">
                      <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                      <select 
                        value={inviteRole}
                        onChange={e => setInviteRole(e.target.value)}
                        className="w-full h-11 pl-10 pr-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm focus:border-indigo-500 outline-none transition-all appearance-none dark:text-white"
                      >
                        <option value="developer">{t('settings.role_developer')}</option>
                        <option value="admin">{t('settings.role_admin')}</option>
                      </select>
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={isInviting}
                    className="w-full h-11 mt-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-400 disabled:dark:bg-neutral-800 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                  >
                    {isInviting ? t('settings.sending') : t('settings.send_invite')}
                  </button>
                  <p className="text-[10px] text-neutral-500 text-center leading-relaxed mt-2">
                    {t('settings.invite_hint')}
                  </p>
                </form>
              ) : (
                <div className="p-4 bg-neutral-50 dark:bg-neutral-950 rounded-xl border border-neutral-200 dark:border-neutral-800 text-center">
                  <Shield className="w-6 h-6 text-neutral-400 mx-auto mb-2" />
                  <p className="text-xs text-neutral-500 font-medium">{t('settings.only_admins')}</p>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {activeTab === 'billing' && (
        <BillingSettings 
          workspace={workspace}
          profile={profile}
          isOwner={currentUserRole === 'owner'}
          payments={payments}
          rules={rules}
        />
      )}

      {/* Modal de Confirmação de Remoção */}
      <Modal
        isOpen={!!memberToRemove}
        onClose={() => setMemberToRemove(null)}
        title={t('settings.remove_title')}
        description={t('settings.remove_desc')}
        size="sm"
      >
        <div className="flex items-center gap-4 mt-6">
          <button
            onClick={() => setMemberToRemove(null)}
            className="flex-1 px-4 py-3 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white font-bold rounded-xl transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={confirmRemove}
            className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-red-500/20"
          >
            {t('settings.yes_remove')}
          </button>
        </div>
      </Modal>

      {/* Modal de Gerenciamento de Projetos */}
      <Modal
        isOpen={!!memberToManageProjects}
        onClose={() => setMemberToManageProjects(null)}
        title={t('settings.allowed_projects')}
        description={t('settings.allowed_projects_desc')}
        size="md"
      >
        <div className="mt-6 space-y-4">
          {!workspaceProjects?.length ? (
            <p className="text-sm text-neutral-500 text-center py-4">{t('settings.no_projects')}</p>
          ) : (
            workspaceProjects.map(project => {
              const isAssigned = memberProjects.some(mp => mp.user_id === memberToManageProjects && mp.project_id === project.id)
              return (
                <div key={project.id} className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isAssigned ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400' : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500'}`}>
                      <FolderLock className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-bold text-neutral-900 dark:text-white">{project.name}</span>
                  </div>
                  <button
                    disabled={isTogglingProject}
                    onClick={() => handleToggleProject(memberToManageProjects!, project.id, isAssigned)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      isAssigned ? 'bg-indigo-600' : 'bg-neutral-300 dark:bg-neutral-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                        isAssigned ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              )
            })
          )}
          
          <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 flex justify-end">
             <button
              onClick={() => setMemberToManageProjects(null)}
              className="px-6 py-2.5 bg-neutral-900 dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-black font-bold rounded-xl transition-colors shadow-lg"
            >
              {t('settings.done')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
