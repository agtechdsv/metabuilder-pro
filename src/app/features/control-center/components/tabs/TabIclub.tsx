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


export function TabIclub({ mockupsState, setActiveTab }: { mockupsState: any, setActiveTab: (tab: string) => void }) {
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Link de Indicação */}
                    <div className="p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl space-y-3 shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
                          <Users className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">{t('marketing_v2.control_center_page.iclub.share_earn')}</span>
                      </div>
                      <h4 className="text-sm font-black dark:text-white">{t('marketing_v2.control_center_page.iclub.link_title')}</h4>
                      <p className="text-[10px] text-neutral-500">{t('marketing_v2.control_center_page.iclub.link_desc')}</p>

                      <div className="flex gap-2 items-center bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-2.5">
                        <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-400 truncate flex-grow">
                          https://metabuilder.pro/?ref=d502254b
                        </span>
                        <button
                          onClick={() => triggerToast(t('marketing_v2.control_center_page.simulator.toast_copied'))}
                          className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[9px] font-black uppercase transition-all"
                        >
                          {t('marketing_v2.control_center_page.productivity.btn_copy')}
                        </button>
                      </div>
                    </div>

                    {/* Faturamento com Desconto Acumulado */}
                    <div className="p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl space-y-3 shadow-sm flex flex-col justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
                          <Zap className="w-4 h-4 text-indigo-500" />
                        </div>
                        <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">{t('marketing_v2.control_center_page.iclub.billing_title')}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400">{t('marketing_v2.control_center_page.iclub.discount_title')}</span>
                        <h4 className="text-xl font-black text-indigo-600 dark:text-indigo-400 leading-none mt-1">{t('marketing_v2.control_center_page.iclub.discount_val')}</h4>
                        <p className="text-[9px] text-neutral-400 font-bold mt-1.5">{t('marketing_v2.control_center_page.iclub.discount_desc')}</p>
                      </div>
                    </div>
                  </div>

                  {/* Volume Progresso */}
                  <div className="p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl space-y-3 shadow-sm">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-neutral-550">{t('marketing_v2.control_center_page.iclub.volume_title')}</span>
                      <span className="text-neutral-900 dark:text-white">{t('marketing_v2.control_center_page.iclub.volume_status')}</span>
                    </div>
                    <div className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-full h-2 overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: '23%' }}></div>
                    </div>
                    <p className="text-[9px] text-neutral-400 font-bold leading-none">
                      {t('marketing_v2.control_center_page.iclub.volume_desc')}
                    </p>
                  </div>

                  {/* Table of referrals and rewards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Indicações Table */}
                    <div className="sm:col-span-2 p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl space-y-3">
                      <h5 className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">{t('marketing_v2.control_center_page.iclub.referrals_title')}</h5>
                      <div className="border border-neutral-100 dark:border-neutral-800 rounded-xl overflow-hidden bg-neutral-50/50 dark:bg-neutral-900/10">
                        <table className="w-full text-left border-collapse text-[9px]">
                          <thead>
                            <tr className="bg-neutral-100 dark:bg-neutral-900/60 border-b border-neutral-200 dark:border-neutral-800 text-[8px] font-black uppercase text-neutral-400 tracking-wider">
                              <th className="px-3 py-1.5">{t('marketing_v2.control_center_page.iclub.col_email')}</th>
                              <th className="px-3 py-1.5 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium">
                            <tr>
                              <td className="px-3 py-2">joao.silva@empresa.com</td>
                              <td className="px-3 py-2 text-center">
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase">{t('marketing_v2.control_center_page.iclub.status_referred')}</span>
                              </td>
                            </tr>
                            <tr>
                              <td className="px-3 py-2">maria.santos@empresa.com</td>
                              <td className="px-3 py-2 text-center">
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase">{t('marketing_v2.control_center_page.iclub.status_referred')}</span>
                              </td>
                            </tr>
                            <tr>
                              <td className="px-3 py-2">pedro.oliveira@empresa.com</td>
                              <td className="px-3 py-2 text-center">
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase">{t('marketing_v2.control_center_page.iclub.status_referred')}</span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Rewards Historial */}
                    <div className="p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl space-y-3">
                      <h5 className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">{t('marketing_v2.control_center_page.iclub.rewards_title')}</h5>
                      <div className="space-y-2">
                        <div className="p-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-1">
                          <div className="flex justify-between items-center text-[8px] font-bold text-neutral-400">
                            <span>{t('marketing_v2.control_center_page.iclub.reward_discount')}</span>
                            <span>{t('marketing_v2.control_center_page.iclub.reward_date')}</span>
                          </div>
                          <p className="text-[9px] font-bold dark:text-white leading-none">{t('marketing_v2.control_center_page.iclub.reward_bonus')}</p>
                        </div>
                        <div className="p-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-1">
                          <div className="flex justify-between items-center text-[8px] font-bold text-neutral-400">
                            <span>{t('marketing_v2.control_center_page.iclub.reward_discount')}</span>
                            <span>24/05/2026</span>
                          </div>
                          <p className="text-[9px] font-bold dark:text-white leading-none">{t('marketing_v2.control_center_page.iclub.reward_bonus')}</p>
                        </div>
                        <div className="p-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-1">
                          <div className="flex justify-between items-center text-[8px] font-bold text-neutral-400">
                            <span>{t('marketing_v2.control_center_page.iclub.reward_discount')}</span>
                            <span>23/05/2026</span>
                          </div>
                          <p className="text-[9px] font-bold dark:text-white leading-none">{t('marketing_v2.control_center_page.iclub.reward_bonus')}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              
  )
}
