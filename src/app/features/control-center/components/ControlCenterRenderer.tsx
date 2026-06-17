
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, CreditCard, XCircle, Activity, Check, ArrowRight,
  TrendingUp, RotateCcw, Zap, Users, FileText, ExternalLink, Sliders,
  Compass, Copy, Download, Code, Loader2, Shield, Lightbulb, MessageCircle,
  ThumbsUp, Star, Layout, Clock
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nContext'
import { useControlCenterMockups, LogAction } from '../hooks/useControlCenterMockups'
import CommunityHubView from '@/components/client/CommunityHubView'

import { TabBi } from './tabs/TabBi'
import { TabProductivity } from './tabs/TabProductivity'
import { TabSubscription } from './tabs/TabSubscription'
import { TabCancel } from './tabs/TabCancel'
import { TabIclub } from './tabs/TabIclub'
import { TabMetavoice } from './tabs/TabMetavoice'

export function ControlCenterRenderer({ activeTab, setActiveTab, mockupsState }: { activeTab: string, setActiveTab: (tab: any) => void, mockupsState: ReturnType<typeof useControlCenterMockups> }) {
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
    <>
      {/* Simulated Content Frame */}
            <div className="p-6 flex-grow overflow-y-auto max-h-[480px]">

              {/* TAB 1: DASHBOARD BI */}
              {activeTab === 'bi' && <TabBi mockupsState={mockupsState} setActiveTab={setActiveTab} />}
              {/* TAB: COMMUNITY PRO */}
              {activeTab === 'community' && (
                <CommunityHubView isSimulator={true} />
              )}

              {/* TAB 2: PRODUTIVIDADE */}
              {activeTab === 'productivity' && <TabProductivity mockupsState={mockupsState} setActiveTab={setActiveTab} />}
              {activeTab === 'subscription' && <TabSubscription mockupsState={mockupsState} setActiveTab={setActiveTab} />}
              {activeTab === 'cancel' && <TabCancel mockupsState={mockupsState} setActiveTab={setActiveTab} />}
              {activeTab === 'iclub' && <TabIclub mockupsState={mockupsState} setActiveTab={setActiveTab} />}
              {activeTab === 'metavoice' && <TabMetavoice mockupsState={mockupsState} setActiveTab={setActiveTab} />}
            </div>

            
    </>
  )
}
