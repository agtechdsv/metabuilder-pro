'use client'

import React, { useState } from 'react'
import { Database, Layers, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { useI18n } from '@/i18n/I18nContext'
import { TableFieldsManager } from '@/components/studio/TableFieldsManager'
import { RelationsManager } from '@/components/studio/RelationsManager'

interface DataDashboardClientProps {
  workspace: any
  project: any
  models: any[]
  workspace_slug: string
  project_slug: string
}

export function DataDashboardClient({
  workspace,
  project,
  models,
  workspace_slug,
  project_slug
}: DataDashboardClientProps) {
  const { t } = useI18n()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'metadata' | 'relations'>('metadata')

  return (
    <>
      <Breadcrumbs
        workspaceName={workspace.name}
        workspaceSlug={workspace_slug}
        projectName={project.name}
        projectSlug={project_slug}
      />

      <main className="w-full px-10 pt-4 pb-4 space-y-6 flex-grow">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 rotate-3">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white">
                Estrutura de <span className="text-indigo-600 dark:text-indigo-500">Dados</span>
              </h2>
              <p className="text-[10px] text-neutral-400 uppercase font-black tracking-[0.2em]">
                {t('dashboard.projects.studio.control_dashboard')} • Modelagem
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Navegação de Abas */}
            <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-900/50 p-1 rounded-2xl border border-neutral-200 dark:border-neutral-800">
              <button
                onClick={() => setActiveTab('metadata')}
                className={cn(
                  "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5",
                  activeTab === 'metadata'
                    ? "bg-white dark:bg-neutral-800 text-indigo-600 shadow-sm"
                    : "text-neutral-400 hover:text-neutral-600 dark:hover:text-white"
                )}
              >
                Tabela / Campos
              </button>
              <button
                onClick={() => setActiveTab('relations')}
                className={cn(
                  "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5",
                  activeTab === 'relations'
                    ? "bg-white dark:bg-neutral-800 text-indigo-600 shadow-sm"
                    : "text-neutral-400 hover:text-neutral-600 dark:hover:text-white"
                )}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                Relacionamentos
              </button>
            </div>

            {/* Botão de Voltar para o Dashboard do Studio */}
            <Link
              href={`/admin/${workspace_slug}/${project_slug}/studio`}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900/50 dark:hover:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase text-neutral-600 dark:text-neutral-300"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar ao Studio
            </Link>
          </div>
        </div>

        {/* Conteúdo das Abas */}
        <div className="animate-in fade-in duration-300">
          {activeTab === 'metadata' ? (
            <div className="bg-white dark:bg-neutral-950 p-6 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-sm">
              <TableFieldsManager
                project={project}
                models={models}
                onSaveSuccess={() => router.refresh()}
              />
            </div>
          ) : (
            <div className="bg-white dark:bg-neutral-950 p-6 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-sm">
              <RelationsManager
                project={project}
                models={models}
              />
            </div>
          )}
        </div>
      </main>
    </>
  )
}
