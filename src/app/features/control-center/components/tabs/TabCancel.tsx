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


export function TabCancel({ mockupsState, setActiveTab }: { mockupsState: any, setActiveTab: (tab: string) => void }) {
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
                  className="space-y-6 text-left max-w-xl mx-auto p-4 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] shadow-sm"
                >
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                      <XCircle className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-black uppercase tracking-wider text-neutral-800 dark:text-white">
                        {t('marketing_v2.control_center_page.cancel_flow.title')}
                      </h4>
                      <p className="text-[10px] text-neutral-500 leading-normal max-w-sm">
                        {t('marketing_v2.control_center_page.cancel_flow.desc')}
                      </p>
                    </div>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      triggerToast(t('marketing_v2.control_center_page.simulator.toast_cancel_success'))
                      setSelectedReasons([])
                      setCancelComment('')
                    }}
                    className="space-y-5 pt-4 border-t border-neutral-100 dark:border-neutral-800"
                  >
                    <div className="space-y-3">
                      <label className="text-[9px] font-black uppercase text-red-500 tracking-wider">
                        {t('marketing_v2.control_center_page.cancel_flow.reason_label')}
                      </label>

                      <div className="space-y-2">
                        {[
                          'price',
                          'usability',
                          'features',
                          'strategy',
                          'other'
                        ].map((reasonKey) => {
                          const checked = selectedReasons.includes(reasonKey)
                          return (
                            <div
                              key={reasonKey}
                              onClick={() => toggleReason(reasonKey)}
                              className={cn(
                                "p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-colors text-[10px] font-bold text-neutral-700 dark:text-neutral-300",
                                checked
                                  ? 'bg-neutral-50 dark:bg-neutral-900 border-indigo-500/30'
                                  : 'bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900'
                              )}
                            >
                              <div className="shrink-0 text-indigo-500">
                                {checked ? (
                                  <div className="w-4 h-4 bg-indigo-500 text-white rounded-full flex items-center justify-center text-[10px]">✓</div>
                                ) : (
                                  <div className="w-4 h-4 rounded-full border border-neutral-300 dark:border-neutral-700"></div>
                                )}
                              </div>
                              <span>{t(`marketing_v2.control_center_page.cancel_flow.reasons.${reasonKey}`)}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase text-red-500 tracking-wider">
                        {t('marketing_v2.control_center_page.cancel_flow.comment_label')}
                      </label>
                      <textarea
                        value={cancelComment}
                        onChange={(e) => setCancelComment(e.target.value)}
                        placeholder={t('marketing_v2.control_center_page.cancel_flow.comment_placeholder')}
                        className="w-full p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs font-medium focus:outline-none focus:border-indigo-500 text-neutral-800 dark:text-neutral-200 min-h-[80px]"
                      />
                    </div>

                    <div className="flex gap-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('bi')
                          triggerToast(t('marketing_v2.control_center_page.simulator.toast_keep_sub'))
                        }}
                        className="flex-grow py-2.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 rounded-xl text-xs font-bold transition-colors"
                      >
                        {t('marketing_v2.control_center_page.cancel_flow.btn_keep')}
                      </button>
                      <button
                        type="submit"
                        className="flex-grow py-2.5 bg-red-600 hover:bg-red-750 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1"
                      >
                        <Zap className="w-3.5 h-3.5 fill-current" />
                        <span>{t('marketing_v2.control_center_page.cancel_flow.btn_cancel')}</span>
                      </button>
                    </div>
                  </form>
                </motion.div>
              
  )
}
