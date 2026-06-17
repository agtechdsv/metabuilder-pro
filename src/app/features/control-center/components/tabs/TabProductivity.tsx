import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, CreditCard, XCircle, Activity, Check, ArrowRight,
  TrendingUp, RotateCcw, Zap, Users, FileText, ExternalLink, Sliders,
  Compass, Copy, Download, Code, Loader2, Shield, Lightbulb, MessageCircle,
  ThumbsUp, Star, Layout, Clock
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nContext'
import { LogAction } from '../../hooks/useControlCenterMockups'
import CommunityHubView from '@/components/client/CommunityHubView'


export function TabProductivity({ mockupsState, setActiveTab }: { mockupsState: any, setActiveTab: (tab: string) => void }) {
  const { t } = useI18n()
  const {
    biWorkspaces,
    selectedProject, setSelectedProject,
    selectedDev, setSelectedDev,
    selectedPeriod, setSelectedPeriod,
    isDetailedLogOpen, setIsDetailedLogOpen,
    detailedLogTheme, setDetailedLogTheme,
    simulatedModalTab, setSimulatedModalTab,
    simulatedCopied, setSimulatedCopied,
    simulatedProdSubTab, setSimulatedProdSubTab,
    mockDetailedLogs,
    activeDetailedLog, setActiveDetailedLog,
    handleCloseSimulatedLog,
    handleSimulatedCopyJson,
    handleSimulatedDownloadJson,
    selectedReasons, setSelectedReasons,
    cancelComment, setCancelComment,
    toastMessage, setToastMessage,
    simulatedPlans,
    simulatedPlanId, setSimulatedPlanId,
    simulatedCycle, setSimulatedCycle,
    selectedSimulatedPlanId, setSelectedSimulatedPlanId,
    selectedSimulatedCycle, setSelectedSimulatedCycle,
    simulatedCardBrand, setSimulatedCardBrand,
    simulatedCardDigits, setSimulatedCardDigits,
    showSimulatedCardModal, setShowSimulatedCardModal,
    showSimulatedPlanConfirmModal, setShowSimulatedPlanConfirmModal,
    isSimulatingCardUpdate, setIsSimulatingCardUpdate,
    isSimulatingPlanUpdate, setIsSimulatingPlanUpdate,
    simulatedCardForm, setSimulatedCardForm,
    getSimulatedCycleLabel,
    formatSimulatedPrice,
    getSimulatedPlanPrice,
    handleSimulatedCardSubmit,
    handleSimulatedPlanChange,
    toggleReason,
    triggerToast
  } = mockupsState

  return (
    <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-6 text-left relative"
                >
                  {/* Filters bar */}
                  <div className="p-3 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-wrap gap-3 items-center text-xs">
                    <span className="text-[9px] font-black uppercase text-neutral-400 tracking-wider">{t('marketing_v2.control_center_page.productivity.filters')}</span>
                    <div className="flex gap-2">
                      <select
                        value={selectedProject}
                        onChange={(e) => setSelectedProject(e.target.value)}
                        className="px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-[10px] font-bold outline-none text-neutral-700 dark:text-neutral-300"
                      >
                        <option value="All">{t('marketing_v2.control_center_page.productivity.all_projects')}</option>
                      </select>
                      <select
                        value={selectedDev}
                        onChange={(e) => setSelectedDev(e.target.value)}
                        className="px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-[10px] font-bold outline-none text-neutral-700 dark:text-neutral-300"
                      >
                        <option value="All">{t('marketing_v2.control_center_page.productivity.all_devs')}</option>
                      </select>
                      <select
                        value={selectedPeriod}
                        onChange={(e) => setSelectedPeriod(e.target.value)}
                        className="px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-[10px] font-bold outline-none text-neutral-700 dark:text-neutral-300"
                      >
                        <option value="All">{t('marketing_v2.control_center_page.productivity.all_periods')}</option>
                      </select>
                    </div>
                  </div>

                  {/* Sub-tabs Selector for Productivity */}
                  <div className="flex gap-2 p-1 bg-neutral-100 dark:bg-neutral-950 rounded-xl border border-neutral-200 dark:border-neutral-800 w-fit shrink-0">
                    <button
                      onClick={() => setSimulatedProdSubTab('summary')}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200',
                        simulatedProdSubTab === 'summary'
                          ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                          : 'text-neutral-550 hover:text-neutral-700 dark:hover:text-neutral-300'
                      )}
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>{t('marketing_v2.control_center_page.productivity.summary_tab')}</span>
                    </button>
                    <button
                      onClick={() => setSimulatedProdSubTab('detailed')}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200',
                        simulatedProdSubTab === 'detailed'
                          ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                          : 'text-neutral-550 hover:text-neutral-700 dark:hover:text-neutral-300'
                      )}
                    >
                      <Activity className="w-3.5 h-3.5" />
                      <span>{t('marketing_v2.control_center_page.productivity.detailed_tab')}</span>
                    </button>
                  </div>

                  {/* Simulated Content Panel */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={simulatedProdSubTab}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.15 }}
                      className="space-y-6"
                    >
                      {simulatedProdSubTab === 'summary' ? (
                        <div className="space-y-6">
                          {/* Summary Metric Cards */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl space-y-3 shadow-sm flex flex-col justify-between min-h-[110px]">
                              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                                <Clock className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400">{t('marketing_v2.control_center_page.productivity.active_time')}</span>
                                <h4 className="text-xl font-black dark:text-white mt-0.5">6 min</h4>
                                <p className="text-[9px] text-neutral-400 font-bold mt-1">{t('marketing_v2.control_center_page.productivity.active_time_desc')}</p>
                              </div>
                            </div>

                            <div className="p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl space-y-3 shadow-sm flex flex-col justify-between min-h-[110px]">
                              <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                                <Activity className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400">{t('marketing_v2.control_center_page.productivity.actions')}</span>
                                <h4 className="text-xl font-black dark:text-white mt-0.5">8</h4>
                                <p className="text-[9px] text-neutral-400 font-bold mt-1">{t('marketing_v2.control_center_page.productivity.actions_desc')}</p>
                              </div>
                            </div>
                          </div>

                          {/* Produtividade por profissional */}
                          <div className="p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl space-y-4 shadow-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
                                <Users className="w-3.5 h-3.5" />
                              </div>
                              <h5 className="text-[10px] font-bold text-neutral-800 dark:text-white uppercase tracking-wider">{t('marketing_v2.control_center_page.productivity.prod_by_dev')}</h5>
                            </div>

                            <div className="p-4 bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-100 dark:border-neutral-800 rounded-2xl max-w-xs space-y-3">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[9px] font-black">A</div>
                                <span className="text-xs font-bold dark:text-white">Alexandre Moura</span>
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-[10px] text-neutral-500 border-t border-neutral-100 dark:border-neutral-800 pt-2.5">
                                <div>
                                  <span className="text-[8px] font-black text-neutral-400 block uppercase">{t('marketing_v2.control_center_page.productivity.col_active_time')}</span>
                                  <span className="font-bold text-neutral-800 dark:text-neutral-300">6m</span>
                                </div>
                                <div>
                                  <span className="text-[8px] font-black text-neutral-400 block uppercase">{t('marketing_v2.control_center_page.productivity.col_actions')}</span>
                                  <span className="font-bold text-neutral-800 dark:text-neutral-300">8</span>
                                </div>
                                <div>
                                  <span className="text-[8px] font-black text-neutral-400 block uppercase font-bold">{t('marketing_v2.control_center_page.productivity.col_sessions')}</span>
                                  <span className="font-bold text-neutral-800 dark:text-neutral-300">1</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Audit logs table */
                        <div className="p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl space-y-4 shadow-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
                              <Activity className="w-3.5 h-3.5" />
                            </div>
                            <h5 className="text-[10px] font-bold text-neutral-800 dark:text-white uppercase tracking-wider">{t('marketing_v2.control_center_page.productivity.detailed_logs_title')}</h5>
                          </div>

                          <div className="border border-neutral-100 dark:border-neutral-800 rounded-xl overflow-hidden bg-neutral-50/50 dark:bg-neutral-900/10">
                            <table className="w-full text-left border-collapse text-[10px]">
                              <thead>
                                <tr className="bg-neutral-100 dark:bg-neutral-900/60 border-b border-neutral-200 dark:border-neutral-800 text-[8px] font-black uppercase text-neutral-400 tracking-wider">
                                  <th className="px-3 py-2">{t('marketing_v2.control_center_page.productivity.col_dev')}</th>
                                  <th className="px-3 py-2 hidden sm:table-cell">{t('marketing_v2.control_center_page.productivity.col_session_start')}</th>
                                  <th className="px-3 py-2">{t('marketing_v2.control_center_page.productivity.col_active_time')}</th>
                                  <th className="px-3 py-2 text-center">{t('marketing_v2.control_center_page.productivity.col_actions')}</th>
                                  <th className="px-3 py-2 text-right">{t('marketing_v2.control_center_page.productivity.col_action')}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-neutral-700 dark:text-neutral-300">
                                <tr className="hover:bg-neutral-100/50 dark:hover:bg-neutral-900/20">
                                  <td className="px-3 py-2 font-bold">Alexandre Moura</td>
                                  <td className="px-3 py-2 hidden sm:table-cell font-mono text-[9px]">26/05/2026, 22:51:05</td>
                                  <td className="px-3 py-2 font-bold font-mono">6m 33s</td>
                                  <td className="px-3 py-2 text-center font-bold">8</td>
                                  <td className="px-3 py-2 text-right">
                                    <button
                                      onClick={() => {
                                        setActiveDetailedLog('session2')
                                        setIsDetailedLogOpen(true)
                                      }}
                                      className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-350 font-bold hover:underline"
                                    >
                                      {t('marketing_v2.control_center_page.productivity.btn_view_log')}
                                    </button>
                                  </td>
                                </tr>
                                <tr className="hover:bg-neutral-100/50 dark:hover:bg-neutral-900/20">
                                  <td className="px-3 py-2 font-bold">Alexandre Moura</td>
                                  <td className="px-3 py-2 hidden sm:table-cell font-mono text-[9px]">26/05/2026, 19:05:50</td>
                                  <td className="px-3 py-2 font-bold font-mono">0m 8s</td>
                                  <td className="px-3 py-2 text-center font-bold">2</td>
                                  <td className="px-3 py-2 text-right">
                                    <button
                                      onClick={() => {
                                        setActiveDetailedLog('session1')
                                        setIsDetailedLogOpen(true)
                                      }}
                                      className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-350 font-bold hover:underline"
                                    >
                                      {t('marketing_v2.control_center_page.productivity.btn_view_log')}
                                    </button>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>

                  {/* Code-style Audit Log pop-up overlay simulator */}
                  <AnimatePresence>
                    {isDetailedLogOpen && (
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-30 rounded-2xl overflow-hidden flex items-center justify-center p-4">
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className={cn(
                            "w-full max-w-md rounded-2xl border flex flex-col justify-between shadow-2xl transition-colors duration-300 h-[92%] max-h-[430px] overflow-hidden",
                            detailedLogTheme === 'dark'
                              ? 'bg-neutral-950 border-neutral-800 text-neutral-300'
                              : 'bg-white border-neutral-200 text-neutral-700'
                          )}
                        >
                          {/* Audit header */}
                          <div className={cn(
                            "px-4 py-3 border-b flex items-center justify-between shrink-0",
                            detailedLogTheme === 'dark' ? 'border-neutral-800 bg-neutral-900/60' : 'border-neutral-200 bg-neutral-50/60'
                          )}>
                            <div className="flex flex-col text-left">
                              <span className="text-[10px] font-black uppercase tracking-wider dark:text-white">
                                {t('marketing_v2.control_center_page.productivity.modal_title')}
                              </span>
                              <span className="text-[8px] text-neutral-400 dark:text-neutral-500 font-medium">
                                {t('marketing_v2.control_center_page.productivity.modal_started_at')} {mockDetailedLogs[activeDetailedLog].start}
                              </span>
                            </div>

                            {/* Controls: Theme Toggle & Close */}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setDetailedLogTheme(detailedLogTheme === 'dark' ? 'light' : 'dark')}
                                className={cn(
                                  "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider transition-colors",
                                  detailedLogTheme === 'dark' ? 'bg-neutral-800 hover:bg-neutral-700 text-indigo-400' : 'bg-neutral-100 hover:bg-neutral-200 text-indigo-600'
                                )}
                              >
                                {detailedLogTheme === 'dark' ? t('marketing_v2.control_center_page.productivity.theme_light') : t('marketing_v2.control_center_page.productivity.theme_dark')}
                              </button>
                              <button
                                onClick={handleCloseSimulatedLog}
                                className="text-[10px] font-black text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 ml-1"
                              >
                                ✕
                              </button>
                            </div>
                          </div>

                          {/* Sub-tabs inside Simulated Modal */}
                          <div className={cn(
                            "flex items-center justify-between border-b px-4 py-2 gap-2 shrink-0",
                            detailedLogTheme === 'dark' ? 'border-neutral-800 bg-neutral-950' : 'border-neutral-100 bg-white'
                          )}>
                            <div className="flex gap-1 p-0.5 bg-neutral-100 dark:bg-neutral-950 rounded-lg border border-neutral-200/50 dark:border-neutral-800 w-fit">
                              <button
                                onClick={() => setSimulatedModalTab('visual')}
                                className={cn(
                                  'flex items-center gap-1 px-2 py-1 rounded text-[8px] font-bold transition-all duration-200',
                                  simulatedModalTab === 'visual'
                                    ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                                    : 'text-neutral-550 hover:text-neutral-700 dark:hover:text-neutral-300'
                                )}
                              >
                                <Activity className="w-2.5 h-2.5" />
                                <span>{t('marketing_v2.control_center_page.productivity.tab_timeline')}</span>
                              </button>
                              <button
                                onClick={() => setSimulatedModalTab('raw')}
                                className={cn(
                                  'flex items-center gap-1 px-2 py-1 rounded text-[8px] font-bold transition-all duration-200',
                                  simulatedModalTab === 'raw'
                                    ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                                    : 'text-neutral-550 hover:text-neutral-700 dark:hover:text-neutral-300'
                                )}
                              >
                                <Code className="w-2.5 h-2.5" />
                                <span>{t('marketing_v2.control_center_page.productivity.tab_json')}</span>
                              </button>
                            </div>

                            {simulatedModalTab === 'raw' && (
                              <div className="flex items-center gap-1 animate-in fade-in zoom-in-95 duration-150">
                                <button
                                  onClick={() => handleSimulatedCopyJson(mockDetailedLogs[activeDetailedLog].actions)}
                                  className={cn(
                                    "flex items-center gap-1 px-2 py-0.5 text-[8px] font-bold rounded border transition-colors",
                                    detailedLogTheme === 'dark'
                                      ? "bg-neutral-800 hover:bg-neutral-800 border-neutral-700 text-neutral-300"
                                      : "bg-neutral-50 hover:bg-neutral-100 border-neutral-200 text-neutral-600"
                                  )}
                                >
                                  {simulatedCopied ? (
                                    <>
                                      <Check className="w-2.5 h-2.5 text-emerald-500" />
                                      <span className="text-emerald-500">{t('marketing_v2.control_center_page.productivity.btn_copied')}</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-2.5 h-2.5" />
                                      <span>{t('marketing_v2.control_center_page.productivity.btn_copy')}</span>
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={() => handleSimulatedDownloadJson(mockDetailedLogs[activeDetailedLog].actions)}
                                  className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[8px] font-bold rounded border border-indigo-100 dark:border-indigo-900/50 transition-colors"
                                >
                                  <Download className="w-2.5 h-2.5" />
                                  <span>{t('marketing_v2.control_center_page.productivity.btn_export')}</span>
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Content Frame */}
                          <div className="flex-grow overflow-y-auto custom-scrollbar p-4 text-left min-h-0">
                            {simulatedModalTab === 'visual' ? (
                              <div className={cn(
                                "relative border-l ml-2 pl-4 space-y-4",
                                detailedLogTheme === 'dark' ? "border-neutral-800" : "border-neutral-200"
                              )}>
                                {mockDetailedLogs[activeDetailedLog].actions.map((event: LogAction, idx: number) => {
                                  const normalized = String(event.action || '').toUpperCase()
                                  let icon = Activity
                                  let color = {
                                    bg: detailedLogTheme === 'dark'
                                      ? 'bg-neutral-500/10 text-neutral-400 border border-neutral-800'
                                      : 'bg-neutral-500/10 text-neutral-600 border border-neutral-200',
                                    badge: detailedLogTheme === 'dark'
                                      ? 'bg-neutral-550/10 border-neutral-800 text-neutral-400'
                                      : 'bg-neutral-100 border-neutral-200 text-neutral-600',
                                    label: t('marketing_v2.control_center_page.productivity.action_other')
                                  }

                                  if (normalized === 'CONFIG_CHANGE') {
                                    icon = Sliders
                                    color = {
                                      bg: 'bg-amber-500/10 text-amber-500 border border-amber-500/20',
                                      badge: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
                                      label: t('marketing_v2.control_center_page.productivity.action_config')
                                    }
                                  } else if (normalized === 'NAVIGATION') {
                                    icon = Compass
                                    color = {
                                      bg: 'bg-blue-500/10 text-blue-500 border border-blue-500/20',
                                      badge: 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400',
                                      label: t('marketing_v2.control_center_page.productivity.action_navigation')
                                    }
                                  } else if (normalized === 'SESSION_START') {
                                    icon = Clock
                                    color = {
                                      bg: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
                                      badge: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
                                      label: t('marketing_v2.control_center_page.productivity.action_start')
                                    }
                                  }

                                  const IconComponent = icon
                                  const eventTime = new Date(event.time)
                                  const formattedTime = isNaN(eventTime.getTime()) ? '18:48:35' : eventTime.toLocaleTimeString('pt-BR', { hour12: false })

                                  return (
                                    <div key={idx} className="relative">
                                      {/* Dot / Icon */}
                                      <div className={cn(
                                        "absolute -left-[25px] top-0.5 w-5 h-5 rounded-full flex items-center justify-center shadow-sm",
                                        color.bg,
                                        detailedLogTheme === 'dark' ? "bg-neutral-950" : "bg-white"
                                      )}>
                                        <IconComponent className="w-2.5 h-2.5" />
                                      </div>

                                      {/* Event Content */}
                                      <div className={cn(
                                        "border rounded-xl p-2.5 transition-colors",
                                        detailedLogTheme === 'dark'
                                          ? "bg-neutral-900/40 border-neutral-800 hover:border-neutral-800"
                                          : "bg-neutral-50/50 border-neutral-100 hover:border-neutral-200"
                                      )}>
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                          <div className="flex items-center gap-1.5">
                                            <span className={cn(
                                              "px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-wider border leading-none",
                                              color.badge
                                            )}>
                                              {color.label}
                                            </span>
                                          </div>
                                          <span className="text-[7px] text-neutral-400 dark:text-neutral-500 font-mono">
                                            {formattedTime}
                                          </span>
                                        </div>

                                        <div className="flex items-center justify-between gap-2 mt-1">
                                          <p className={cn(
                                            "text-[9px] font-bold leading-snug",
                                            detailedLogTheme === 'dark' ? "text-neutral-200" : "text-neutral-700"
                                          )}>
                                            {event.detail}
                                          </p>
                                          {event.gap && (
                                            <div className={cn(
                                              "flex items-center gap-0.5 px-1 py-0.2 rounded border shrink-0 leading-none",
                                              event.gap === 'START'
                                                ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                                : "bg-neutral-200/50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-800 text-neutral-550 dark:text-neutral-400"
                                            )}>
                                              <span className="text-[7px] font-black font-mono tracking-wider">
                                                {event.gap}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            ) : (
                              <div className={cn(
                                "border rounded-xl p-3 overflow-x-auto h-full overflow-y-auto custom-scrollbar text-left",
                                detailedLogTheme === 'dark' ? "bg-neutral-950 border-neutral-800" : "bg-neutral-50 border-neutral-200"
                              )}>
                                <pre className="text-[8px] font-mono whitespace-pre-wrap leading-tight">
                                  {JSON.stringify(mockDetailedLogs[activeDetailedLog].actions, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>

                          {/* Footer */}
                          <div className={cn(
                            "px-4 py-2.5 border-t text-right shrink-0",
                            detailedLogTheme === 'dark' ? 'border-neutral-800 bg-neutral-900/20' : 'border-neutral-100 bg-neutral-50'
                          )}>
                            <button
                              onClick={handleCloseSimulatedLog}
                              className={cn(
                                "px-3 py-1 text-[9px] font-bold rounded-lg transition-colors",
                                detailedLogTheme === 'dark'
                                  ? "bg-neutral-800 hover:bg-neutral-700 text-white"
                                  : "bg-neutral-100 hover:bg-neutral-200 text-neutral-800"
                              )}
                            >
                              {t('marketing_v2.control_center_page.productivity.btn_close')}
                            </button>
                          </div>
                        </motion.div>
                      </div>
                    )}
                  </AnimatePresence>

                </motion.div>
              
  )
}
