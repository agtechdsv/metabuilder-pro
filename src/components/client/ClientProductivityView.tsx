import React from 'react'
import { Activity, Check, Clock, Code, Copy, Download, RefreshCw, Users } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { KpiCard } from './ClientSharedComponents'
import { Modal } from '@/components/ui/Modal'
import { useI18n } from '@/i18n'

interface ClientProductivityViewProps {
  prodFilterProject: string
  setProdFilterProject: (v: string) => void
  prodFilterUser: string
  setProdFilterUser: (v: string) => void
  prodFilterPeriod: string
  setProdFilterPeriod: (v: string) => void
  prodSubTab: 'summary' | 'detailed'
  setProdSubTab: (v: 'summary' | 'detailed') => void
  selectedLog: any
  setSelectedLog: (log: any) => void
  modalTab: 'visual' | 'raw'
  setModalTab: (v: 'visual' | 'raw') => void
  copied: boolean
  filteredActivityLogs: any[]
  handleCloseLogModal: () => void
  handleCopyJson: (events: any) => void
  handleDownloadJson: (events: any) => void
  getEventMeta: (action: string) => any
  eventsArray: any[]
  isRefreshing: boolean
  refreshAllData: () => void
  projects: any[]
  profiles: any[]
  useCases: any[]
}

