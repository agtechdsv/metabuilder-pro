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
  ShieldCheck
} from 'lucide-react'
import Link from 'next/link'
import { HeaderActions } from '@/components/layout/HeaderActions'
import { useI18n } from '@/i18n/I18nContext'

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
                className="flex items-center gap-2 px-4 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white rounded-full text-xs font-bold transition-all border border-neutral-200 dark:border-neutral-700"
              >
                <Eye className="w-4 h-4" /> {t('dashboard.projects.studio.open_app')}
              </Link>
              <HeaderActions />
            </div>
          </div>
        </header>

        <div className="p-10 max-w-7xl mx-auto space-y-12">
          
          {/* Título e Stats Rápidos */}
          <section className="space-y-2">
            <h2 className="text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
              MetaBuilder <span className="text-indigo-600 dark:text-indigo-500">Studio</span>
            </h2>
            <p className="text-neutral-500 dark:text-neutral-400 max-w-2xl text-sm">
              {t('dashboard.projects.studio.subtitle')}
            </p>
          </section>

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
            <div className="p-6 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-3xl space-y-4 shadow-sm dark:shadow-none transition-all">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-orange-500/10 rounded-2xl text-orange-600 dark:text-orange-500">
                  <Clock className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-orange-600 dark:text-orange-500 uppercase">{t('dashboard.projects.studio.stats.now')}</span>
              </div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">{t('dashboard.projects.studio.stats.tunnel_status')}</p>
            </div>
          </div>

          {/* Lista de Models / Tabelas */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center gap-2 text-neutral-900 dark:text-white">
                <Database className="w-5 h-5 text-indigo-600 dark:text-indigo-500" />
                {t('dashboard.projects.studio.data_structure')}
              </h3>
              <Link 
                href={`/admin/${workspace_slug}/${project_slug}/studio/builder`}
                className="flex items-center gap-2 px-6 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-indigo-500/10"
              >
                <Plus className="w-4 h-4" /> Novo Caso de Uso
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {models?.map((model) => (
                <div 
                  key={model.id} 
                  className="group relative p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] hover:border-indigo-500/50 transition-all duration-300 shadow-sm hover:shadow-xl dark:shadow-none"
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h4 className="text-lg font-bold text-neutral-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {model.display_name || model.db_table_name}
                        </h4>
                        <p className="text-xs text-neutral-400 font-mono">{model.db_table_name}</p>
                      </div>
                      <div className="px-3 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-full text-[10px] font-bold text-neutral-500 dark:text-neutral-400">
                        {model.fields?.length} {t('dashboard.projects.studio.fields_count')}
                      </div>
                    </div>

                    <div className="pt-4 flex gap-2">
                      <Link 
                        href={`/admin/${workspace_slug}/${project_slug}/studio/config/${model.id}`}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-bold transition-colors shadow-lg shadow-indigo-500/20"
                      >
                        <Plus className="w-4 h-4" /> {t('dashboard.projects.studio.configure_view')}
                      </Link>
                      <Link 
                        href={`/${workspace_slug}/${project_slug}/${model.ui_views?.[0]?.slug || model.db_table_name}`}
                        target="_blank"
                        className="w-12 flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-2xl border border-neutral-200 dark:border-neutral-700 transition-colors text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>
      </main>
    </div>
  )
}
