'use client'

import { createClient } from '@/utils/supabase/client'
import ProjectLogsTab from '@/components/studio/ProjectLogs/ProjectLogsTab'
import { ScrollText } from 'lucide-react'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { useI18n } from '@/i18n/I18nContext'

interface LogsDashboardClientProps {
  workspace: any
  project: any
  workspace_slug: string
  project_slug: string
}

export default function LogsDashboardClient({
  workspace,
  project,
  workspace_slug,
  project_slug,
}: LogsDashboardClientProps) {
  const supabase = createClient()
  const { t } = useI18n()

  return (
    <main className="ml-20 min-h-screen bg-neutral-50 dark:bg-neutral-950 p-8">
      <Breadcrumbs 
        workspaceName={workspace?.name}
        projectName={project?.name}
        workspaceSlug={workspace_slug}
        projectSlug={project_slug}
        viewName="Logs"
      />
      {/* Header */}
      <div className="mb-8 mt-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
            <ScrollText className="w-6 h-6 text-indigo-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Logs do Projeto</h2>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
              Monitore todas as operações SQL, BPM e sincronizações em tempo real.
            </p>
          </div>
        </div>
      </div>

      <ProjectLogsTab project={project} supabase={supabase} />
    </main>
  )
}
