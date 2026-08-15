import React from 'react'
import { Building2, FolderKanban, Layers, RefreshCw, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  LicenseGaugeCard,
  KpiCard,
  MiniBarChart,
  LogicTypeDoughnutChart,
  formatDate
} from './ClientSharedComponents'
import { useI18n } from '@/i18n'

interface ClientMetricsViewProps {
  isRefreshing: boolean
  refreshAllData: () => void
  licensesUsed: number
  localProfile: any
  workspaces: any[]
  projects: any[]
  useCases: any[]
  projectsByWorkspace: any[]
  useCasesByProject: any[]
  useCasesByType: any[]
  members: any[]
  ownerGuests: any[]
}

export function ClientMetricsView({
  isRefreshing,
  refreshAllData,
  licensesUsed,
  localProfile,
  workspaces,
  projects,
  useCases,
  projectsByWorkspace,
  useCasesByProject,
  useCasesByType,
  members,
  ownerGuests,
}: ClientMetricsViewProps) {
  const { t } = useI18n()

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex justify-end">
        <button
          onClick={() => refreshAllData()}
          disabled={isRefreshing}
          title={t('client_views.metrics.refresh_tooltip', 'Atualizar painel')}
          className="p-2 text-neutral-500 hover:text-indigo-600 dark:text-neutral-400 dark:hover:text-indigo-400 bg-neutral-100 dark:bg-neutral-800 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all flex items-center justify-center disabled:opacity-50 group active:scale-95 duration-200"
        >
          <RefreshCw className={cn("w-4 h-4 transition-transform duration-500 ease-out", isRefreshing ? "animate-spin" : "group-hover:rotate-180")} />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <LicenseGaugeCard
          licensesUsed={licensesUsed}
          licensesTotal={localProfile?.subscription_licenses ?? 0}
        />
        <KpiCard
          label={t('client_views.metrics.workspaces_kpi', 'Workspaces')}
          value={workspaces.length}
          sub={t('client_views.metrics.workspaces_sub', 'Ambientes criados')}
          icon={Building2}
          color="bg-blue-500/10 text-blue-500"
        />
        <KpiCard
          label={t('client_views.metrics.projects_kpi', 'Projetos')}
          value={projects.length}
          sub={t('client_views.metrics.projects_sub', 'Em todos os workspaces')}
          icon={FolderKanban}
          color="bg-amber-500/10 text-amber-500"
        />
        <KpiCard
          label={t('client_views.metrics.use_cases_kpi', 'Casos de Uso')}
          value={useCases.length}
          sub={t('client_views.metrics.use_cases_sub', 'Telas e funcionalidades')}
          icon={Layers}
          color="bg-emerald-500/10 text-emerald-500"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Projects by Workspace */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-neutral-800 dark:text-white">
              {t('client_views.metrics.projects_by_workspace', 'Projetos por Workspace')}
            </h3>
          </div>
          {projectsByWorkspace.length > 0 ? (
            <MiniBarChart
              data={projectsByWorkspace.map((d, i) => ({
                label: d.name,
                count: d.count,
                color: ['bg-amber-500', 'bg-orange-500', 'bg-yellow-500', 'bg-red-500'][i % 4],
              }))}
            />
          ) : (
            <p className="text-xs text-neutral-400 text-center py-6">
              {t('client_views.metrics.no_workspaces_projects', 'Nenhum workspace com projetos')}
            </p>
          )}
        </div>

        {/* Use Cases by Project */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <FolderKanban className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-neutral-800 dark:text-white">
              {t('client_views.metrics.use_cases_by_project', 'Casos de Uso por Projeto')}
            </h3>
          </div>
          {useCasesByProject.length > 0 ? (
            <MiniBarChart
              data={useCasesByProject.map((d, i) => ({
                label: d.name,
                count: d.count,
                color: ['bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-sky-500'][i % 4],
              }))}
            />
          ) : (
            <p className="text-xs text-neutral-400 text-center py-6">
              {t('client_views.metrics.no_use_cases', 'Nenhum caso de uso encontrado')}
            </p>
          )}
        </div>

      </div>

      {/* Lower Section: 1/3 Use Cases by Logic Type + 2/3 Workspace Detail Table */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Use Cases by Logic Type (1/3) */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm md:col-span-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <Zap className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-neutral-800 dark:text-white">
                {t('client_views.metrics.use_cases_by_type', 'Casos de Uso por Tipo')}
              </h3>
            </div>
            {useCasesByType.length > 0 ? (
              <LogicTypeDoughnutChart data={useCasesByType} />
            ) : (
              <p className="text-xs text-neutral-400 text-center py-6">
                {t('client_views.metrics.no_use_cases', 'Nenhum caso de uso encontrado')}
              </p>
            )}
          </div>
        </div>

        {/* Workspaces Detail Table (2/3) */}
        {workspaces.length > 0 && (
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm md:col-span-2 flex flex-col justify-between">
            <div>
              <div className="p-6 border-b border-neutral-100 dark:border-neutral-800">
                <h3 className="text-sm font-bold text-neutral-800 dark:text-white">
                  {t('client_views.metrics.workspace_detail_title', 'Detalhamento por Workspace')}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/20">
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">
                        {t('client_views.metrics.table_workspace', 'Workspace')}
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-500 text-center">
                        {t('client_views.metrics.table_projects', 'Projetos')}
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-500 text-center">
                        {t('client_views.metrics.table_use_cases', 'Casos de Uso')}
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-500 text-center">
                        {t('client_views.metrics.table_users', 'Usuários')}
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">
                        {t('client_views.metrics.table_created_at', 'Criado em')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {workspaces.map(ws => {
                      const wsProjects = projects.filter(p => p.workspace_id === ws.id)
                      const wsProjectIds = wsProjects.map(p => p.id)
                      const wsUseCases = useCases.filter(uc => wsProjectIds.includes(uc.project_id))
                      // Guests explicitly assigned to this workspace via workspace_members
                      const granularGuests = members.filter(m => m.workspace_id === ws.id && m.user_id !== ws.owner_id)
                      // Plus all guests of this owner who have GLOBAL access level
                      const globalGuests = ownerGuests?.filter((g: any) => g.access_level === 'global') || []

                      // Total active users on this workspace = 1 (Owner) + unique guest ids
                      const uniqueWsUsers = new Set<string>()
                      if (ws.owner_id) uniqueWsUsers.add(ws.owner_id)
                      granularGuests.forEach(g => uniqueWsUsers.add(g.user_id))
                      globalGuests.forEach(g => uniqueWsUsers.add(g.user_id))

                      const wsUsersCount = uniqueWsUsers.size
                      return (
                        <tr key={ws.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-850/20 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                                <Building2 className="w-3.5 h-3.5" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-neutral-900 dark:text-white">{ws.name}</p>
                                <p className="text-[10px] text-neutral-400">{ws.slug}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200">{wsProjects.length}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200">{wsUseCases.length}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200">{wsUsersCount}</span>
                          </td>
                          <td className="px-6 py-4 text-sm text-neutral-500">
                            {formatDate(ws.created_at)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
