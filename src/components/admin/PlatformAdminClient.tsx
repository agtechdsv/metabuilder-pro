'use client'

import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  Calendar,
  Layers,
  Zap,
  Lightbulb,
  BarChart3,
  RefreshCw,
  ShieldCheck,
  Rocket
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

import { MetaVoiceAdminView } from './MetaVoiceAdminView'
import CommunityHubView from '@/components/client/CommunityHubView'
import { CliFilesAdminView } from './CliFilesAdminView'
import { PricingRulesAdmin } from './PricingRulesAdmin'
import { ReleaseAdminView } from './ReleaseAdminView'
import { ReleaseCompletionNotifier } from './ReleaseCompletionNotifier'

import { useDashboardAdmin } from './hooks/useDashboardAdmin'
import { useClientsAdmin } from './hooks/useClientsAdmin'
import { useAgendaAdmin } from './hooks/useAgendaAdmin'
import { useIClubAdmin } from './hooks/useIClubAdmin'

import { DashboardTab } from './tabs/DashboardTab'
import { ClientsTab } from './tabs/ClientsTab'
import { AgendaTab } from './tabs/AgendaTab'
import { IClubTab } from './tabs/IClubTab'

interface Workspace {
  id: string
  name: string
  slug: string
  owner_id: string
  subscription_status: 'active' | 'blocked' | 'pending' | 'canceled'
  is_blocked: boolean
  created_at: string
  subscription_cycle?: string | null
}

interface Profile {
  id: string
  email: string
  full_name: string | null
  is_super_admin?: boolean | null
  subscription_licenses?: number | null
}

interface Payment {
  id: string
  user_id: string
  workspace_id: string
  cycle: string
  amount: number
  status: string
  external_reference: string
  billing_type: string | null
  invoice_url: string | null
  created_at: string
}

interface WorkspaceMember {
  workspace_id: string
  user_id: string
}

const TAB_CONFIG = {
  dashboard: { label: 'Dashboard BI', icon: BarChart3, iconColor: 'text-blue-500 dark:text-blue-400' },
  plans: { label: 'Regras de Preços', icon: Layers, iconColor: 'text-emerald-500 dark:text-emerald-400' },
  clients: { label: 'Gestão de Clientes', icon: Users, iconColor: 'text-purple-500 dark:text-purple-400' },
  agenda: { label: 'Agenda', icon: Calendar, iconColor: 'text-teal-500 dark:text-teal-400' },
  iclub: { label: 'Gestão do iClub', icon: Zap, iconColor: 'text-indigo-500 dark:text-indigo-400' },
  metavoice: { label: 'MetaVoice', icon: Lightbulb, iconColor: 'text-amber-500 dark:text-amber-400' },
  community: { label: 'MetaBuilders', icon: Users, iconColor: 'text-blue-500 dark:text-blue-400' },
  arquivos: { label: 'IDEs, CLI & Manuais', icon: Layers, iconColor: 'text-indigo-500 dark:text-indigo-400' },
  releases: { label: 'Releases (IDE)', icon: Rocket, iconColor: 'text-rose-500 dark:text-rose-400' },
} as const

interface PlatformAdminClientProps {
  initialWorkspaces: Workspace[]
  profiles: Profile[]
  currentUserEmail: string
  payments: Payment[]
  workspaceMembers: WorkspaceMember[]
  ownerGuests: any[]
}

