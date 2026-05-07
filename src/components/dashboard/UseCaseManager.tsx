'use client'

import { useState } from 'react'
import { 
  Layout, 
  Plus, 
  ExternalLink,
  Settings,
  ShieldCheck,
  AlertCircle,
  Monitor,
  Trash2
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/Modal'
import { useI18n } from '@/i18n/I18nContext'

interface View {
  id: string
  name: string
  slug: string
  project_id: string
  created_at: string
}

interface UseCaseManagerProps {
  initialViews: View[]
  workspaceSlug: string
  projectSlug: string
  projectId: string
}

export function UseCaseManager({ initialViews, workspaceSlug, projectSlug, projectId }: UseCaseManagerProps) {
  const [views, setViews] = useState<View[]>(initialViews)
  const [selectedView, setSelectedView] = useState<View | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  
  const supabase = createClient()
  const router = useRouter()
  const { t } = useI18n()

  const openDeleteModal = (view: View) => {
    setSelectedView(view)
    setIsDeleteModalOpen(true)
  }

  const handleDelete = async () => {
    if (!selectedView) return
    setIsDeleting(true)

    try {
      const { error } = await supabase
        .from('ui_views')
        .delete()
        .eq('id', selectedView.id)

      if (error) throw error

      setViews(views.filter(v => v.id !== selectedView.id))
      setIsDeleteModalOpen(false)
      setSelectedView(null)
      router.refresh()
    } catch (err: any) {
      console.error(err)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">{t('dashboard.projects.use_cases_title')}</h2>
          <p className="text-neutral-500 text-sm mt-1">{t('dashboard.projects.use_cases_subtitle')}</p>
        </div>
        <Link 
          href={`/admin/${workspaceSlug}/${projectSlug}/studio`}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs font-bold hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all text-neutral-900 dark:text-white shadow-sm dark:shadow-none"
        >
          <Plus className="w-4 h-4" /> {t('dashboard.projects.new_view')}
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Card Fixo: Portal de Login */}
        <div className="group p-6 bg-white dark:bg-neutral-900/40 border border-indigo-500/20 rounded-3xl hover:border-indigo-500/50 transition-all shadow-lg relative overflow-hidden dark:shadow-none">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[50px] group-hover:bg-indigo-500/10 transition-all"></div>
          <div className="flex flex-col gap-6 relative z-10">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-lg font-bold text-neutral-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Portal de Login</h4>
                  <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[9px] font-bold uppercase tracking-widest border border-indigo-500/20 rounded-full">{t('dashboard.projects.system_label')}</span>
                </div>
                <p className="text-xs text-neutral-500 font-mono">/{workspaceSlug}/{projectSlug}/login</p>
              </div>
              <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-500 dark:text-indigo-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link 
                href={`/admin/${workspaceSlug}/${projectSlug}/studio/login`}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)]"
              >
                <Layout className="w-4 h-4" /> {t('dashboard.projects.personalize_visual')}
              </Link>
              <Link 
                href={`/${workspaceSlug}/${projectSlug}/login`}
                target="_blank"
                className="p-2.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-xl transition-all border border-neutral-200 dark:border-transparent"
                title="Ver Tela de Login"
              >
                <ExternalLink className="w-4 h-4 text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-white" />
              </Link>
            </div>
          </div>
        </div>

        {/* Listagem de Views Dinâmicas */}
        {views.map((view) => (
          <div key={view.id} className="group p-6 bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 rounded-3xl hover:border-indigo-500/30 transition-all hover:bg-neutral-50 dark:hover:bg-neutral-900 shadow-lg dark:shadow-none relative overflow-hidden">
            <div className="flex flex-col gap-6">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h4 className="text-lg font-bold text-neutral-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{view.name}</h4>
                  <p className="text-xs text-neutral-500 font-mono">/{workspaceSlug}/{projectSlug}/{view.slug}</p>
                </div>
                <div className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-neutral-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  <Layout className="w-5 h-5" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link 
                  href={`/${workspaceSlug}/${projectSlug}/${view.slug}`}
                  target="_blank"
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-xl text-xs font-bold transition-all text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700"
                >
                  <ExternalLink className="w-4 h-4" /> {t('dashboard.projects.open_app')}
                </Link>
                <button 
                  onClick={() => openDeleteModal(view)}
                  className="p-2.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-xl transition-all border border-neutral-200 dark:border-transparent hover:border-red-500/30 text-neutral-400 hover:text-red-600 dark:hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {views.length === 0 && (
          <div className="p-12 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] flex flex-col items-center justify-center text-center gap-4 bg-neutral-50 dark:bg-transparent shadow-inner dark:shadow-none">
            <div className="p-4 bg-white dark:bg-neutral-900 rounded-2xl shadow-sm dark:shadow-none">
              <Monitor className="w-8 h-8 text-neutral-300 dark:text-neutral-700" />
            </div>
            <div>
              <p className="font-bold text-neutral-500 dark:text-neutral-400">Nenhum Caso de Uso Publicado</p>
              <p className="text-xs text-neutral-400 dark:text-neutral-600 mt-1 max-w-[250px]">
                Use o MetaBuilder Studio para criar interfaces incríveis para seus dados.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Exclusão */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={t('dashboard.projects.confirm_delete_view')}
      >
        <div className="space-y-6">
          <div className="flex items-start gap-4 p-4 bg-red-500/5 border border-red-500/20 rounded-2xl">
            <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-500">{t('dashboard.projects.confirm_delete_view')}</p>
              <p className="text-xs text-neutral-500 mt-1">{t('dashboard.projects.delete_view_desc')}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button 
              onClick={handleDelete}
              disabled={isDeleting}
              className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:bg-neutral-800 text-white rounded-2xl font-bold transition-all shadow-[0_0_20px_rgba(220,38,38,0.2)]"
            >
              {isDeleting ? t('common.loading') : t('dashboard.projects.yes_delete_view')}
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
