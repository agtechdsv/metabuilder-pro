'use client'

import { useState } from 'react'
import {
  Database,
  Plus,
  ChevronRight,
  Pencil,
  Trash2,
  AlertCircle,
  Activity,
  Layers,
  Power,
  PowerOff,
  Settings
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { Drawer } from '@/components/ui/Drawer'
import { Modal } from '@/components/ui/Modal'
import { useI18n } from '@/i18n/I18nContext'
import { IconPicker } from '@/components/studio/IconPicker'
import { DynamicIcon } from '@/components/runtime/DynamicIcon'
import { cn } from '@/lib/utils'

interface Project {
  id: string
  name: string
  slug: string
  description?: string
  icon?: string
  is_active: boolean
  workspace_id: string
  models?: { count: number }[]
}

interface ProjectManagerProps {
  initialProjects: Project[]
  workspaceId: string
  workspaceSlug: string
  workspaceName: string
}

export function ProjectManager({ initialProjects, workspaceId, workspaceSlug, workspaceName }: ProjectManagerProps) {
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [formData, setFormData] = useState({ name: '', slug: '', description: '', icon: '', is_active: true })
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [showIconPicker, setShowIconPicker] = useState(false)

  const supabase = createClient()
  const router = useRouter()
  const { t } = useI18n()

  const openDrawer = (project: Project | null = null) => {
    setSelectedProject(project)
    setFormData(project
      ? {
        name: project.name,
        slug: project.slug,
        description: project.description || '',
        icon: project.icon || '',
        is_active: project.is_active
      }
      : { name: '', slug: '', description: '', icon: '', is_active: true }
    )
    setIsDrawerOpen(true)
  }

  const closeDrawer = () => {
    setIsDrawerOpen(false)
    setSelectedProject(null)
    setFormData({ name: '', slug: '', description: '', icon: '', is_active: true })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      if (selectedProject) {
        // Edit
        const { error } = await supabase
          .from('projects')
          .update({
            name: formData.name,
            slug: formData.slug.toLowerCase(),
            description: formData.description,
            icon: formData.icon,
            is_active: formData.is_active
          })
          .eq('id', selectedProject.id)

        if (error) throw error
      } else {
        // Create
        const { error } = await supabase
          .from('projects')
          .insert({
            name: formData.name,
            slug: formData.slug.toLowerCase(),
            description: formData.description,
            icon: formData.icon,
            workspace_id: workspaceId,
            is_active: true
          })

        if (error) throw error
      }

      // Refresh data
      const { data } = await supabase
        .from('projects')
        .select('*, models(count)')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })

      setProjects(data || [])
      closeDrawer()
      router.refresh()
    } catch (err: any) {
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  const openDeleteModal = (project: Project) => {
    setSelectedProject(project)
    setIsDeleteModalOpen(true)
  }

  const handleDelete = async () => {
    if (!selectedProject) return
    setIsDeleting(true)

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', selectedProject.id)

      if (error) throw error

      setProjects(projects.filter(p => p.id !== selectedProject.id))
      setIsDeleteModalOpen(false)
      setSelectedProject(null)
      router.refresh()
    } catch (err: any) {
      console.error(err)
    } finally {
      setIsDeleting(false)
    }
  }

  const toggleActive = async (project: Project) => {
    const newStatus = !project.is_active

    try {
      const { error } = await supabase
        .from('projects')
        .update({ is_active: newStatus })
        .eq('id', project.id)

      if (error) throw error

      setProjects(projects.map(p => p.id === project.id ? { ...p, is_active: newStatus } : p))
      router.refresh()
    } catch (err: any) {
      console.error(err)
    }
  }

  return (
    <div className="space-y-6">

      {/* Banner de Boas Vindas */}
      <div className="relative py-6 px-12 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] overflow-hidden group shadow-sm dark:shadow-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/5 blur-[100px] -mr-48 -mt-48 group-hover:bg-indigo-600/10 transition-all duration-700"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 rounded-full border border-indigo-500/20 text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest">
              {t('dashboard.active_environment')}
            </div>
            <h2 className="text-3xl font-black tracking-tight leading-tight text-neutral-900 dark:text-white">
              {t('dashboard.projects.title')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-indigo-400 dark:from-white dark:to-neutral-500">{workspaceName}</span>
            </h2>
            <p className="text-neutral-500 dark:text-neutral-400 text-base leading-relaxed">
              {t('dashboard.projects.subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link 
              href={`/admin/${workspaceSlug}/settings`}
              className="flex items-center gap-2 px-7 py-3 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white rounded-2xl font-bold transition-all shadow-sm text-sm border border-neutral-200 dark:border-neutral-700"
            >
              <Settings className="w-5 h-5" /> Equipe & Configurações
            </Link>
            <button
              onClick={() => openDrawer()}
              className="flex items-center gap-2 px-7 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold transition-all shadow-[0_0_30px_rgba(79,70,229,0.3)] whitespace-nowrap text-sm"
            >
              <Plus className="w-5 h-5" /> {t('dashboard.projects.new_project')}
            </button>
          </div>
        </div>
      </div>

      {/* Grade de Projetos */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold flex items-center gap-3">
            <Layers className="w-6 h-6 text-indigo-500" />
            {t('dashboard.projects.your_projects')}
          </h3>
          <div className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
            {projects.length} {t('dashboard.projects.found')}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
          {projects.map((project) => (
            <div
              key={project.id}
              className="group relative p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] hover:border-indigo-500/50 transition-all shadow-sm hover:shadow-xl dark:shadow-none"
            >
              <div className="flex flex-col h-full gap-4">
                <div className="flex items-start justify-between">
                  <Link href={`/admin/${workspaceSlug}/${project.slug}/studio`} className="space-y-3 flex-1">
                    <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-2xl w-fit group-hover:bg-indigo-500/10 transition-colors flex items-center justify-center min-w-[48px] min-h-[48px]">
                      <div className="text-neutral-400 group-hover:text-indigo-500 transition-colors">
                        <DynamicIcon icon={project.icon || 'Box'} size={24} />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-neutral-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-white transition-colors">{project.name}</h4>
                      <p className="text-xs text-neutral-500 font-mono mt-0.5">/{project.slug}</p>
                      {project.description && (
                        <p className="text-xs text-neutral-500 dark:text-neutral-600 mt-2 line-clamp-2 leading-relaxed">
                          {project.description}
                        </p>
                      )}
                    </div>
                  </Link>

                  <div className="flex flex-col items-end gap-4">
                    <div className={`px-4 py-1.5 text-[10px] font-bold rounded-full border uppercase tracking-widest transition-all ${project.is_active
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      : 'bg-red-500/10 text-red-500 border-red-500/20'
                      }`}>
                      {project.is_active ? t('dashboard.projects.status_active') : t('dashboard.projects.status_inactive')}
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => toggleActive(project)}
                        className={`p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors ${project.is_active ? 'text-neutral-500 hover:text-red-400' : 'text-neutral-500 hover:text-emerald-400'}`}
                        title={project.is_active ? t('dashboard.projects.toggle_inactive') : t('dashboard.projects.toggle_active')}
                      >
                        {project.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => openDrawer(project)}
                        className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-neutral-500 hover:text-indigo-400"
                        title={t('dashboard.projects.edit_project')}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openDeleteModal(project)}
                        className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-neutral-500 hover:text-red-400"
                        title={t('dashboard.projects.delete_project')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-6 border-t border-neutral-100 dark:border-neutral-800/50">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-neutral-400" />
                      <span className="text-xs font-bold text-neutral-400 tracking-tighter">
                        {project.models?.[0]?.count || 0} {t('dashboard.projects.tables')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-neutral-400" />
                      <span className="text-xs font-bold text-neutral-400 tracking-tighter">
                        {t('dashboard.projects.use_cases')}
                      </span>
                    </div>
                  </div>
                  <Link href={`/admin/${workspaceSlug}/${project.slug}/studio`} className="w-10 h-10 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center group-hover:bg-indigo-600 transition-all shadow-sm dark:shadow-none">
                    <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:text-white" />
                  </Link>
                </div>
              </div>
            </div>
          ))}

          {/* Add New Card */}
          <button
            onClick={() => openDrawer()}
            className="p-8 bg-neutral-50 dark:bg-neutral-950 border-2 border-dashed border-neutral-300 dark:border-neutral-800 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 hover:bg-white dark:hover:bg-neutral-900 hover:border-indigo-500/30 transition-all group min-h-[250px] shadow-inner dark:shadow-none"
          >
            <div className="w-16 h-16 bg-white dark:bg-neutral-900 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm dark:shadow-none">
              <Plus className="w-8 h-8 text-neutral-400 group-hover:text-indigo-500" />
            </div>
            <div className="text-center">
              <p className="font-bold text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-neutral-200 transition-colors">{t('dashboard.projects.create_project_title')}</p>
              <p className="text-xs text-neutral-400 dark:text-neutral-600 mt-1">{t('dashboard.projects.create_project_desc')}</p>
            </div>
          </button>
        </div>
      </section>

      {/* Drawer para Criar/Editar */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        title={selectedProject ? t('dashboard.projects.edit_project') : t('dashboard.projects.new_project')}
      >
        <form onSubmit={handleSave} className="space-y-8">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">{t('dashboard.projects.project_name')}</label>
              <input
                required
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value, slug: selectedProject ? formData.slug : e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-') })}
                placeholder={t('dashboard.projects.name_placeholder')}
                className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all text-neutral-900 dark:text-white"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">{t('dashboard.projects.project_slug')}</label>
              <div className="flex items-center gap-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3">
                <span className="text-neutral-400 dark:text-neutral-600 text-sm">/</span>
                <input
                  required
                  type="text"
                  value={formData.slug}
                  onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-') })}
                  placeholder="crm-vendas"
                  className="flex-1 bg-transparent border-none text-sm focus:ring-0 outline-none text-neutral-900 dark:text-white"
                />
              </div>
              <p className="text-[10px] text-neutral-500 dark:text-neutral-600">{t('dashboard.slug_hint')}</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">{t('dashboard.projects.project_description')}</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('dashboard.projects.desc_placeholder')}
                rows={3}
                className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all text-neutral-900 dark:text-white resize-none"
              />
            </div>

            <div className="space-y-4">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">{t('dashboard.projects.project_icon')}</label>
              <div className="flex items-center gap-4 p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0">
                  <DynamicIcon icon={formData.icon || 'Box'} size={24} />
                </div>
                <div className="flex-1">
                  <button
                    type="button"
                    onClick={() => setShowIconPicker(true)}
                    className="px-4 py-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-all"
                  >
                    {t('dashboard.projects.change_icon')}
                  </button>
                </div>
              </div>

              {showIconPicker && (
                <IconPicker 
                  currentIcon={formData.icon || 'Box'}
                  onSelect={(icon) => setFormData({ ...formData, icon })}
                  onClose={() => setShowIconPicker(false)}
                />
              )}
            </div>

            {selectedProject && (
              <div className="pt-4 flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-neutral-900 dark:text-white">{t('dashboard.projects.status_title')}</p>
                  <p className="text-xs text-neutral-500">{t('dashboard.projects.status_desc')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                  className={`w-12 h-6 rounded-full transition-all relative ${formData.is_active ? 'bg-indigo-600' : 'bg-neutral-300 dark:bg-neutral-800'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.is_active ? 'right-1' : 'left-1'}`} />
                </button>
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-neutral-900">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 text-white rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)]"
            >
              {isSaving ? t('common.loading') : selectedProject ? t('common.save') : t('dashboard.projects.new_project')}
            </button>
          </div>
        </form>
      </Drawer>

      {/* Modal de Exclusão */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={t('dashboard.projects.delete_project')}
      >
        <div className="space-y-6">
          <div className="flex items-start gap-4 p-4 bg-red-500/5 border border-red-500/20 rounded-2xl">
            <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-500">{t('dashboard.projects.confirm_delete_project')}</p>
              <p className="text-xs text-neutral-500 mt-1">{t('dashboard.projects.delete_project_desc')}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:bg-neutral-800 text-white rounded-2xl font-bold transition-all shadow-[0_0_20px_rgba(220,38,38,0.2)]"
            >
              {isDeleting ? t('common.loading') : t('dashboard.projects.yes_delete')}
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
