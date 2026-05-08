'use client'

import { 
  LayoutDashboard, 
  Database, 
  Settings2, 
  Eye, 
  Plus, 
  ArrowRight,
  Search,
  Box,
  Layers,
  Clock,
  ShieldCheck,
  Trash2,
  Power,
  PowerOff,
  AlertCircle,
  Shield,
  ExternalLink
} from 'lucide-react'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { HeaderActions } from '@/components/layout/HeaderActions'
import { useI18n } from '@/i18n/I18nContext'
import { UseCaseBuilderWizard } from '@/components/studio/UseCaseBuilderWizard'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'

interface StudioDashboardClientProps {
  workspace: any
  project: any
  models: any[]
  views: any[]
  workspace_slug: string
  project_slug: string
}

export function StudioDashboardClient({ 
  workspace, 
  project, 
  models, 
  views, 
  workspace_slug, 
  project_slug 
}: StudioDashboardClientProps) {
  const { t } = useI18n()
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  
  const [viewMode, setViewMode] = useState<'list' | 'builder'>('list')
  const [viewToEdit, setViewToEdit] = useState<any>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [viewToDelete, setViewToDelete] = useState<any>(null)

  const refreshData = () => {
    setViewMode('list')
    router.refresh()
  }

  const handleToggleActive = async (view: any) => {
    try {
      const isCurrentlyActive = view.layout_config?.is_active !== false
      const newLayoutConfig = { 
        ...(view.layout_config || {}), 
        is_active: !isCurrentlyActive 
      }

      const { error } = await supabase
        .from('ui_views')
        .update({ layout_config: newLayoutConfig })
        .eq('id', view.id)

      if (error) throw error
      
      toast(`Caso de uso ${!isCurrentlyActive ? 'ativado' : 'desativado'} com sucesso!`, 'success')
      router.refresh()
    } catch (err: any) {
      toast('Erro ao alterar status: ' + err.message, 'error')
    }
  }

  const handleDeleteView = async () => {
    if (!viewToDelete) return
    try {
      const { error } = await supabase
        .from('ui_views')
        .delete()
        .eq('id', viewToDelete.id)

      if (error) throw error
      
      toast('Caso de uso excluído permanentemente.', 'success')
      setIsDeleteModalOpen(false)
      setViewToDelete(null)
      router.refresh()
    } catch (err: any) {
      toast('Erro ao excluir: ' + err.message, 'error')
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#050505] text-neutral-900 dark:text-white font-sans selection:bg-indigo-500/30 transition-colors duration-300">
      
      {/* Sidebar Simulado / Navegação Lateral Estreita */}
      <aside className="fixed left-0 top-0 h-full w-20 bg-white dark:bg-neutral-900/50 border-r border-neutral-200 dark:border-neutral-800 flex flex-col items-center py-8 gap-8 z-20 backdrop-blur-xl transition-colors">
        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(79,70,229,0.4)]">
          <Box className="text-white w-6 h-6" />
        </div>
        <nav className="flex flex-col gap-4">
          <Link href={`/admin/${workspace_slug}/${project_slug}/studio`} className="p-3 bg-indigo-50 dark:bg-neutral-800 rounded-xl text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 group relative flex justify-center">
            <LayoutDashboard className="w-6 h-6" />
            <span className="absolute left-16 px-2 py-1 bg-neutral-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">{t('dashboard.projects.studio.sidebar.dashboard')}</span>
          </Link>
          <div className="p-3 text-neutral-400 hover:text-indigo-600 dark:hover:text-white transition-colors cursor-pointer group relative flex justify-center">
            <Database className="w-6 h-6" />
            <span className="absolute left-16 px-2 py-1 bg-neutral-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">{t('dashboard.projects.studio.sidebar.data')}</span>
          </div>
          <Link href={`/admin/${workspace_slug}/${project_slug}/studio/auth`} className="p-3 text-neutral-400 hover:text-indigo-600 dark:hover:text-white transition-colors cursor-pointer group relative flex justify-center">
            <ShieldCheck className="w-6 h-6" />
            <span className="absolute left-16 px-2 py-1 bg-neutral-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">{t('dashboard.projects.studio.sidebar.auth')}</span>
          </Link>
          <div className="p-3 text-neutral-400 hover:text-indigo-600 dark:hover:text-white transition-colors cursor-pointer group relative flex justify-center">
            <Settings2 className="w-6 h-6" />
            <span className="absolute left-16 px-2 py-1 bg-neutral-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">{t('dashboard.projects.studio.sidebar.settings')}</span>
          </div>
        </nav>
      </aside>

      {/* Conteúdo Principal */}
      <main className="pl-20">
        
        {/* Header de Contexto */}
        <header className="h-20 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between px-10 bg-white/50 dark:bg-neutral-900/20 backdrop-blur-md sticky top-0 z-10 transition-colors">
          <div className="flex items-center gap-3">
            <Link href={`/admin/${workspace_slug}`} className="text-neutral-500 text-xs font-bold uppercase tracking-widest hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{workspace.name}</Link>
            <span className="text-neutral-300 dark:text-neutral-700">/</span>
            <Link href={`/admin/${workspace_slug}/${project_slug}`} className="text-neutral-900 dark:text-white font-bold hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{project.name}</Link>
            <span className="ml-4 px-2 py-0.5 bg-green-500/10 text-green-600 dark:text-green-500 text-[10px] font-bold rounded-full border border-green-500/20 uppercase tracking-tighter">
              {{ pt: 'Agente Online', en: 'Agent Online', es: 'Agente en Línea' }[t('dashboard.projects.studio.stats.now') === 'AGORA' ? 'pt' : 'en'] || 'Agent Online'}
            </span>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative hidden md:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input 
                type="text" 
                placeholder={t('dashboard.projects.studio.sidebar.data')} 
                className="bg-neutral-100 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-full pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-all w-64 text-neutral-900 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-4">
              <Link 
                href={`/${workspace_slug}/${project_slug}`}
                target="_blank"
                className="flex items-center gap-2 px-4 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white rounded-full text-[10px] font-black uppercase tracking-widest transition-all border border-neutral-200 dark:border-neutral-800"
              >
                <Eye className="w-4 h-4" /> {t('dashboard.projects.studio.open_app')}
              </Link>
              <HeaderActions />
            </div>
          </div>
        </header>

        <div className="p-10 max-w-7xl mx-auto space-y-12">
          
          {viewMode === 'list' && (
            <div className="flex items-center justify-between mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 rotate-3">
                  <Layers className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white">
                    MetaBuilder <span className="text-indigo-600 dark:text-indigo-500">Studio</span>
                  </h2>
                  <p className="text-[10px] text-neutral-400 uppercase font-black tracking-[0.2em]">Dashboard de Controle</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setViewMode('builder')}
                  className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20 active:scale-95"
                >
                  <Plus className="w-4 h-4" /> Novo Caso de Uso
                </button>
              </div>
            </div>
          )}

          {/* Stats Rápidos */}
          {viewMode === 'list' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-3xl space-y-4 shadow-sm dark:shadow-none transition-all">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-600 dark:text-blue-500">
                  <Database className="w-6 h-6" />
                </div>
                <span className="text-2xl font-black text-neutral-900 dark:text-white">{models?.length || 0}</span>
              </div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">{t('dashboard.projects.studio.stats.synced_tables')}</p>
            </div>
            <div className="p-6 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-3xl space-y-4 shadow-sm dark:shadow-none transition-all">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-purple-500/10 rounded-2xl text-purple-600 dark:text-purple-500">
                  <Layers className="w-6 h-6" />
                </div>
                <span className="text-2xl font-black text-neutral-900 dark:text-white">{views?.length || 0}</span>
              </div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">{t('dashboard.projects.studio.stats.custom_views')}</p>
            </div>
            <div className="p-6 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-3xl space-y-4 shadow-sm dark:shadow-none transition-all group/stat relative overflow-hidden">
              <div className="flex items-center justify-between relative z-10">
                <div className="p-3 bg-orange-500/10 rounded-2xl text-orange-600 dark:text-orange-500">
                  <Clock className="w-6 h-6" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-[10px] font-black text-green-600 dark:text-green-500 uppercase tracking-widest">{t('dashboard.projects.studio.stats.now')}</span>
                </div>
              </div>
              <div className="space-y-1 relative z-10">
                <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium leading-tight">Status do Agente</p>
                <div className="flex items-center justify-between pt-1">
                  <code className="text-[9px] text-neutral-400 font-mono bg-neutral-100 dark:bg-black/40 px-2 py-0.5 rounded truncate max-w-[120px]">{project.id}</code>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(project.id)
                      toast('ID do Projeto copiado!', 'success')
                    }}
                    className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase hover:underline"
                  >
                    Copiar Token
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

          {viewMode === 'builder' ? (
            <UseCaseBuilderWizard 
              initialData={viewToEdit}
              onClose={() => {
                setViewMode('list')
                setViewToEdit(null)
              }}
              onSaveSuccess={refreshData}
            />
          ) : (
            <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800/50 pb-6">
                <h3 className="text-2xl font-black flex items-center gap-3 text-neutral-900 dark:text-white tracking-tight">
                  <Layers className="w-7 h-7 text-indigo-600 dark:text-indigo-500" />
                  Casos de Uso
                </h3>
                <div className="px-4 py-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full text-[10px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest border border-neutral-200 dark:border-neutral-800">
                  {views?.length || 0} Criados
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* 1. Card Fixo do Portal de Login (Sistema) */}
                <div className="group relative p-8 bg-gradient-to-br from-indigo-600/5 to-purple-600/5 dark:from-indigo-600/10 dark:to-purple-600/10 border border-indigo-500/20 dark:border-indigo-500/30 rounded-[2.5rem] hover:border-indigo-500 transition-all duration-500 shadow-sm hover:shadow-2xl hover:-translate-y-1">
                  <div className="flex flex-col h-full gap-8">
                    <div className="flex items-start justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <h4 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            Portal de Login
                          </h4>
                          <div className="px-2.5 py-0.5 bg-indigo-600 text-white text-[9px] font-black rounded-lg uppercase tracking-widest shadow-lg shadow-indigo-500/20">
                            SISTEMA
                          </div>
                        </div>
                        <p className="text-xs text-neutral-400 font-mono flex items-center gap-1.5 tracking-tight">
                          <span className="opacity-50">/</span>{workspace_slug}/{project_slug}/login
                        </p>
                      </div>
                      <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-600 dark:text-indigo-400">
                        <Shield className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="mt-auto flex gap-3">
                      <Link 
                        href={`/admin/${workspace_slug}/${project_slug}/studio/auth`}
                        className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-indigo-500/20"
                      >
                        <Settings2 className="w-4 h-4" /> Configurar Login
                      </Link>
                      <Link 
                        href={`/${workspace_slug}/${project_slug}/login`}
                        target="_blank"
                        className="w-14 flex items-center justify-center bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 rounded-2xl border border-neutral-200 dark:border-neutral-700 transition-all text-neutral-400 hover:text-indigo-600 dark:hover:text-white shadow-sm"
                      >
                        <ExternalLink className="w-5 h-5" />
                      </Link>
                    </div>
                  </div>
                </div>

                {views?.map((view) => (
                  <div 
                    key={view.id} 
                    className="group relative p-8 bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] hover:border-indigo-500/50 transition-all duration-500 shadow-sm hover:shadow-2xl dark:shadow-none hover:-translate-y-1"
                  >
                    <div className="flex flex-col gap-6">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="px-2.5 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[9px] font-black rounded-lg border border-indigo-500/20 uppercase tracking-widest w-fit">
                              {view.logic_type?.replace('_', ' + ') || 'Custom'}
                            </div>
                            <button 
                              onClick={() => handleToggleActive(view)}
                              className={`p-1 rounded-md transition-colors ${view.layout_config?.is_active !== false ? 'text-emerald-500 hover:bg-emerald-500/10' : 'text-neutral-400 hover:bg-neutral-500/10'}`}
                              title={view.layout_config?.is_active !== false ? 'Ativo' : 'Inativo'}
                            >
                              {view.layout_config?.is_active !== false ? <Power className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          <h4 className={`text-xl font-bold tracking-tight transition-colors ${view.layout_config?.is_active !== false ? 'text-neutral-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400' : 'text-neutral-400 italic'}`}>
                            {view.name}
                          </h4>
                          <p className="text-xs text-neutral-400 font-mono flex items-center gap-1.5 tracking-tight">
                            <span className="opacity-50">/</span>{view.slug}
                          </p>
                        </div>

                        <button 
                          onClick={() => {
                            setViewToDelete(view)
                            setIsDeleteModalOpen(true)
                          }}
                          className="p-2 text-neutral-300 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="pt-2 flex gap-3">
                        <button 
                          onClick={() => {
                            setViewToEdit(view)
                            setViewMode('builder')
                          }}
                          className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-2xl text-xs font-black uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-neutral-900/10 dark:shadow-white/5"
                        >
                          <Settings2 className="w-4 h-4" /> Configurar
                        </button>
                        <Link 
                          href={`/${workspace_slug}/${project_slug}/${view.slug}`}
                          target="_blank"
                          className="w-14 flex items-center justify-center bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 rounded-2xl border border-neutral-200 dark:border-neutral-700 transition-all text-neutral-400 hover:text-indigo-600 dark:hover:text-white shadow-sm"
                        >
                          <ArrowRight className="w-5 h-5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}

                {views.length === 0 && (
                  <div className="col-span-full py-20 flex flex-col items-center justify-center border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-[3rem] text-neutral-400 gap-4">
                    <div className="p-4 bg-neutral-50 dark:bg-neutral-900 rounded-full">
                      <Layers className="w-10 h-10 opacity-20" />
                    </div>
                    <p className="text-sm font-bold tracking-tight">Nenhum caso de uso criado ainda.</p>
                    <button onClick={() => setViewMode('builder')} className="text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase tracking-widest hover:underline underline-offset-8 transition-all">Começar agora</button>
                  </div>
                )}
              </div>
            </section>
          )}

          <Modal
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            title="Confirmar Exclusão"
          >
            <div className="space-y-6">
              <div className="flex items-start gap-4 p-4 bg-red-500/5 border border-red-500/20 rounded-2xl">
                <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-red-600">Esta ação é irreversível</p>
                  <p className="text-xs text-neutral-500 mt-1">Você está prestes a excluir o caso de uso <strong>"{viewToDelete?.name}"</strong>. Todos os componentes associados também serão removidos.</p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleDeleteView}
                  className="w-full py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-bold transition-all shadow-[0_0_20px_rgba(220,38,38,0.2)]"
                >
                  Excluir Permanentemente
                </button>
                <button 
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="w-full py-4 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white rounded-2xl font-bold transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </Modal>

        </div>
      </main>
    </div>
  )
}
