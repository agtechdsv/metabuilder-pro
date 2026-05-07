'use client'

import { useState } from 'react'
import { 
  Building2, 
  Plus, 
  ChevronRight,
  Pencil,
  Trash2,
  AlertCircle,
  Activity
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { Drawer } from '@/components/ui/Drawer'
import { Modal } from '@/components/ui/Modal'
import { useI18n } from '@/i18n/I18nContext'

interface Workspace {
  id: string
  name: string
  slug: string
  projects?: { count: number }[]
}

interface WorkspaceManagerProps {
  initialWorkspaces: Workspace[]
  userName: string
}

export function WorkspaceManager({ initialWorkspaces, userName }: WorkspaceManagerProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(initialWorkspaces)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null)
  const [formData, setFormData] = useState({ name: '', slug: '' })
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  const supabase = createClient()
  const router = useRouter()
  const { t } = useI18n()

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
      alert(err.message)
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
      alert(err.message)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-12">
      
      {/* Boas vindas e Atividade */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <p className="text-indigo-500 font-bold text-xs uppercase tracking-widest">{t('dashboard.admin_panel')}</p>
          <h2 className="text-4xl font-extrabold tracking-tight">{t('dashboard.welcome')}, {userName}</h2>
          <p className="text-neutral-500">{t('dashboard.manage_workspaces')}</p>
        </div>
        <button 
          onClick={() => openDrawer()}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)]"
        >
          <Plus className="w-5 h-5" /> {t('dashboard.new_workspace')}
        </button>
      </section>

      {/* Stats Rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: t('dashboard.stats.active_workspaces'), value: workspaces.length, icon: Building2, color: 'blue' },
          { label: t('dashboard.stats.total_projects'), value: workspaces.reduce((acc, w) => acc + (w.projects?.[0]?.count || 0), 0), icon: Activity, color: 'indigo' },
          { label: t('dashboard.stats.bandwidth'), value: '1.2 GB', icon: Activity, color: 'green' }
        ].map((stat, i) => (
          <div key={i} className="p-6 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] flex items-center justify-between shadow-sm dark:shadow-none">
            <div>
              <p className="text-neutral-500 text-sm font-medium">{stat.label}</p>
              <p className="text-3xl font-black mt-1 text-neutral-900 dark:text-white">{stat.value}</p>
            </div>
            <div className={`p-4 rounded-2xl border ${
              stat.color === 'blue' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 
              stat.color === 'indigo' ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' : 
              'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
            }`}>
              <stat.icon className="w-6 h-6" />
            </div>
          </div>
        ))}
      </div>

      <section className="space-y-6">
        <h3 className="text-xl font-bold flex items-center gap-3">
          <Building2 className="w-6 h-6 text-indigo-500" />
          {t('dashboard.your_workspaces')}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workspaces.map((workspace) => (
            <div 
              key={workspace.id}
              className="group relative bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] hover:border-indigo-500/50 transition-all duration-500 overflow-hidden shadow-sm hover:shadow-xl dark:shadow-none"
            >
              {/* Efeito de Glow no Hover */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/5 blur-[60px] group-hover:bg-indigo-600/20 transition-all"></div>
              
              <div className="p-8 h-full flex flex-col justify-between gap-8 relative z-10">
                <div className="flex justify-between items-start">
                  <Link href={`/admin/${workspace.slug}`} className="space-y-4 flex-1">
                    <div className="w-14 h-14 bg-neutral-100 dark:bg-neutral-800 rounded-2xl flex items-center justify-center border border-neutral-200 dark:border-neutral-700 group-hover:bg-indigo-500/10 group-hover:border-indigo-500/20 transition-all">
                      <Building2 className="w-7 h-7 text-neutral-400 group-hover:text-indigo-400" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xl font-bold text-neutral-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-white transition-colors">{workspace.name}</h4>
                      <p className="text-sm text-neutral-500 font-mono">/{workspace.slug}</p>
                    </div>
                  </Link>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => openDrawer(workspace)}
                      className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-neutral-500 hover:text-indigo-400"
                      title={t('dashboard.edit_workspace')}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => openDeleteModal(workspace)}
                      className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-neutral-500 hover:text-red-400"
                      title={t('dashboard.delete_workspace')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <Link href={`/admin/${workspace.slug}`} className="flex items-center justify-between pt-4 border-t border-neutral-100 dark:border-neutral-800/50">
                  <span className="text-xs font-bold text-neutral-500 uppercase tracking-tighter">
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
          <button 
            onClick={() => openDrawer()}
            className="group p-8 bg-neutral-50 dark:bg-neutral-950 border border-dashed border-neutral-300 dark:border-neutral-800 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 hover:bg-white dark:hover:bg-neutral-900 hover:border-indigo-500/30 transition-all min-h-[280px] shadow-inner dark:shadow-none"
          >
            <div className="w-16 h-16 bg-white dark:bg-neutral-900 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm dark:shadow-none">
              <Plus className="w-8 h-8 text-neutral-400 group-hover:text-indigo-500" />
            </div>
            <div className="text-center">
              <p className="font-bold text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-neutral-200 transition-colors">{t('dashboard.new_workspace')}</p>
              <p className="text-xs text-neutral-400 dark:text-neutral-600 mt-1">{t('dashboard.create_environment')}</p>
            </div>
          </button>
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
                className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all text-neutral-900 dark:text-white"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">{t('dashboard.slug_url')}</label>
              <div className="flex items-center gap-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3">
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
    </div>
  )
}
