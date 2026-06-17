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


export function TabBi({ mockupsState, setActiveTab }: { mockupsState: any, setActiveTab: (tab: string) => void }) {
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
                  className="space-y-6 text-left"
                >
                  {/* Cards Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-4 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col items-center justify-between text-center min-h-[110px]">
                      <span className="text-[9px] font-black uppercase text-neutral-400">{t('marketing_v2.control_center_page.bi.licenses')}</span>
                      <div className="relative w-16 h-8 flex items-end justify-center overflow-hidden">
                        <svg className="w-full h-full" viewBox="0 0 60 30">
                           <path d="M 5,30 A 25,25 0 0,1 55,30" fill="none" stroke="#e5e7eb" strokeWidth="6" className="dark:stroke-neutral-800" />
                           <path d="M 5,30 A 25,25 0 0,1 55,30" fill="none" stroke="#10b981" strokeWidth="6" strokeDasharray="78" strokeDashoffset="26" />
                        </svg>
                        <span className="absolute bottom-0 text-xs font-black dark:text-white">2 <span className="text-[10px] text-neutral-400 font-bold">/ 3</span></span>
                      </div>
                      <span className="text-[8px] text-neutral-400 font-bold leading-none">{t('marketing_v2.control_center_page.bi.active_users')}</span>
                    </div>

                    <div className="p-4 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col items-center justify-between text-center min-h-[110px]">
                      <span className="text-[9px] font-black uppercase text-neutral-400">{t('marketing_v2.control_center_page.bi.workspaces')}</span>
                      <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                        <Users className="w-4 h-4" />
                      </div>
                      <h4 className="text-lg font-black dark:text-white leading-none">1</h4>
                      <span className="text-[8px] text-neutral-400 font-bold leading-none">{t('marketing_v2.control_center_page.bi.created_env')}</span>
                    </div>

                    <div className="p-4 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col items-center justify-between text-center min-h-[110px]">
                      <span className="text-[9px] font-black uppercase text-neutral-400">{t('marketing_v2.control_center_page.bi.projects')}</span>
                      <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                        <FileText className="w-4 h-4" />
                      </div>
                      <h4 className="text-lg font-black dark:text-white leading-none">1</h4>
                      <span className="text-[8px] text-neutral-400 font-bold leading-none">{t('marketing_v2.control_center_page.bi.all_workspaces')}</span>
                    </div>

                    <div className="p-4 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col items-center justify-between text-center min-h-[110px]">
                      <span className="text-[9px] font-black uppercase text-neutral-400">{t('marketing_v2.control_center_page.bi.use_cases')}</span>
                      <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <Layout className="w-4 h-4" />
                      </div>
                      <h4 className="text-lg font-black dark:text-white leading-none">3</h4>
                      <span className="text-[8px] text-neutral-400 font-bold leading-none">{t('marketing_v2.control_center_page.bi.functional_screens')}</span>
                    </div>
                  </div>

                  {/* Horizon Charts grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-3">
                      <h5 className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">{t('marketing_v2.control_center_page.bi.projects_per_ws')}</h5>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-neutral-700 dark:text-neutral-300">
                          <span>AGTech</span>
                          <span>1</span>
                        </div>
                        <div className="w-full h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500 w-full"></div>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-3">
                      <h5 className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">{t('marketing_v2.control_center_page.bi.cases_per_project')}</h5>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-neutral-700 dark:text-neutral-300">
                          <span>Build Flow</span>
                          <span>3</span>
                        </div>
                        <div className="w-full h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 w-full"></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Donut Chart & Details Table */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Donut Chart */}
                    <div className="p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col items-center justify-between min-h-[180px]">
                      <h5 className="text-[10px] font-black uppercase text-neutral-400 tracking-wider w-full">{t('marketing_v2.control_center_page.bi.cases_by_type')}</h5>

                      <div className="relative w-20 h-20 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                          {/* Mestre-Detalhe (orange) */}
                          <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f59e0b" strokeWidth="4" strokeDasharray="33.3 100" strokeDashoffset="0" />
                          {/* Cadastro (green) */}
                          <circle cx="18" cy="18" r="15.915" fill="none" stroke="#10b981" strokeWidth="4" strokeDasharray="33.3 100" strokeDashoffset="-33.3" />
                          {/* Analytios (blue) */}
                          <circle cx="18" cy="18" r="15.915" fill="none" stroke="#6366f1" strokeWidth="4" strokeDasharray="33.4 100" strokeDashoffset="-66.6" />
                        </svg>
                        <span className="absolute text-[10px] font-black dark:text-white">3</span>
                      </div>

                      <div className="flex gap-2 flex-wrap text-[8px] font-black uppercase text-neutral-400 justify-center">
                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>{t('marketing_v2.control_center_page.bi.search')}</span>
                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>{t('marketing_v2.control_center_page.bi.create')}</span>
                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>{t('marketing_v2.control_center_page.bi.master')}</span>
                      </div>
                    </div>

                    {/* Table workspace */}
                    <div className="sm:col-span-2 p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-3">
                      <h5 className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">{t('marketing_v2.control_center_page.bi.ws_details')}</h5>

                      <div className="border border-neutral-100 dark:border-neutral-800 rounded-xl overflow-hidden bg-neutral-50/50 dark:bg-neutral-900/10">
                        <table className="w-full text-left border-collapse text-[10px]">
                          <thead>
                            <tr className="bg-neutral-100 dark:bg-neutral-900/60 border-b border-neutral-200 dark:border-neutral-800 text-[8px] font-black uppercase text-neutral-400 tracking-wider">
                              <th className="px-3 py-2">{t('marketing_v2.control_center_page.bi.ws_col')}</th>
                              <th className="px-3 py-2 text-center">{t('marketing_v2.control_center_page.bi.projects_col')}</th>
                              <th className="px-3 py-2 text-center">{t('marketing_v2.control_center_page.bi.cases_col')}</th>
                              <th className="px-3 py-2 text-center">{t('marketing_v2.control_center_page.bi.users_col')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-neutral-700 dark:text-neutral-300">
                            {biWorkspaces.map((ws: any, i: any) => (
                              <tr key={i} className="hover:bg-neutral-100/50 dark:hover:bg-neutral-900/20">
                                <td className="px-3 py-2.5 font-bold flex items-center gap-1.5">
                                  <span className="w-4 h-4 rounded bg-indigo-500/10 text-indigo-500 flex items-center justify-center text-[8px] font-black">AG</span>
                                  <span>{ws.name}</span>
                                </td>
                                <td className="px-3 py-2.5 text-center font-bold">{ws.projects}</td>
                                <td className="px-3 py-2.5 text-center font-bold">{ws.cases}</td>
                                <td className="px-3 py-2.5 text-center font-bold">{ws.users}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </motion.div>
              
  )
}