export function ClientProductivityView({
  prodFilterProject, setProdFilterProject,
  prodFilterUser, setProdFilterUser,
  prodFilterPeriod, setProdFilterPeriod,
  prodSubTab, setProdSubTab,
  selectedLog, setSelectedLog,
  modalTab, setModalTab,
  copied,
  filteredActivityLogs,
  handleCloseLogModal,
  handleCopyJson,
  handleDownloadJson,
  getEventMeta,
  eventsArray,
  isRefreshing,
  refreshAllData,
  projects,
  profiles,
  useCases
}: ClientProductivityViewProps) {
  const { t } = useI18n()

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Filtros de Produtividade */}
      <div className="flex flex-wrap items-center gap-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
            {t('client_views.productivity.filters_label', 'Filtros:')}
          </span>
        </div>
        <select
          value={prodFilterProject}
          onChange={(e) => setProdFilterProject(e.target.value)}
          className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 outline-none focus:border-indigo-500"
        >
          <option value="all">{t('client_views.productivity.filter_all_projects', 'Todos os Projetos')}</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <select
          value={prodFilterUser}
          onChange={(e) => setProdFilterUser(e.target.value)}
          className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 outline-none focus:border-indigo-500"
        >
          <option value="all">{t('client_views.productivity.filter_all_devs', 'Todos os Profissionais')}</option>
          {profiles.map(p => (
            <option key={p.id} value={p.id}>{p.full_name || p.email || t('client_views.productivity.unknown_user', 'Desconhecido')}</option>
          ))}
        </select>

        <select
          value={prodFilterPeriod}
          onChange={(e) => setProdFilterPeriod(e.target.value)}
          className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 outline-none focus:border-indigo-500"
        >
          <option value="all">{t('client_views.productivity.filter_all_period', 'Todo o Período')}</option>
          <option value="7d">{t('client_views.productivity.filter_7_days', 'Últimos 7 dias')}</option>
          <option value="30d">{t('client_views.productivity.filter_30_days', 'Últimos 30 dias')}</option>
        </select>
        <div className="ml-auto">
          <button
            onClick={() => refreshAllData()}
            disabled={isRefreshing}
            title={t('client_views.productivity.refresh_tooltip', 'Atualizar painel')}
            className="p-2 text-neutral-500 hover:text-indigo-600 dark:text-neutral-400 dark:hover:text-indigo-400 bg-neutral-100 dark:bg-neutral-800 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all flex items-center justify-center disabled:opacity-50 group active:scale-95 duration-200"
          >
            <RefreshCw className={cn("w-4 h-4 transition-transform duration-500 ease-out", isRefreshing ? "animate-spin" : "group-hover:rotate-180")} />
          </button>
        </div>
      </div>

      {/* Sub-tabs Navigation */}
      <div className="flex gap-2 p-1.5 bg-neutral-100 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 w-fit">
        <button
          onClick={() => setProdSubTab('summary')}
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200',
            prodSubTab === 'summary'
              ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
              : 'text-neutral-500 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
          )}
        >
          <Users className="w-4 h-4" />
          <span>{t('client_views.productivity.summary_tab', 'Resumo por DEV')}</span>
        </button>
        <button
          onClick={() => setProdSubTab('detailed')}
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200',
            prodSubTab === 'detailed'
              ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
              : 'text-neutral-500 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
          )}
        >
          <Activity className="w-4 h-4" />
          <span>{t('client_views.productivity.detailed_tab', 'Detalhado por DEV')}</span>
        </button>
      </div>

      {/* Content Panel based on sub-tab */}
      <AnimatePresence mode="wait">
        <motion.div
          key={prodSubTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          {prodSubTab === 'summary' && (
            <div className="space-y-8 animate-in fade-in-50 duration-200">
              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <KpiCard
                  label={t('client_views.productivity.total_active_time', 'Tempo Ativo Total')}
                  value={`${Math.floor((filteredActivityLogs.reduce((acc, log) => acc + (log.active_time_seconds || 0), 0)) / 60)} min`}
                  sub={t('client_views.productivity.total_active_time_sub', 'Tempo gasto construindo na plataforma')}
                  icon={Clock}
                  color="bg-emerald-500/10 text-emerald-500"
                />
                <KpiCard
                  label={t('client_views.productivity.actions_performed', 'Ações Realizadas')}
                  value={filteredActivityLogs.reduce((acc, log) => acc + (log.actions_count || 0), 0)}
                  sub={t('client_views.productivity.actions_performed_sub', 'Interações com o Studio')}
                  icon={Activity}
                  color="bg-indigo-500/10 text-indigo-500"
                />
              </div>

              {/* Summary Section */}
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm overflow-hidden flex flex-col h-full">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-neutral-800 dark:text-white">
                    {t('client_views.productivity.productivity_by_dev', 'Produtividade por Profissional')}
                  </h3>
                </div>

                {filteredActivityLogs.length === 0 ? (
                  <p className="text-sm text-neutral-500 text-center py-10">
                    {t('client_views.productivity.no_data', 'Nenhum dado de produtividade disponível para os filtros selecionados.')}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Object.entries(
                      filteredActivityLogs.reduce((acc, log) => {
                        if (!acc[log.user_id]) acc[log.user_id] = { time: 0, actions: 0, sessions: 0 }
                        acc[log.user_id].time += log.active_time_seconds || 0
                        acc[log.user_id].actions += log.actions_count || 0
                        acc[log.user_id].sessions += 1
                        return acc
                      }, {} as Record<string, { time: number, actions: number, sessions: number }>)
                    ).map(([userId, stats]: [string, any]) => {
                      const profile = profiles.find(p => p.id === userId)
                      const name = profile?.full_name || profile?.email || t('client_views.productivity.dev_fallback', 'Desenvolvedor')

                      return (
                        <div key={userId} className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px] font-bold">
                              {name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs font-bold text-neutral-900 dark:text-white truncate" title={name}>{name}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="block text-[10px] text-neutral-500">
                                {t('client_views.productivity.card_active_time', 'Tempo Ativo')}
                              </span>
                              <span className="font-bold text-neutral-700 dark:text-neutral-300">{Math.floor(stats.time / 60)}m</span>
                            </div>
                            <div>
                              <span className="block text-[10px] text-neutral-500">
                                {t('client_views.productivity.card_actions', 'Ações')}
                              </span>
                              <span className="font-bold text-neutral-700 dark:text-neutral-300">{stats.actions}</span>
                            </div>
                            <div className="col-span-2 mt-1 pt-2 border-t border-neutral-200 dark:border-neutral-700">
                              <span className="block text-[10px] text-neutral-500">
                                {t('client_views.productivity.card_sessions', 'Sessões')}
                              </span>
                              <span className="font-bold text-neutral-700 dark:text-neutral-300">{stats.sessions}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {prodSubTab === 'detailed' && (
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm overflow-hidden flex flex-col h-full animate-in fade-in-50 duration-200">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                  <Activity className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-neutral-800 dark:text-white">
                  {t('client_views.productivity.detailed_logs_title', 'Logs de Atividade Detalhados')}
                </h3>
              </div>

              {filteredActivityLogs.length === 0 ? (
                <p className="text-sm text-neutral-500 text-center py-10">
                  {t('client_views.productivity.no_data', 'Nenhum dado de produtividade disponível para os filtros selecionados.')}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-neutral-100 dark:border-neutral-800">
                        <th className="pb-3 text-xs font-black uppercase tracking-widest text-neutral-400">
                          {t('client_views.productivity.table_dev', 'Profissional')}
                        </th>
                        <th className="pb-3 text-xs font-black uppercase tracking-widest text-neutral-400">
                          {t('client_views.productivity.table_session_start', 'Início da Sessão')}
                        </th>
                        <th className="pb-3 text-xs font-black uppercase tracking-widest text-neutral-400">
                          {t('client_views.productivity.table_active_time', 'Tempo Ativo')}
                        </th>
                        <th className="pb-3 text-xs font-black uppercase tracking-widest text-neutral-400">
                          {t('client_views.productivity.table_actions', 'Ações')}
                        </th>
                        <th className="pb-3 text-xs font-black uppercase tracking-widest text-neutral-400 text-right">
                          {t('client_views.productivity.table_action', 'Ação')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {filteredActivityLogs.map((log) => {
                        const profile = profiles.find(p => p.id === log.user_id)
                        const name = profile?.full_name || profile?.email || t('client_views.productivity.dev_fallback', 'Desenvolvedor')
                        const useCase = useCases.find(uc => uc.id === log.ui_view_id)
                        const useCaseName = useCase ? useCase.name : t('client_views.productivity.unknown_usecase', 'Caso de Uso Removido/Desconhecido')

                        return (
                          <tr key={log.id} className="group hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                            <td className="py-4">
                              <div className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                                {name}
                              </div>
                              <div className="text-[10px] text-indigo-500 font-medium uppercase tracking-wider mt-0.5">
                                {useCaseName}
                              </div>
                            </td>
                            <td className="py-4 text-sm text-neutral-600 dark:text-neutral-400">
                              {new Date(log.session_start).toLocaleString('pt-BR')}
                            </td>
                            <td className="py-4 text-sm font-bold text-neutral-800 dark:text-neutral-200">
                              {Math.floor((log.active_time_seconds || 0) / 60)}m {(log.active_time_seconds || 0) % 60}s
                            </td>
                            <td className="py-4 text-sm font-bold text-neutral-800 dark:text-neutral-200">
                              {log.actions_count}
                            </td>
                            <td className="py-4 text-right">
                              <button
                                onClick={() => {
                                  setSelectedLog(log)
                                }}
                                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                              >
                                {t('client_views.productivity.view_detailed_log', 'Ver log detalhado')}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Productivity Log Detail Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={handleCloseLogModal}
        title={t('client_views.productivity.modal_title', 'Detalhes do Log de Atividade')}
        description={selectedLog ? `${t('client_views.productivity.modal_session_started_at', 'Sessão iniciada em')} ${new Date(selectedLog.session_start).toLocaleString('pt-BR')}` : t('client_views.productivity.modal_session_events', 'Eventos registrados nesta sessão')}
        size="2xl"
      >
        <div className="flex flex-col gap-6 mt-2">
          {/* Sub-tabs inside the Modal */}
          <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-4">
            <div className="flex gap-2 p-1 bg-neutral-100 dark:bg-neutral-950 rounded-xl border border-neutral-200 dark:border-neutral-800 w-fit">
              <button
                onClick={() => setModalTab('visual')}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200',
                  modalTab === 'visual'
                    ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                )}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>{t('client_views.productivity.timeline_tab', 'Linha do Tempo')}</span>
              </button>
              <button
                onClick={() => setModalTab('raw')}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200',
                  modalTab === 'raw'
                    ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                )}
              >
                <Code className="w-3.5 h-3.5" />
                <span>{t('client_views.productivity.raw_json_tab', 'JSON Bruto')}</span>
              </button>
            </div>

            {modalTab === 'raw' && (
              <div className="flex items-center gap-2 animate-in fade-in zoom-in-95 duration-150">
                <button
                  onClick={() => handleCopyJson(selectedLog?.events)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-bold rounded-lg border border-neutral-200 dark:border-neutral-750 transition-colors duration-150"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-emerald-600 dark:text-emerald-400">{t('client_views.productivity.copied_btn', 'Copiado!')}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>{t('client_views.productivity.copy_json_btn', 'Copiar JSON')}</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleDownloadJson(selectedLog?.events)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-lg border border-indigo-100 dark:border-indigo-900/50 transition-colors duration-150"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t('client_views.productivity.export_json_btn', 'Exportar JSON')}</span>
                </button>
              </div>
            )}
          </div>

          {/* Modal Tab Content */}
          <div className="min-h-[300px] max-h-[55vh] overflow-y-auto custom-scrollbar pr-1">
            {modalTab === 'visual' ? (
              eventsArray.length === 0 ? (
                <p className="text-sm text-neutral-500 text-center py-12">
                  {t('client_views.productivity.no_detailed_events', 'Nenhum evento detalhado registrado nesta sessão.')}
                </p>
              ) : (
                <div className="relative border-l-2 border-neutral-200 dark:border-neutral-800 ml-4 pl-6 space-y-6">
                  {eventsArray.map((event: any, idx: number) => {
                    const meta = getEventMeta(event.action)
                    const Icon = meta.icon
                    const color = meta.color
                    const label = meta.label

                    const eventTime = event.time ? new Date(event.time) : null
                    const prevEvent = idx > 0 ? eventsArray[idx - 1] : null
                    const prevEventTime = prevEvent?.time ? new Date(prevEvent.time) : null

                    let gapText = ''
                    if (idx === 0) {
                      gapText = 'START'
                    } else if (eventTime && prevEventTime) {
                      const diffSec = Math.floor((eventTime.getTime() - prevEventTime.getTime()) / 1000)
                      if (diffSec < 60) {
                        gapText = `+${diffSec}s`
                      } else {
                        const mins = Math.floor(diffSec / 60)
                        const secs = diffSec % 60
                        gapText = `+${mins}m ${secs}s`
                      }
                    }

                    const formattedTime = eventTime ? eventTime.toLocaleTimeString('pt-BR', { hour12: false }) : ''
                    const formattedMs = eventTime ? String(eventTime.getMilliseconds()).padStart(3, '0') : ''
                    const formattedDate = eventTime ? eventTime.toLocaleDateString('pt-BR') : ''

                    return (
                      <div key={idx} className="relative">
                        {/* Dot / Icon */}
                        <div className={cn(
                          "absolute -left-[38px] top-1 w-8 h-8 rounded-full flex items-center justify-center border-2 border-white dark:border-neutral-900 shadow-sm",
                          color.bg,
                          color.text
                        )}>
                          <Icon className="w-4 h-4" />
                        </div>

                        {/* Event Content */}
                        <div className="bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={cn(
                                "px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border",
                                color.badge
                              )}>
                                {label}
                              </span>
                              <span className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 font-mono uppercase tracking-wider">
                                {event.action}
                              </span>
                            </div>
                            <div className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{formattedTime}{formattedMs ? `.${formattedMs}` : ''}</span>
                              {formattedDate && <span className="opacity-60">• {formattedDate}</span>}
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-4 mt-1">
                            <p className="text-xs font-bold text-neutral-700 dark:text-neutral-200 leading-relaxed">
                              {event.detail || t('client_views.productivity.no_detail_desc', 'Sem descrição detalhada.')}
                            </p>
                            {gapText && (
                              <div className={cn(
                                "flex items-center gap-1 px-2.5 py-0.5 rounded-md border shrink-0",
                                gapText === 'START'
                                  ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                  : "bg-neutral-200/50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400"
                              )}>
                                <span className="text-[10px] font-black font-mono tracking-widest">
                                  {gapText}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            ) : (
              <div className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 overflow-x-auto max-h-[50vh] overflow-y-auto custom-scrollbar">
                <pre className="text-[10px] sm:text-xs text-neutral-800 dark:text-neutral-300 font-mono whitespace-pre-wrap">
                  {selectedLog?.events ? JSON.stringify(selectedLog.events, null, 2) : t('client_views.productivity.no_detailed_available', 'Nenhum evento detalhado disponível.')}
                </pre>
              </div>
            )}
          </div>

          {/* Footer Action */}
          <div className="flex justify-end pt-4 border-t border-neutral-100 dark:border-neutral-800 shrink-0">
            <button
              onClick={handleCloseLogModal}
              className="px-6 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-750 text-neutral-900 dark:text-white text-xs font-bold rounded-xl transition-colors"
            >
              {t('client_views.productivity.modal_close_btn', 'Fechar')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

