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


export function TabMetavoice({ mockupsState, setActiveTab }: { mockupsState: any, setActiveTab: (tab: string) => void }) {
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
                  {/* Banner */}
                  <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-2xl p-5 text-white relative overflow-hidden border border-indigo-500/20">
                    <div className="relative z-10 space-y-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black bg-white/10 border border-white/20">
                        <Lightbulb className="w-3 h-3 text-amber-400" /> MetaVoice
                      </span>
                      <h4 className="text-sm font-black">{t('marketing_v2.control_center_page.metavoice_sim.title')}</h4>
                      <p className="text-[10px] text-indigo-200 leading-relaxed">
                        {t('marketing_v2.control_center_page.metavoice_sim.desc')}
                      </p>
                    </div>
                  </div>

                  {/* Mock Suggestions Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Card 1 */}
                    <div className="p-4 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-3 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 text-[8px] font-black uppercase">{t('marketing_v2.control_center_page.metavoice_sim.status_planned')}</span>
                          <span className="text-[8px] font-black uppercase text-neutral-400 bg-neutral-100 dark:bg-neutral-900 px-2 py-0.5 rounded">{t('marketing_v2.control_center_page.metavoice_sim.cat_ui')}</span>
                        </div>
                        <h5 className="text-xs font-black dark:text-white line-clamp-1">{t('marketing_v2.control_center_page.metavoice_sim.idea1_title')}</h5>
                        <p className="text-[10px] text-neutral-500 line-clamp-2 mt-1">{t('marketing_v2.control_center_page.metavoice_sim.idea1_desc')}</p>
                      </div>
                      <div className="flex items-center justify-between pt-2.5 border-t border-neutral-100 dark:border-neutral-900 mt-2">
                        <div className="flex items-center gap-3 text-[10px] text-neutral-455 font-bold">
                          <span className="flex items-center gap-1 text-indigo-500"><ThumbsUp className="w-3.5 h-3.5" /> 24</span>
                          <span className="flex items-center gap-1 text-neutral-400"><MessageCircle className="w-3.5 h-3.5" /> 3</span>
                        </div>
                        <span className="text-[9px] text-amber-500 font-bold flex items-center gap-0.5"><Star className="w-3 h-3 fill-current" /> 4.8</span>
                      </div>
                    </div>

                    {/* Card 2 */}
                    <div className="p-4 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-3 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-500 text-[8px] font-black uppercase">{t('marketing_v2.control_center_page.metavoice_sim.status_running')}</span>
                          <span className="text-[8px] font-black uppercase text-neutral-400 bg-neutral-100 dark:bg-neutral-900 px-2 py-0.5 rounded">{t('marketing_v2.control_center_page.metavoice_sim.cat_integration')}</span>
                        </div>
                        <h5 className="text-xs font-black dark:text-white line-clamp-1">{t('marketing_v2.control_center_page.metavoice_sim.idea2_title')}</h5>
                        <p className="text-[10px] text-neutral-500 line-clamp-2 mt-1">{t('marketing_v2.control_center_page.metavoice_sim.idea2_desc')}</p>
                      </div>
                      <div className="flex items-center justify-between pt-2.5 border-t border-neutral-100 dark:border-neutral-900 mt-2">
                        <div className="flex items-center gap-3 text-[10px] text-neutral-455 font-bold">
                          <span className="flex items-center gap-1 text-indigo-500"><ThumbsUp className="w-3.5 h-3.5" /> 42</span>
                          <span className="flex items-center gap-1 text-neutral-400"><MessageCircle className="w-3.5 h-3.5" /> 7</span>
                        </div>
                        <span className="text-[9px] text-amber-500 font-bold flex items-center gap-0.5"><Star className="w-3 h-3 fill-current" /> 4.9</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              
  )
}
