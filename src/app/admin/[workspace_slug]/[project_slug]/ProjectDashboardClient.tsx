'use client'

import { 
  ArrowLeft,
  Database,
  Code2,
  Settings,
  Zap
} from 'lucide-react'
import Link from 'next/link'
import { UseCaseManager } from '@/components/workspace/UseCaseManager'
import { useI18n } from '@/i18n/I18nContext'

import { HeaderActions } from '@/components/layout/HeaderActions'

interface ProjectDashboardClientProps {
  workspace: any
  project: any
  profile?: any
  views: any[]
  workspace_slug: string
  project_slug: string
  user: any
}

export function ProjectDashboardClient({ workspace, project, profile, views, workspace_slug, project_slug, user }: ProjectDashboardClientProps) {
  const { t } = useI18n()

  const copyProjectId = () => {
    navigator.clipboard.writeText(project.id)
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#050505] text-black dark:text-white transition-colors duration-300">
      
      {/* Header Profissional */}
      <nav className="h-16 border-b border-neutral-200 dark:border-neutral-900 bg-white/50 dark:bg-neutral-950/50 backdrop-blur-md sticky top-0 z-20">
        <div className="w-full px-10 h-full flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href={`/admin/${workspace_slug}`} className="p-2 text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded-lg transition-all">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-indigo-600/20 rounded-xl border border-indigo-500/30">
                <Database className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">{workspace.name}</span>
                  <span className="text-neutral-700">/</span>
                  <span className="text-sm font-bold text-neutral-900 dark:text-white">{project.name}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-[10px] text-green-500 font-bold uppercase tracking-tighter">{t('dashboard.projects.connection_established')}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link 
              href={`/admin/${workspace_slug}/${project_slug}/studio`}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-xs font-bold transition-all shadow-[0_0_25px_rgba(79,70,229,0.4)]"
            >
              <Zap className="w-4 h-4" /> MetaBuilder Studio
            </Link>
            <HeaderActions user={user} profile={profile} />
          </div>
        </div>
      </nav>

      <main className="w-full px-10 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Coluna Esquerda: Listagem de Views */}
          <div className="lg:col-span-8 space-y-8">
            <UseCaseManager 
              initialViews={views} 
              workspaceSlug={workspace_slug} 
              projectSlug={project_slug} 
              projectId={project.id}
            />
          </div>

          {/* Coluna Direita: Informações Técnicas / Agente */}
          <div className="lg:col-span-4 space-y-6">
            <div className="p-8 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] space-y-6 shadow-sm dark:shadow-none relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/5 blur-[40px] -mr-16 -mt-16"></div>
              
              <div className="flex items-center gap-3 relative z-10">
                <div className="p-2 bg-indigo-500/10 rounded-lg">
                  <Code2 className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                </div>
                <h3 className="font-bold text-sm uppercase tracking-widest text-indigo-600 dark:text-indigo-400">{t('dashboard.projects.agent_status')}</h3>
              </div>
              
              <div className="space-y-4 relative z-10">
                <div className="p-4 bg-neutral-50 dark:bg-black/40 rounded-2xl border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">{t('dashboard.projects.project_id')}</span>
                  <span className="text-[10px] font-mono text-neutral-900 dark:text-white bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-transparent px-2 py-0.5 rounded truncate max-w-[120px]">
                    {project.id}
                  </span>
                </div>
                <div className="p-4 bg-neutral-50 dark:bg-black/40 rounded-2xl border border-neutral-200 dark:border-neutral-800">
                  <span className="text-xs text-neutral-500 dark:text-neutral-400 block mb-2">{t('dashboard.projects.secret_token')}</span>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-neutral-400">••••••••••••••••</span>
                    <button 
                      onClick={copyProjectId}
                      className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors"
                    >
                      {t('dashboard.projects.copy')}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-4 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-1"></div>
                  <div>
                    <p className="text-xs font-bold">{t('dashboard.projects.connection_established')}</p>
                    <p className="text-[10px] text-neutral-500">{t('dashboard.projects.connection_desc')}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] space-y-4 shadow-sm dark:shadow-none">
              <h4 className="font-bold text-sm text-neutral-900 dark:text-white">{t('dashboard.projects.next_steps')}</h4>
              <ul className="space-y-3">
                {[
                  t('dashboard.projects.step1'),
                  t('dashboard.projects.step2'),
                  t('dashboard.projects.step3'),
                  t('dashboard.projects.step4')
                ].map((step, i) => (
                  <li key={i} className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
                    <div className="w-5 h-5 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center text-[10px] font-bold text-neutral-900 dark:text-white">
                      {i + 1}
                    </div>
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
