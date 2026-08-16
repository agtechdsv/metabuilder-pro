'use client'

import { useState, useMemo, useEffect } from 'react'
import { ClientMetricsView } from './ClientMetricsView'
import { ClientProductivityView } from './ClientProductivityView'
import { ClientIClubView } from './ClientIClubView'
import { ClientSubscriptionView } from './ClientSubscriptionView'
import { ClientCancelView } from './ClientCancelView'
import { ClientWhiteLabelView } from './ClientWhiteLabelView'
import { motion, AnimatePresence } from 'framer-motion'
import { StatusBadge } from './ClientSharedComponents'
import {
  Gauge,
  LayoutGrid,
  CreditCard,
  XCircle,
  Building2,
  FolderKanban,
  Layers,
  Users,
  TrendingUp,
  Calendar,
  CheckCircle,
  Clock,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Shield,
  ChevronRight,
  Loader2,
  BarChart3,
  Zap,
  Activity,
  Check,
  Sliders,
  Compass,
  Database,
  Code,
  Download,
  Copy,
  Lightbulb,
  RefreshCw,
  Globe,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { MetaVoiceView } from './MetaVoiceView'
import CommunityHubView from './CommunityHubView'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useClientMetrics } from './hooks/useClientMetrics'
import { useClientSubscription } from './hooks/useClientSubscription'
import { useClientIClub } from './hooks/useClientIClub'
import { useClientActivity } from './hooks/useClientActivity'
import { getIClubDashboardData } from '@/app/actions/iclub'
import type { IClubRule, IClubReferral, IClubReward } from '@/lib/iclub'
import { CliFilesClientView } from './CliFilesClientView'
import { TeamDrawer } from '@/components/workspace/TeamDrawer'
import SecuritySettings from '@/components/workspace/SecuritySettings'
import { useI18n } from '@/i18n/I18nContext'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Profile {
  id: string
  full_name: string | null
  email: string | null
  subscription_licenses?: number | null
  subscription_status?: string | null
  subscription_cycle?: string | null
  subscription_expires_at?: string | null
  asaas_customer_id?: string | null
  asaas_subscription_id?: string | null
  is_super_admin?: boolean | null
  card_brand?: string | null
  card_last_digits?: string | null
  enforce_mfa?: boolean | null
}

interface Workspace {
  id: string
  name: string
  slug: string
  created_at: string
}

interface Project {
  id: string
  name: string
  workspace_id: string
  created_at: string
  secret_token?: string
}

interface UseCase {
  id: string
  name: string
  project_id: string
  logic_type: string | null
  status?: string | null
  created_at: string
}

interface Member {
  workspace_id: string
  user_id: string
}

interface Payment {
  id: string
  amount: number
  status: string
  cycle: string | null
  billing_type: string | null
  invoice_url: string | null
  created_at: string
}

interface ClientDashboardClientProps {
  profile: Profile | null
  rules?: any
  workspaces: any[]
  projects: any[]
  useCases: UseCase[]
  members: Member[]
  profiles: { id: string; full_name: string | null; email: string | null }[]
  payments: Payment[]
  activityLogs?: any[]
  ownerGuests?: any[]
}

// ─── Main Component ───────────────────────────────────────────────────────────

const TABS = [
  { id: 'dashboard', label: 'Dashboard BI', icon: BarChart3 },
  { id: 'productivity', label: 'Produtividade', icon: Activity },
  { id: 'downloads', label: 'Central de Downloads', icon: Download },
  { id: 'whitelabel', label: 'White-Label', icon: Globe },
  { id: 'community', label: 'MetaBuilders', icon: Users },
  { id: 'metavoice', label: 'MetaVoice', icon: Lightbulb },
  { id: 'iclub', label: 'iClub', icon: Zap },
  { id: 'security', label: 'Segurança', icon: ShieldCheck },
  { id: 'subscription', label: 'Assinatura', icon: CreditCard },
  { id: 'cancel', label: 'Cancelamento', icon: XCircle },
] as const

type TabId = typeof TABS[number]['id']