export default function PlatformAdminClient({
  initialWorkspaces,
  profiles,
  currentUserEmail,
  payments,
  workspaceMembers,
  ownerGuests = []
}: PlatformAdminClientProps) {
  const router = useRouter()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = () => {
    setIsRefreshing(true)
    router.refresh()
    setTimeout(() => setIsRefreshing(false), 800)
  }

  const [activeTab, setActiveTab] = useState<'dashboard' | 'plans' | 'clients' | 'agenda' | 'iclub' | 'metavoice' | 'community' | 'arquivos' | 'releases'>('dashboard')

  const [workspaces, setWorkspaces] = useState<Workspace[]>(initialWorkspaces)
  const [clientProfiles, setClientProfiles] = useState<any[]>(profiles)

  useEffect(() => {
    setWorkspaces(initialWorkspaces)
    setClientProfiles(profiles)
  }, [initialWorkspaces, profiles])

  const mappedWorkspaces = useMemo(() => {
    return workspaces.map(w => {
      const ownerProfile = clientProfiles.find(p => p.id === w.owner_id)

      let planPrice = 0
      const wPayments = payments.filter(p =>
        p.workspace_id === w.id &&
        (p.status?.toLowerCase() === 'received' ||
          p.status?.toLowerCase() === 'confirmed' ||
          p.status?.toLowerCase() === 'active' ||
          p.status?.toLowerCase() === 'paid')
      )

      const latestPayment = wPayments.length > 0
        ? wPayments.reduce((latest, current) => {
          return new Date(current.created_at) > new Date(latest.created_at) ? current : latest
        })
        : null

      if (latestPayment) {
        const amount = Number(latestPayment.amount)
        const pCycle = latestPayment.cycle?.toLowerCase()
        switch (pCycle) {
          case 'monthly': planPrice = amount; break;
          case 'quarterly': planPrice = amount / 3; break;
          case 'semiannual':
          case 'semiannually': planPrice = amount / 6; break;
          case 'yearly': planPrice = amount / 12; break;
          default: planPrice = amount;
        }
      }

      const uniqueGuests = new Set<string>()
      workspaceMembers.filter(m => m.workspace_id === w.id && m.user_id !== w.owner_id).forEach(m => uniqueGuests.add(m.user_id))
      ownerGuests.filter(g => g.owner_id === w.owner_id && g.access_level === 'global').forEach(g => uniqueGuests.add(g.user_id))
      const guestCount = uniqueGuests.size

      return {
        ...w,
        ownerName: ownerProfile?.full_name || 'Sem nome',
        ownerEmail: ownerProfile?.email || 'Sem e-mail',
        ownerIsSuperAdmin: ownerProfile?.is_super_admin || false,
        ownerLicenses: ownerProfile?.subscription_licenses || 0,
        is_blocked: ownerProfile?.is_blocked || false,
        planPrice,
        guestCount
      } as any
    })
  }, [workspaces, clientProfiles, payments, workspaceMembers, ownerGuests])

  const dashboardHook = useDashboardAdmin(mappedWorkspaces, payments, clientProfiles, workspaceMembers, ownerGuests)
  const clientsHook = useClientsAdmin(mappedWorkspaces, setWorkspaces, setClientProfiles)
  const agendaHook = useAgendaAdmin(activeTab)
  const iclubHook = useIClubAdmin(activeTab)

  return (
    <div className="space-y-8 pb-10">
      <ReleaseCompletionNotifier />

      {/* Admin Panel Header */}
      <div className="flex flex-col gap-6 bg-white dark:bg-neutral-900/40 p-8 rounded-[2.5rem] border border-neutral-200 dark:border-neutral-800 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shadow-inner shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[9px] font-black uppercase tracking-wider border border-indigo-500/15">Super Admin</span>
                <span className="text-xs font-bold text-neutral-400">{currentUserEmail}</span>
              </div>
              <h2 className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight">
                Painel de Controle <span className="text-indigo-500">PRO</span>
              </h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                Monitore o crescimento da plataforma, crie planos e controle o acesso de clientes ativos.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2.5 text-neutral-500 hover:text-indigo-600 dark:text-neutral-400 dark:hover:text-indigo-400 bg-neutral-100 dark:bg-neutral-800 rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all flex items-center justify-center disabled:opacity-50 group active:scale-95 duration-200 shadow-sm"
              title="Atualizar dados gerais"
            >
              <RefreshCw className={cn("w-4 h-4 transition-transform duration-500 ease-out", isRefreshing ? "animate-spin" : "group-hover:rotate-180")} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
          {/* Left Tabs Group */}
          <div className="flex flex-wrap gap-1.5 bg-neutral-100 dark:bg-neutral-950 p-1.5 rounded-2xl border border-neutral-200/50 dark:border-neutral-850/80 w-fit">
            {(['dashboard', 'clients', 'agenda', 'plans'] as const).map(tab => {
              const config = TAB_CONFIG[tab]
              const Icon = config.icon
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 whitespace-nowrap",
                    activeTab === tab
                      ? "bg-white dark:bg-neutral-850 text-neutral-900 dark:text-white shadow-sm"
                      : "text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                  )}
                >
                  <Icon className={cn("w-4 h-4", config.iconColor)} />
                  <span>{config.label}</span>
                </button>
              )
            })}
          </div>

          {/* Right Tabs Group */}
          <div className="flex flex-wrap gap-1.5 bg-neutral-100 dark:bg-neutral-950 p-1.5 rounded-2xl border border-neutral-200/50 dark:border-neutral-850/80 w-fit">
            {(['community', 'metavoice', 'iclub', 'arquivos', 'releases'] as const).map(tab => {
              const config = TAB_CONFIG[tab]
              const Icon = config.icon
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 whitespace-nowrap",
                    activeTab === tab
                      ? "bg-white dark:bg-neutral-850 text-neutral-900 dark:text-white shadow-sm"
                      : "text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                  )}
                >
                  <Icon className={cn("w-4 h-4", config.iconColor)} />
                  <span>{config.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'community' && (
          <motion.div
            key="community"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="mt-6"
          >
            <CommunityHubView />
          </motion.div>
        )}

        {activeTab === 'metavoice' && (
          <motion.div
            key="metavoice"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            <MetaVoiceAdminView />
          </motion.div>
        )}

        {activeTab === 'arquivos' && (
          <motion.div
            key="arquivos"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            <CliFilesAdminView />
          </motion.div>
        )}

        {activeTab === 'plans' && (
          <motion.div
            key="plans"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            <PricingRulesAdmin />
          </motion.div>
        )}

        {activeTab === 'releases' && (
          <motion.div
            key="releases"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            <ReleaseAdminView />
          </motion.div>
        )}

        {activeTab === 'dashboard' && <DashboardTab hook={dashboardHook} initialWorkspaces={initialWorkspaces} clientProfiles={clientProfiles} mappedWorkspaces={mappedWorkspaces} />}
        {activeTab === 'clients' && <ClientsTab hook={clientsHook} />}
        {activeTab === 'agenda' && <AgendaTab hook={agendaHook} />}
        {activeTab === 'iclub' && <IClubTab hook={iclubHook} />}
      </AnimatePresence>
    </div>
  )
}