export default function ClientDashboardClient({
  profile,
  rules,
  workspaces,
  projects,
  useCases,
  members,
  profiles,
  payments,
  activityLogs = [],
  ownerGuests = [],
}: ClientDashboardClientProps) {
  const { t } = useI18n()
  const [localProfile, setLocalProfile] = useState(profile)
  const isGuest = !localProfile?.is_super_admin && !localProfile?.subscription_licenses
  const [activeTab, setActiveTab] = useState<TabId>(isGuest ? 'downloads' : 'dashboard')

  const [isTeamDrawerOpen, setIsTeamDrawerOpen] = useState(false)

  const { toast } = useToast()
  const router = useRouter()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const getTabLabel = (id: string, fallback: string) => {
    return t(`client_dashboard.tabs.${id}`, fallback)
  }

  const refreshAllData = () => {
    setIsRefreshing(true)
    router.refresh()
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  const canCancel =
    localProfile?.subscription_status !== 'canceled' &&
    !!localProfile?.asaas_subscription_id

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const tab = params.get('tab') as TabId
      if (tab && TABS.some(t => t.id === tab)) {
        if (!isGuest || tab === 'metavoice' || tab === 'community' || tab === 'downloads') {
          setActiveTab(tab)
        }
      }
    }
  }, [isGuest])

  useEffect(() => {
    if (isGuest && activeTab !== 'metavoice' && activeTab !== 'community' && activeTab !== 'downloads') {
      setActiveTab('downloads')
    }
  }, [isGuest, activeTab])


  const {
    asaasSubData,
    loadingAsaasData,
    showCardModal,
    setShowCardModal,
    isUpdatingCard,
    cardForm,
    setCardForm,
    handleUpdateCard,
    selectedReasons,
    setSelectedReasons,
    cancellationComment,
    setCancellationComment,
    cancellationError,
    setCancellationError,
    isCanceling,
    showCancelModal,
    setShowCancelModal,
    handleCancelSubscription,
    CANCELLATION_REASONS
  } = useClientSubscription({
    localProfile,
    setLocalProfile,
    activeTab,
    workspaces,
    toast,
    router
  });

  const {
    iclubData,
    loadingIClub,
    fetchIClubData
  } = useClientIClub({
    activeTab,
    toast
  });

  const {
    prodFilterProject,
    setProdFilterProject,
    prodFilterUser,
    setProdFilterUser,
    prodFilterPeriod,
    setProdFilterPeriod,
    prodSubTab,
    setProdSubTab,
    selectedLog,
    setSelectedLog,
    modalTab,
    setModalTab,
    copied,
    setCopied,
    filteredActivityLogs,
    handleCloseLogModal,
    handleCopyJson,
    handleDownloadJson,
    getEventMeta,
    eventsArray
  } = useClientActivity({
    activityLogs,
    toast
  });

  const {
    licensesUsed,
    projectsByWorkspace,
    useCasesByProject,
    useCasesByType,
    lastSuccessfulPayment,
    getPlanPrice
  } = useClientMetrics({
    profile,
    ownerGuests,
    workspaces,
    projects,
    useCases,
    payments,
    rules
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {isGuest ? (
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner",
              activeTab === 'community' ? "bg-blue-500/10 text-blue-500" : "bg-amber-500/10 text-amber-500"
            )}>
              {activeTab === 'community' ? <Users className="w-6 h-6" /> : <Lightbulb className="w-6 h-6" />}
            </div>
            <div>
              <h1 className="text-2xl font-black text-neutral-900 dark:text-white">
                {activeTab === 'community' ? t('client_dashboard.community_title', 'MetaBuilders') : activeTab === 'downloads' ? t('client_dashboard.downloads_title', 'Central de Downloads') : t('client_dashboard.metavoice_title', 'Sugestões & Ideias (MetaVoice)')}
              </h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                {activeTab === 'community' 
                  ? t('client_dashboard.community_subtitle', 'Conecte-se com outros Owners e Desenvolvedores') 
                  : activeTab === 'downloads'
                  ? t('client_dashboard.downloads_subtitle', 'Baixe a IDE Desktop e mantenha seu ambiente de trabalho sempre atualizado')
                  : t('client_dashboard.metavoice_subtitle', 'Deixe sugestões ou vote nas ideias da comunidade para nos ajudar a melhorar o MetaBuilder PRO')
                }
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shadow-inner">
                <Gauge className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-neutral-900 dark:text-white">{t('client_dashboard.title', 'Painel de Controle')}</h1>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {t('client_dashboard.subtitle', 'Visão geral dos seus dados, assinatura e conta')}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-4 md:mt-0">
              {localProfile?.subscription_status && (
                <StatusBadge status={localProfile.subscription_status} />
              )}
              {!isGuest && (
                <>
                  <div className="flex items-center p-1 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl h-11">
                    <button 
                      onClick={() => setActiveTab('subscription')}
                      className={cn(
                        "flex items-center justify-center gap-2 px-3 h-full rounded-lg text-sm font-bold transition-all duration-200",
                        activeTab === 'subscription' 
                          ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm"
                          : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                      )}
                    >
                      <CreditCard className={cn("w-4 h-4", activeTab === 'subscription' ? "text-emerald-500 dark:text-emerald-400" : "")} />
                      <span className="hidden lg:inline">{getTabLabel('subscription', 'Assinatura')}</span>
                    </button>
                    <div className="w-px h-4 bg-neutral-300 dark:bg-neutral-700 mx-1"></div>
                    <button 
                      onClick={() => setActiveTab('cancel')}
                      title={getTabLabel('cancel', 'Cancelamento')}
                      className={cn(
                        "flex items-center justify-center gap-2 px-3 h-full rounded-lg text-sm font-bold transition-all duration-200",
                        activeTab === 'cancel' 
                          ? "bg-white dark:bg-neutral-800 text-rose-600 dark:text-rose-500 shadow-sm"
                          : "text-neutral-500 hover:text-rose-500 dark:hover:text-rose-400"
                      )}
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>

                  <button 
                    onClick={() => setIsTeamDrawerOpen(true)}
                    className="flex items-center justify-center gap-2 h-11 px-4 rounded-xl text-sm font-bold transition-all duration-200 whitespace-nowrap bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-700 shadow-sm"
                  >
                    <Users className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                    <span className="hidden sm:inline">{t('client_dashboard.team', 'Equipe')}</span>
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Tab Navigation */}
      <div className={cn("flex flex-col sm:flex-row gap-4 w-full", isGuest ? "sm:justify-end" : "sm:items-center sm:justify-between")}>
          {/* Guests (devs): show 3-tab bar with Downloads, MetaBuilders, MetaVoice */}
          {isGuest && (
            <div className="flex sm:grid sm:grid-cols-3 gap-2 p-1.5 bg-neutral-100 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 w-full xl:w-fit overflow-x-auto no-scrollbar">
              {(['downloads', 'community', 'metavoice'] as const).map(tabId => {
                const tab = TABS.find(t => t.id === tabId)!
                return (
                  <button
                    key={tab.id}
                    id={`client-tab-${tab.id}`}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 whitespace-nowrap min-w-[130px] sm:min-w-0',
                      activeTab === tab.id
                        ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                        : 'text-neutral-500 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                    )}
                  >
                    <tab.icon className={cn(
                      "w-4 h-4",
                      tab.id === 'downloads' && "text-cyan-500 dark:text-cyan-400",
                      tab.id === 'community' && "text-blue-500 dark:text-blue-400",
                      tab.id === 'metavoice' && "text-amber-500 dark:text-amber-400",
                    )} />
                    <span className="hidden sm:block">{getTabLabel(tab.id, tab.label)}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Owners: existing left tab group */}
          {!isGuest && (
          <div className="flex sm:grid sm:grid-cols-5 gap-2 p-1.5 bg-neutral-100 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 w-full xl:w-fit overflow-x-auto no-scrollbar">
            {TABS.filter(tab => !['iclub', 'metavoice', 'community', 'subscription', 'cancel'].includes(tab.id)).map(tab => (
              <button
                key={tab.id}
                id={`client-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 whitespace-nowrap min-w-[140px] sm:min-w-0',
                  activeTab === tab.id
                    ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                    : 'text-neutral-500 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                )}
              >
                <tab.icon className={cn(
                  "w-4 h-4",
                  tab.id === 'dashboard' && "text-indigo-500 dark:text-indigo-400",
                  tab.id === 'productivity' && "text-purple-500 dark:text-purple-400",
                  tab.id === 'downloads' && "text-cyan-500 dark:text-cyan-400",
                  tab.id === 'security' && "text-indigo-500 dark:text-indigo-400",
                  tab.id === 'subscription' && "text-emerald-500 dark:text-emerald-400",
                  tab.id === 'cancel' && "text-rose-500 dark:text-rose-400"
                )} />
                <span className="hidden sm:block">{getTabLabel(tab.id, tab.label)}</span>
              </button>
            ))}
          </div>
        )}

        {!isGuest && (
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* Right Tab Group (Engagement / MetaVoice & iClub) */}
            <div className={cn(
              "flex sm:grid gap-2 p-1.5 bg-neutral-100 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 w-fit",
              isGuest ? "sm:grid-cols-2" : "sm:grid-cols-3"
            )}>
            {TABS.filter(tab => {
              if (isGuest && tab.id === 'iclub') return false;
              return tab.id === 'metavoice' || tab.id === 'iclub' || tab.id === 'community';
            }).map(tab => (
              <button
                key={tab.id}
                id={`client-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 w-full whitespace-nowrap',
                  activeTab === tab.id
                    ? 'bg-white dark:bg-neutral-800 shadow-sm text-neutral-900 dark:text-white'
                    : 'text-neutral-500 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                )}
              >
                <tab.icon className={cn(
                  "w-4 h-4",
                  tab.id === 'iclub'
                    ? "text-indigo-500 dark:text-indigo-400"
                    : tab.id === 'community'
                    ? "text-blue-500 dark:text-blue-400"
                    : "text-amber-500 dark:text-amber-400"
                )} />
                <span>{getTabLabel(tab.id, tab.label)}</span>
              </button>
            ))}
            </div>
          </div>
        )}
      </div>

      {/* Tab Panels */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >

          {/* ── TAB: MetaVoice (Sugestões) ────────────────────────────────── */}
          {activeTab === 'community' && (
            <CommunityHubView />
          )}

          {activeTab === 'metavoice' && (
            <MetaVoiceView userId={localProfile?.id} />
          )}

          {/* ── TAB: Central de Downloads ─────────────────────────────────────── */}
          {activeTab === 'downloads' && (
            <CliFilesClientView projects={projects} devOnly={isGuest} />
          )}

          {/* ── TAB: White Label ─────────────────────────────────────── */}
          {activeTab === 'whitelabel' && (
            <ClientWhiteLabelView workspaces={workspaces} projects={projects} />
          )}

          {/* ── TAB: Dashboard BI ─────────────────────────────────────── */}
          {activeTab === 'dashboard' && (
            <ClientMetricsView
              isRefreshing={isRefreshing}
              refreshAllData={refreshAllData}
              licensesUsed={licensesUsed}
              localProfile={localProfile}
              workspaces={workspaces}
              projects={projects}
              useCases={useCases}
              projectsByWorkspace={projectsByWorkspace}
              useCasesByProject={useCasesByProject}
              useCasesByType={useCasesByType}
              members={members}
              ownerGuests={ownerGuests}
            />
          )}
          {/* ── TAB: Produtividade ─────────────────────────────────────── */}
          {activeTab === 'productivity' && (
            <ClientProductivityView
              prodFilterProject={prodFilterProject}
              setProdFilterProject={setProdFilterProject}
              prodFilterUser={prodFilterUser}
              setProdFilterUser={setProdFilterUser}
              prodFilterPeriod={prodFilterPeriod}
              setProdFilterPeriod={setProdFilterPeriod}
              prodSubTab={prodSubTab}
              setProdSubTab={setProdSubTab}
              selectedLog={selectedLog}
              setSelectedLog={setSelectedLog}
              modalTab={modalTab}
              setModalTab={setModalTab}
              copied={copied}
              filteredActivityLogs={filteredActivityLogs}
              handleCloseLogModal={handleCloseLogModal}
              handleCopyJson={handleCopyJson}
              handleDownloadJson={handleDownloadJson}
              getEventMeta={getEventMeta}
              eventsArray={eventsArray}
              isRefreshing={isRefreshing}
              refreshAllData={refreshAllData}
              projects={projects}
              profiles={profiles}
              useCases={useCases}
            />
          )}
          {/* ── TAB: iClub ────────────────────────────────────────────── */}
          {activeTab === 'iclub' && (
            <ClientIClubView
              loadingIClub={loadingIClub}
              iclubData={iclubData}
              localProfile={localProfile}
              toast={toast}
            />
          )}
          {/* ── TAB: Segurança (Security) ───────────────────────────────────────── */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              {localProfile && (
                <SecuritySettings profile={localProfile} isOwner={true} />
              )}
            </div>
          )}

          {/* ── TAB: Assinatura ───────────────────────────────────────── */}
          {activeTab === 'subscription' && (
            <ClientSubscriptionView
              loadingAsaasData={loadingAsaasData}
              asaasSubData={asaasSubData}
              toast={toast}
              localProfile={localProfile}
              setCardForm={setCardForm}
              setShowCardModal={setShowCardModal}
              router={router}
              lastSuccessfulPayment={lastSuccessfulPayment}
              payments={payments}
            />
          )}
          {/* ── TAB: Cancelamento ─────────────────────────────────────── */}
          {activeTab === 'cancel' && (
            <ClientCancelView
              localProfile={localProfile}
              CANCELLATION_REASONS={CANCELLATION_REASONS}
              selectedReasons={selectedReasons}
              setSelectedReasons={setSelectedReasons}
              cancellationError={cancellationError}
              setCancellationError={setCancellationError}
              cancellationComment={cancellationComment}
              setCancellationComment={setCancellationComment}
              setActiveTab={setActiveTab}
              canCancel={canCancel}
              showCancelModal={showCancelModal}
              setShowCancelModal={setShowCancelModal}
              isCanceling={isCanceling}
              handleCancelSubscription={handleCancelSubscription}
            />
          )}
        </motion.div>
      </AnimatePresence>

      <TeamDrawer 
        isOpen={isTeamDrawerOpen}
        onClose={() => setIsTeamDrawerOpen(false)}
        onRequestSubscriptionUpdate={() => setActiveTab('subscription')}
      />
    </div>
  )
}
