'use client'

import { useState, useMemo, useEffect } from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { MetaVoiceView } from './MetaVoiceView'
import CommunityHubView from './CommunityHubView'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getIClubDashboardData, IClubRule, IClubReferral, IClubReward } from '@/app/actions/iclub'
import { CliFilesClientView } from './CliFilesClientView'
import { TeamDrawer } from '@/components/workspace/TeamDrawer'

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

// ─── Logic Type Labels ────────────────────────────────────────────────────────

const LOGIC_TYPE_LABELS: Record<string, string> = {
  pesquisa: 'Pesquisa',
  cadastro: 'Cadastro',
  pesquisa_cadastro: 'Pesquisa + Cadastro',
  master_detail: 'Mestre-Detalhe',
  analytics: 'Analytics',
  kanban: 'Kanban',
  timeline: 'Linha do Tempo',
  map: 'Mapa',
  gantt: 'Gantt',
  blueprint: 'Fluxograma',
  scheduler: 'Calendário',
  mapa_mental: 'Mapa Mental',
  personalizado: 'Personalizado',
  galeria: 'Galeria',
  agenda: 'Agenda',
  dashboard: 'Dashboard',
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function formatPrice(amount: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

function getCycleLabel(cycle?: string | null) {
  switch (cycle) {
    case 'monthly': return 'Mensal'
    case 'quarterly': return 'Trimestral'
    case 'semiannual': return 'Semestral'
    case 'yearly': return 'Anual'
    default: return '—'
  }
}

function getBillingTypeLabel(type?: string | null) {
  switch (type?.toUpperCase()) {
    case 'CREDIT_CARD': return 'Cartão de Crédito'
    case 'PIX': return 'Pix'
    case 'BOLETO': return 'Boleto'
    default: return type || 'Outro'
  }
}

function StatusBadge({ status }: { status?: string | null }) {
  const s = status?.toLowerCase()
  if (s === 'active' || s === 'received' || s === 'confirmed' || s === 'paid') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <CheckCircle className="w-3.5 h-3.5" /> Ativo
      </span>
    )
  }
  if (s === 'canceled') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
        <Clock className="w-3.5 h-3.5" /> Cancelado
      </span>
    )
  }
  if (s === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
        <Clock className="w-3.5 h-3.5 animate-pulse" /> Pendente
      </span>
    )
  }
  if (s === 'overdue' || s === 'failed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400">
        <AlertTriangle className="w-3.5 h-3.5" /> Atrasado
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
      {status || '—'}
    </span>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow">
      <div className={cn('w-11 h-11 rounded-2xl flex items-center justify-center', color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1">{label}</p>
        <p className="text-3xl font-black text-neutral-900 dark:text-white">{value}</p>
        {sub && <p className="text-xs text-neutral-500 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

// ─── License Gauge Card ───────────────────────────────────────────────────────

function LicenseGaugeCard({
  licensesUsed,
  licensesTotal,
}: {
  licensesUsed: number
  licensesTotal: number
}) {
  const pct = licensesTotal > 0 ? Math.min((licensesUsed / licensesTotal) * 100, 100) : 0
  const angle = -90 + (pct / 100) * 180

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 flex flex-col items-center justify-between shadow-sm hover:shadow-md transition-shadow h-full">
      <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-2">Licenças</p>

      <div className="relative w-full flex items-center justify-center my-1">
        <svg viewBox="0 0 100 55" className="w-32 h-auto overflow-visible">
          {/* Background track */}
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="8"
            strokeLinecap="round"
            className="stroke-neutral-100 dark:stroke-neutral-850"
          />
          {/* Active track */}
          <motion.path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke="url(#gauge-emerald-gradient)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray="125.66"
            initial={{ strokeDashoffset: 125.66 }}
            animate={{ strokeDashoffset: 125.66 - (pct / 100) * 125.66 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
          <defs>
            <linearGradient id="gauge-emerald-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#0D9488" />
            </linearGradient>
          </defs>

          {/* Value Text centered in the gauge, nestled inside the arc */}
          <text
            x="50"
            y="48"
            textAnchor="middle"
            className="fill-neutral-900 dark:fill-white font-sans font-black text-[16px] tracking-tight"
          >
            {licensesUsed}
            <tspan className="fill-neutral-400 dark:fill-neutral-500 font-medium text-[11px]"> / {licensesTotal || '—'}</tspan>
          </text>
        </svg>
      </div>

      <p className="text-xs text-neutral-500 text-center mt-2">Usuários ativos vs. contratadas</p>
    </div>
  )
}

// ─── Logic Type Doughnut Chart ────────────────────────────────────────────────

function LogicTypeDoughnutChart({ data }: { data: { label: string; count: number; color: string }[] }) {
  const chartData = data.map(d => ({
    name: d.label,
    value: d.count,
    color: d.color,
  }))

  const colorMap: Record<string, string> = {
    'bg-indigo-500': '#6366F1',
    'bg-emerald-500': '#10B981',
    'bg-amber-500': '#F59E0B',
    'bg-blue-500': '#3B82F6',
    'bg-rose-500': '#F43F5E',
    'bg-purple-500': '#8B5CF6',
    'bg-cyan-500': '#06B6D4',
    'bg-orange-500': '#F97316',
    'outros': '#9CA3AF',
  }

  return (
    <div className="w-full h-44 flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius="50%"
            outerRadius="72%"
            paddingAngle={4}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={colorMap[entry.color] || '#10B981'}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              borderRadius: '12px',
              border: 'none',
              boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
              backgroundColor: '#ffffff',
              fontSize: '11px',
              fontWeight: 'bold',
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            iconSize={6}
            wrapperStyle={{
              fontSize: '9px',
              fontWeight: 'bold',
              color: '#6B7280',
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Mini Bar Chart ───────────────────────────────────────────────────────────

function MiniBarChart({ data }: { data: { label: string; count: number; color: string }[] }) {
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div className="space-y-2">
      {data.map(item => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="text-xs text-neutral-500 dark:text-neutral-400 w-36 shrink-0 truncate">{item.label}</span>
          <div className="flex-1 bg-neutral-100 dark:bg-neutral-800 rounded-full h-2 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(item.count / max) * 100}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className={cn('h-2 rounded-full', item.color)}
            />
          </div>
          <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300 w-4 text-right shrink-0">{item.count}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

const CANCELLATION_REASONS = [
  { id: 'preco_alto', label: 'PREÇO MUITO ALTO' },
  { id: 'dificuldade_uso', label: 'DIFICULDADE DE USO' },
  { id: 'falta_recursos', label: 'FALTA DE RECURSOS / CONEXÕES' },
  { id: 'mudanca_estrategia', label: 'MUDANÇA DE ESTRATÉGIA / NÃO PRECISO' },
  { id: 'outro', label: 'OUTRO MOTIVO' },
] as const

const TABS = [
  { id: 'dashboard', label: 'Dashboard BI', icon: BarChart3 },
  { id: 'productivity', label: 'Produtividade', icon: Activity },
  { id: 'downloads', label: 'Central de Downloads', icon: Download },
  { id: 'community', label: 'MetaBuilders', icon: Users },
  { id: 'metavoice', label: 'MetaVoice', icon: Lightbulb },
  { id: 'iclub', label: 'iClub', icon: Zap },
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
  const [localProfile, setLocalProfile] = useState(profile)
  const isGuest = !localProfile?.is_super_admin && !localProfile?.subscription_licenses
  const [activeTab, setActiveTab] = useState<TabId>(isGuest ? 'metavoice' : 'dashboard')
  const [isCanceling, setIsCanceling] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [selectedLog, setSelectedLog] = useState<any>(null)
  const [modalTab, setModalTab] = useState<'visual' | 'raw'>('visual')
  const [copied, setCopied] = useState(false)
  const [isTeamDrawerOpen, setIsTeamDrawerOpen] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const tab = params.get('tab') as TabId
      if (tab && TABS.some(t => t.id === tab)) {
        if (!isGuest || tab === 'metavoice' || tab === 'community') {
          setActiveTab(tab)
        }
      }
    }
  }, [isGuest])

  useEffect(() => {
    if (isGuest && activeTab !== 'metavoice' && activeTab !== 'community') {
      setActiveTab('metavoice')
    }
  }, [isGuest, activeTab])

  // Real-time Asaas data
  const [asaasSubData, setAsaasSubData] = useState<{ creditCard: any; pendingInvoice: any } | null>(null)
  const [loadingAsaasData, setLoadingAsaasData] = useState(false)

  // iClub Dashboard Data State
  const [iclubData, setIclubData] = useState<{
    referralCode: string | null;
    rules: IClubRule[];
    referrals: IClubReferral[];
    rewards: IClubReward[];
  } | null>(null)
  const [loadingIClub, setLoadingIClub] = useState(false)

  const fetchIClubData = async () => {
    setLoadingIClub(true)
    const res = await getIClubDashboardData()
    if (res.success) {
      setIclubData({
        referralCode: res.referralCode || null,
        rules: res.rules || [],
        referrals: res.referrals || [],
        rewards: res.rewards || [],
      })
    } else {
      toast(res.error || 'Erro ao carregar dados do iClub.', 'error')
    }
    setLoadingIClub(false)
  }

  useEffect(() => {
    if (activeTab === 'iclub') {
      fetchIClubData()
    }
  }, [activeTab])

  // Plan modification state removed (moved to checkout)

  // Card update state
  const [showCardModal, setShowCardModal] = useState(false)
  const [isUpdatingCard, setIsUpdatingCard] = useState(false)
  const [cardForm, setCardForm] = useState({
    cardNumber: '',
    cardName: '',
    cardExpiry: '',
    cardCvv: '',
    billingName: localProfile?.full_name || '',
    billingCpfCnpj: '',
    billingEmail: localProfile?.email || '',
    phone: '',
    postalCode: '',
    addressNumber: ''
  })

  // Cancellation feedback states
  const [selectedReasons, setSelectedReasons] = useState<string[]>([])
  const [cancellationComment, setCancellationComment] = useState('')
  const [cancellationError, setCancellationError] = useState<string | null>(null)

  // Filters for Productivity Tab
  const [prodFilterProject, setProdFilterProject] = useState<string>('all')
  const [prodFilterUser, setProdFilterUser] = useState<string>('all')
  const [prodFilterPeriod, setProdFilterPeriod] = useState<string>('all')
  const [prodSubTab, setProdSubTab] = useState<'summary' | 'detailed'>('summary')

  const { toast } = useToast()
  const router = useRouter()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const refreshAllData = () => {
    setIsRefreshing(true)
    router.refresh()
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  // Fetch real-time data from Asaas (e.g. active credit card, pending invoices) when tab becomes active
  useEffect(() => {
    if (activeTab === 'subscription' && localProfile?.asaas_subscription_id) {
      setLoadingAsaasData(true)
      const supabase = createClient()
      supabase.functions.invoke('asaas-update-subscription', { method: 'GET' })
        .then(({ data, error }) => {
          if (data && !error) {
            setAsaasSubData(data)
          }
        })
        .catch(err => console.error('Erro ao consultar dados da assinatura:', err))
        .finally(() => setLoadingAsaasData(false))
    }
  }, [activeTab, localProfile?.asaas_subscription_id])


  const handleUpdateCard = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsUpdatingCard(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.functions.invoke('asaas-update-subscription', {
        body: {
          action: 'updateCard',
          ...cardForm
        }
      })
      if (error) throw error
      if (data?.success) {
        toast('Dados de pagamento atualizados com sucesso!', 'success')
        setShowCardModal(false)

        // Clear sensitive card details
        setCardForm(prev => ({
          ...prev,
          cardNumber: '',
          cardName: '',
          cardExpiry: '',
          cardCvv: ''
        }))

        // Update local profile card meta
        setLocalProfile(prev => prev ? {
          ...prev,
          card_brand: data.cardBrand,
          card_last_digits: data.cardLastDigits
        } : prev)

        // Reload real-time Asaas data
        if (localProfile?.asaas_subscription_id) {
          const { data: realTimeData } = await supabase.functions.invoke('asaas-update-subscription', { method: 'GET' })
          if (realTimeData) setAsaasSubData(realTimeData)
        }

        router.refresh()
      } else {
        throw new Error(data?.error || 'Erro ao atualizar dados do cartão.')
      }
    } catch (err: any) {
      toast(err.message || 'Erro ao processar cartão. Verifique os dados e tente novamente.', 'error')
    } finally {
      setIsUpdatingCard(false)
    }
  }

  const filteredActivityLogs = useMemo(() => {
    return activityLogs.filter(log => {
      if (prodFilterProject !== 'all' && log.project_id !== prodFilterProject) return false
      if (prodFilterUser !== 'all' && log.user_id !== prodFilterUser) return false
      if (prodFilterPeriod !== 'all') {
        const logDate = new Date(log.session_start)
        const now = new Date()
        const diffTime = Math.abs(now.getTime() - logDate.getTime())
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        if (prodFilterPeriod === '7d' && diffDays > 7) return false
        if (prodFilterPeriod === '30d' && diffDays > 30) return false
      }
      return true
    })
  }, [activityLogs, prodFilterProject, prodFilterUser, prodFilterPeriod])

  // ── Computed metrics ──────────────────────────────────────────────────────

  const licensesUsed = useMemo(() => {
    // Count unique users: Owner + unique guest user IDs
    const uniqueUsers = new Set<string>()
    if (profile?.id) uniqueUsers.add(profile.id)
    ownerGuests.forEach(g => uniqueUsers.add(g.user_id))
    return uniqueUsers.size
  }, [profile, ownerGuests])

  const projectsByWorkspace = useMemo(() => {
    return workspaces.map(ws => ({
      name: ws.name,
      count: projects.filter(p => p.workspace_id === ws.id).length,
    }))
  }, [workspaces, projects])

  const useCasesByProject = useMemo(() => {
    return projects.map(proj => ({
      name: proj.name,
      count: useCases.filter(uc => uc.project_id === proj.id).length,
    })).filter(p => p.count > 0)
  }, [projects, useCases])

  const useCasesByType = useMemo(() => {
    const counts: Record<string, number> = {}
    useCases.forEach(uc => {
      const key = uc.logic_type || 'outros'
      counts[key] = (counts[key] || 0) + 1
    })
    const colors = [
      'bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-blue-500',
      'bg-rose-500', 'bg-purple-500', 'bg-cyan-500', 'bg-orange-500',
    ]
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([key, count], i) => ({
        label: LOGIC_TYPE_LABELS[key] || key,
        count,
        color: colors[i % colors.length],
      }))
  }, [useCases])

  const lastSuccessfulPayment = useMemo(() => {
    return payments.find(p => {
      const s = p.status?.toLowerCase()
      return s === 'received' || s === 'confirmed' || s === 'active' || s === 'paid'
    })
  }, [payments])

  const getPlanPrice = () => {
    if (!rules || !localProfile?.subscription_licenses) return null

    let discountPercent = 0
    const tiers = [...(rules.volume_tiers || [])].sort((a, b) => b.min_licenses - a.min_licenses)
    for (const tier of tiers) {
      if (localProfile.subscription_licenses >= tier.min_licenses) {
        discountPercent = tier.discount_percent
        break
      }
    }
    
    let baseValue = rules.base_price * localProfile.subscription_licenses
    let valueWithVolumeDiscount = baseValue * (1 - discountPercent / 100)
    
    const cycle = localProfile.subscription_cycle || 'monthly'
    let cycleDiscount = 0
    if (cycle === 'quarterly') cycleDiscount = rules.cycle_discounts?.quarterly || 10
    if (cycle === 'semiannual') cycleDiscount = rules.cycle_discounts?.semiannual || 15
    if (cycle === 'yearly') cycleDiscount = rules.cycle_discounts?.yearly || 20
    
    let finalValue = valueWithVolumeDiscount * (1 - cycleDiscount / 100)
    
    if (cycle === 'quarterly') finalValue *= 3
    else if (cycle === 'semiannual') finalValue *= 6
    else if (cycle === 'yearly') finalValue *= 12
    
    return finalValue
  }

  const canCancel =
    localProfile?.subscription_status !== 'canceled' &&
    !!localProfile?.asaas_subscription_id

  // ── Cancel handler ────────────────────────────────────────────────────────

  const handleCancelSubscription = async () => {
    if (!workspaces[0]) return
    setIsCanceling(true)
    try {
      const supabase = createClient()

      // Save feedback in Supabase first
      const { error: dbError } = await supabase.from('cancellation_feedbacks').insert({
        user_id: localProfile?.id || null,
        workspace_id: workspaces[0].id,
        reasons: selectedReasons.map(r => {
          const found = CANCELLATION_REASONS.find(cr => cr.id === r)
          return found ? found.label : r
        }),
        comment: cancellationComment || null,
        subscription_id: localProfile?.asaas_subscription_id || null
      })

      if (dbError) {
        console.error('Erro ao salvar feedback de cancelamento:', dbError)
      }

      const { data, error } = await supabase.functions.invoke('asaas-cancel', {
        body: { workspaceId: workspaces[0].id },
      })
      if (error) throw error
      if (data?.success) {
        toast('Assinatura cancelada com sucesso.', 'success')
        setLocalProfile(prev => prev ? { ...prev, subscription_status: 'canceled' } : prev)
        setShowCancelModal(false)
        router.refresh()
      } else {
        throw new Error(data?.error || 'Erro desconhecido ao cancelar assinatura.')
      }
    } catch (err: any) {
      toast(err.message || 'Erro ao cancelar assinatura. Tente novamente.', 'error')
    } finally {
      setIsCanceling(false)
    }
  }

  const handleCloseLogModal = () => {
    setSelectedLog(null)
    setModalTab('visual')
    setCopied(false)
  }

  const handleCopyJson = (events: any) => {
    if (!events) return
    const text = JSON.stringify(events, null, 2)
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopied(true)
        toast('JSON copiado com sucesso!', 'success')
        setTimeout(() => setCopied(false), 2000)
      })
      .catch((err) => {
        toast('Erro ao copiar JSON.', 'error')
        console.error('Erro ao copiar:', err)
      })
  }

  const handleDownloadJson = (events: any) => {
    if (!events) return
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `session_log_${selectedLog?.id || 'export'}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getEventMeta = (action: string) => {
    const normalized = String(action || '').toUpperCase()
    switch (normalized) {
      case 'CONFIG_CHANGE':
        return {
          icon: Sliders,
          label: 'Configuração',
          color: {
            bg: 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/50',
            text: 'text-amber-600 dark:text-amber-400',
            badge: 'bg-amber-50/50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50 text-amber-750 dark:text-amber-300'
          }
        }
      case 'NAVIGATION':
        return {
          icon: Compass,
          label: 'Navegação',
          color: {
            bg: 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/50',
            text: 'text-blue-600 dark:text-blue-400',
            badge: 'bg-blue-50/50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/50 text-blue-750 dark:text-blue-300'
          }
        }
      case 'SQL_QUERY':
        return {
          icon: Database,
          label: 'Query SQL',
          color: {
            bg: 'bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/50',
            text: 'text-purple-600 dark:text-purple-400',
            badge: 'bg-purple-50/50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-900/50 text-purple-750 dark:text-purple-300'
          }
        }
      case 'CODE_GEN':
        return {
          icon: Code,
          label: 'Código',
          color: {
            bg: 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-250/50 dark:border-emerald-800/50',
            text: 'text-emerald-600 dark:text-emerald-400',
            badge: 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300'
          }
        }
      default:
        return {
          icon: Activity,
          label: 'Ação',
          color: {
            bg: 'bg-neutral-500/10 dark:bg-neutral-500/20 text-neutral-600 dark:text-neutral-400 border border-neutral-250/50 dark:border-neutral-850/50',
            text: 'text-neutral-600 dark:text-neutral-400',
            badge: 'bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-750 dark:text-neutral-300'
          }
        }
    }
  }

  const eventsArray = useMemo(() => {
    if (!selectedLog?.events) return []
    if (Array.isArray(selectedLog.events)) return selectedLog.events
    if (typeof selectedLog.events === 'string') {
      try {
        const parsed = JSON.parse(selectedLog.events)
        return Array.isArray(parsed) ? parsed : []
      } catch (e) {
        return []
      }
    }
    return []
  }, [selectedLog])

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
                {activeTab === 'community' ? 'MetaBuilders' : 'Sugestões & Ideias (MetaVoice)'}
              </h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                {activeTab === 'community' 
                  ? 'Conecte-se com outros Owners e Desenvolvedores' 
                  : 'Deixe sugestões ou vote nas ideias da comunidade para nos ajudar a melhorar o MetaBuilder PRO'
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
                <h1 className="text-2xl font-black text-neutral-900 dark:text-white">Painel de Controle</h1>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Visão geral dos seus dados, assinatura e conta
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-4 md:mt-0">
              {localProfile?.subscription_status && (
                <StatusBadge status={localProfile.subscription_status} />
              )}
              {!isGuest && (
                <button 
                  onClick={() => setIsTeamDrawerOpen(true)}
                  className="flex items-center justify-center gap-2 h-11 px-6 rounded-xl text-sm font-bold transition-all duration-200 whitespace-nowrap bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-700 shadow-sm"
                >
                  <Users className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                  <span>Gerenciar Equipe</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Tab Navigation */}
      <div className={cn("flex flex-col sm:flex-row gap-4 w-full", isGuest ? "sm:justify-end" : "sm:items-center sm:justify-between")}>
        {/* Left Tabs Group */}
        {!isGuest && (
          <div className="flex sm:grid sm:grid-cols-5 gap-2 p-1.5 bg-neutral-100 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 w-full xl:w-fit overflow-x-auto no-scrollbar">
            {TABS.filter(tab => tab.id !== 'iclub' && tab.id !== 'metavoice' && tab.id !== 'community').map(tab => (
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
                  tab.id === 'subscription' && "text-emerald-500 dark:text-emerald-400",
                  tab.id === 'cancel' && "text-rose-500 dark:text-rose-400"
                )} />
                <span className="hidden sm:block">{tab.label}</span>
              </button>
            ))}
          </div>
        )}

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
              <span>{tab.label}</span>
            </button>
          ))}
          </div>
        </div>
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
            <CliFilesClientView />
          )}

          {/* ── TAB: Dashboard BI ─────────────────────────────────────── */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              <div className="flex justify-end">
                <button
                  onClick={() => refreshAllData()}
                  disabled={isRefreshing}
                  title="Atualizar painel"
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
                  label="Workspaces"
                  value={workspaces.length}
                  sub="Ambientes criados"
                  icon={Building2}
                  color="bg-blue-500/10 text-blue-500"
                />
                <KpiCard
                  label="Projetos"
                  value={projects.length}
                  sub="Em todos os workspaces"
                  icon={FolderKanban}
                  color="bg-amber-500/10 text-amber-500"
                />
                <KpiCard
                  label="Casos de Uso"
                  value={useCases.length}
                  sub="Telas e funcionalidades"
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
                    <h3 className="text-sm font-bold text-neutral-800 dark:text-white">Projetos por Workspace</h3>
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
                    <p className="text-xs text-neutral-400 text-center py-6">Nenhum workspace com projetos</p>
                  )}
                </div>

                {/* Use Cases by Project */}
                <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                      <FolderKanban className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-neutral-800 dark:text-white">Casos de Uso por Projeto</h3>
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
                    <p className="text-xs text-neutral-400 text-center py-6">Nenhum caso de uso encontrado</p>
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
                      <h3 className="text-sm font-bold text-neutral-800 dark:text-white">Casos de Uso por Tipo</h3>
                    </div>
                    {useCasesByType.length > 0 ? (
                      <LogicTypeDoughnutChart data={useCasesByType} />
                    ) : (
                      <p className="text-xs text-neutral-400 text-center py-6">Nenhum caso de uso encontrado</p>
                    )}
                  </div>
                </div>

                {/* Workspaces Detail Table (2/3) */}
                {workspaces.length > 0 && (
                  <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm md:col-span-2 flex flex-col justify-between">
                    <div>
                      <div className="p-6 border-b border-neutral-100 dark:border-neutral-800">
                        <h3 className="text-sm font-bold text-neutral-800 dark:text-white">Detalhamento por Workspace</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/20">
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">Workspace</th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-500 text-center">Projetos</th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-500 text-center">Casos de Uso</th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-500 text-center">Usuários</th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">Criado em</th>
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
                              const globalGuests = ownerGuests?.filter(g => g.access_level === 'global') || []

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
          )}
          {/* ── TAB: Produtividade ─────────────────────────────────────── */}
          {activeTab === 'productivity' && (
            <div className="space-y-8">
              {/* Filtros de Produtividade */}
              <div className="flex flex-wrap items-center gap-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Filtros:</span>
                </div>
                <select
                  value={prodFilterProject}
                  onChange={(e) => setProdFilterProject(e.target.value)}
                  className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 outline-none focus:border-indigo-500"
                >
                  <option value="all">Todos os Projetos</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>

                <select
                  value={prodFilterUser}
                  onChange={(e) => setProdFilterUser(e.target.value)}
                  className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 outline-none focus:border-indigo-500"
                >
                  <option value="all">Todos os Profissionais</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name || p.email || 'Desconhecido'}</option>
                  ))}
                </select>

                <select
                  value={prodFilterPeriod}
                  onChange={(e) => setProdFilterPeriod(e.target.value)}
                  className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 outline-none focus:border-indigo-500"
                >
                  <option value="all">Todo o Período</option>
                  <option value="7d">Últimos 7 dias</option>
                  <option value="30d">Últimos 30 dias</option>
                </select>
                <div className="ml-auto">
                  <button
                    onClick={() => refreshAllData()}
                    disabled={isRefreshing}
                    title="Atualizar painel"
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
                  <span>Resumo por DEV</span>
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
                  <span>Detalhado por DEV</span>
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
                          label="Tempo Ativo Total"
                          value={`${Math.floor((filteredActivityLogs.reduce((acc, log) => acc + (log.active_time_seconds || 0), 0)) / 60)} min`}
                          sub="Tempo gasto construindo na plataforma"
                          icon={Clock}
                          color="bg-emerald-500/10 text-emerald-500"
                        />
                        <KpiCard
                          label="Ações Realizadas"
                          value={filteredActivityLogs.reduce((acc, log) => acc + (log.actions_count || 0), 0)}
                          sub="Interações com o Studio"
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
                          <h3 className="text-sm font-bold text-neutral-800 dark:text-white">Produtividade por Profissional</h3>
                        </div>

                        {filteredActivityLogs.length === 0 ? (
                          <p className="text-sm text-neutral-500 text-center py-10">Nenhum dado de produtividade disponível para os filtros selecionados.</p>
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
                              const name = profile?.full_name || profile?.email || 'Desenvolvedor'

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
                                      <span className="block text-[10px] text-neutral-500">Tempo Ativo</span>
                                      <span className="font-bold text-neutral-700 dark:text-neutral-300">{Math.floor(stats.time / 60)}m</span>
                                    </div>
                                    <div>
                                      <span className="block text-[10px] text-neutral-500">Ações</span>
                                      <span className="font-bold text-neutral-700 dark:text-neutral-300">{stats.actions}</span>
                                    </div>
                                    <div className="col-span-2 mt-1 pt-2 border-t border-neutral-200 dark:border-neutral-700">
                                      <span className="block text-[10px] text-neutral-500">Sessões</span>
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
                        <h3 className="text-sm font-bold text-neutral-800 dark:text-white">Logs de Atividade Detalhados</h3>
                      </div>

                      {filteredActivityLogs.length === 0 ? (
                        <p className="text-sm text-neutral-500 text-center py-10">Nenhum dado de produtividade disponível para os filtros selecionados.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="border-b border-neutral-100 dark:border-neutral-800">
                                <th className="pb-3 text-xs font-black uppercase tracking-widest text-neutral-400">Profissional</th>
                                <th className="pb-3 text-xs font-black uppercase tracking-widest text-neutral-400">Início da Sessão</th>
                                <th className="pb-3 text-xs font-black uppercase tracking-widest text-neutral-400">Tempo Ativo</th>
                                <th className="pb-3 text-xs font-black uppercase tracking-widest text-neutral-400">Ações</th>
                                <th className="pb-3 text-xs font-black uppercase tracking-widest text-neutral-400 text-right">Ação</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                              {filteredActivityLogs.map((log) => {
                                const profile = profiles.find(p => p.id === log.user_id)
                                const name = profile?.full_name || profile?.email || 'Desenvolvedor'
                                const useCase = useCases.find(uc => uc.id === log.ui_view_id)
                                const useCaseName = useCase ? useCase.name : 'Caso de Uso Removido/Desconhecido'

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
                                        Ver log detalhado
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
            </div>
          )}

          {/* ── TAB: iClub ────────────────────────────────────────────── */}
          {activeTab === 'iclub' && (
            <div className="space-y-8 animate-in fade-in-50 duration-200">
              {loadingIClub ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-neutral-500 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                  <span className="text-xs font-bold uppercase tracking-wider">Carregando painel do iClub...</span>
                </div>
              ) : iclubData ? (
                <div className="space-y-8">
                  {/* Banner Premium */}
                  <div className="relative overflow-hidden bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-950 text-white rounded-[2rem] p-8 shadow-lg border border-indigo-500/20">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

                    <div className="relative z-10 max-w-2xl space-y-4">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        <Zap className="w-3.5 h-3.5 text-indigo-400 animate-pulse" /> iClub MetaBuilder PRO
                      </span>
                      <h2 className="text-2xl md:text-3xl font-black tracking-tight">O Clube de Vantagens exclusivo para você crescer.</h2>
                      <p className="text-xs md:text-sm text-indigo-200 leading-relaxed max-w-xl">
                        Indique novos clientes e ganhe descontos acumulados na sua próxima fatura, ou adquira novas licenças e ganhe licenças inteiramente gratuitas!
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                        {iclubData.rules.map(rule => (
                          <div key={rule.id} className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-start gap-3">
                            <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-300">
                              <Zap className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-xs font-black text-white">{rule.name}</h4>
                              <p className="text-[10px] text-indigo-200/80 mt-1">
                                {rule.benefit_type === 'volume_license'
                                  ? `Ganha ${Number(rule.reward_value)} licença grátis a cada ${rule.target_count} contratadas.`
                                  : `Ganhe ${Number(rule.reward_value)}% de desconto vitalício a cada indicado ativo — enquanto ele for assinante, você desconta!`}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Referral Link & Quota Progress Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Link de Indicação */}
                    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
                            <Users className="w-4.5 h-4.5" />
                          </div>
                          <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Convite iClub</span>
                        </div>
                        <h3 className="text-lg font-black text-neutral-900 dark:text-white">Indique & Ganhe</h3>
                        <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed">
                          Copie o link abaixo e compartilhe. Quando seu indicado assinar qualquer plano, seu desconto de 5% será aplicado automaticamente — e <strong>se mantém vitalício enquanto ele continuar ativo como assinante!</strong>
                        </p>
                      </div>

                      <div className="mt-6 space-y-2">
                        <span className="text-[9px] font-black uppercase text-neutral-400 tracking-wider">Seu Link de Indicação</span>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            readOnly
                            value={typeof window !== 'undefined' ? `${window.location.origin}/?ref=${iclubData.referralCode}` : ''}
                            className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-[11px] font-mono text-neutral-700 dark:text-neutral-300 w-full focus:outline-none"
                          />
                          <button
                            onClick={() => {
                              const link = typeof window !== 'undefined' ? `${window.location.origin}/?ref=${iclubData.referralCode}` : '';
                              navigator.clipboard.writeText(link);
                              setCopied(true);
                              toast('Link de indicação copiado!', 'success');
                              setTimeout(() => setCopied(false), 2000);
                            }}
                            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center shrink-0"
                          >
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Progresso de Licenças por Volume */}
                    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                      {(() => {
                        const volumeRule = iclubData.rules.find(r => r.benefit_type === 'volume_license');
                        const target = volumeRule ? volumeRule.target_count : 12;
                        const rewardValue = volumeRule ? Math.round(Number(volumeRule.reward_value)) : 1;
                        const currentVal = localProfile?.subscription_licenses || 1;
                        const progress = Math.min((currentVal / target) * 100, 100);
                        const licensesRemaining = target - (currentVal % target);

                        return (
                          <>
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
                                  <Layers className="w-4.5 h-4.5" />
                                </div>
                                <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Volume de Licenças</span>
                              </div>
                              <h3 className="text-lg font-black text-neutral-900 dark:text-white">Licença Grátis por Volume</h3>
                              <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed">
                                A cada {target} licenças ativas contratadas, o iClub libera {rewardValue} {rewardValue === 1 ? 'licença extra totalmente gratuita' : 'licenças extras totalmente gratuitas'}.
                              </p>
                            </div>

                            <div className="mt-6 space-y-2.5">
                              <div className="flex justify-between text-xs font-bold">
                                <span className="text-neutral-500">Progresso</span>
                                <span className="text-neutral-900 dark:text-white">{currentVal} / {target} Licenças</span>
                              </div>
                              <div className="w-full bg-neutral-150 dark:bg-neutral-800 rounded-full h-2.5 overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${progress}%` }}
                                  transition={{ duration: 0.8, ease: 'easeOut' }}
                                  className="h-full bg-emerald-500 rounded-full"
                                />
                              </div>
                              <p className="text-[10px] text-neutral-400 font-bold">
                                {currentVal >= target
                                  ? `Você já atingiu a meta de volume! Recompensas ativas liberadas.`
                                  : `Falta(m) ${licensesRemaining} licença(s) para sua próxima recompensa.`}
                              </p>
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    {/* Desconto Acumulado */}
                    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                      {(() => {
                        const totalDiscount = iclubData.rewards
                          .filter(r => r.reward_type === 'percent_discount' && r.status === 'active')
                          .reduce((sum, r) => sum + Number(r.reward_value), 0);

                        return (
                          <>
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <div className="p-2 bg-purple-500/10 text-purple-500 rounded-xl">
                                  <TrendingUp className="w-4.5 h-4.5" />
                                </div>
                                <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Descontos Acumulados</span>
                              </div>
                              <h3 className="text-lg font-black text-neutral-900 dark:text-white">Faturamento iClub</h3>
                              <p className="text-xs text-neutral-550 mt-1.5 leading-relaxed">
                                Indicações que se tornarem assinantes concedem 5% de desconto de forma cumulativa na sua próxima fatura. O desconto é <strong>vitalício</strong>: enquanto o indicado permanecer assinante ativo, você continua descontando a cada renovação.
                              </p>
                            </div>

                            <div className="mt-6 space-y-2">
                              <span className="text-[9px] font-black uppercase text-neutral-400 tracking-wider">Desconto na Próxima Fatura</span>
                              <div className="p-3 bg-purple-550/10 rounded-2xl border border-purple-500/20 flex items-center justify-between">
                                <span className="text-2xl font-black text-purple-600 dark:text-purple-400">{totalDiscount}%</span>
                                <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">De Desconto</span>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* List of Referred Users & Rewards */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Indicações Table (7 cols) */}
                    <div className="lg:col-span-7 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="p-6 border-b border-neutral-100 dark:border-neutral-850 flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-bold text-neutral-800 dark:text-white font-black">Histórico de Indicações</h3>
                            <p className="text-[10px] text-neutral-400 mt-1">Acompanhe as pessoas que você convidou.</p>
                          </div>
                          <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-450">
                            {iclubData.referrals.length} Indicações
                          </span>
                        </div>

                        {iclubData.referrals.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left">
                              <thead>
                                <tr className="border-b border-neutral-100 dark:border-neutral-850 text-[10px] font-black uppercase text-neutral-400 tracking-wider bg-neutral-50/50 dark:bg-neutral-950/20">
                                  <th className="px-6 py-3">Convidado / Email</th>
                                  <th className="px-6 py-3">Data</th>
                                  <th className="px-6 py-3 text-right">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                                {iclubData.referrals.map(ref => (
                                  <tr key={ref.id} className="text-xs text-neutral-700 dark:text-neutral-350 hover:bg-neutral-50/30 dark:hover:bg-neutral-950/10">
                                    <td className="px-6 py-4.5">
                                      <div>
                                        <span className="font-bold text-neutral-900 dark:text-white">
                                          {ref.referred_name || ref.referred_email.split('@')[0]}
                                        </span>
                                        <span className="block text-[10px] text-neutral-450 mt-0.5">{ref.referred_email}</span>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4.5 text-neutral-450">
                                      {new Date(ref.created_at).toLocaleDateString('pt-BR')}
                                    </td>
                                    <td className="px-6 py-4.5 text-right">
                                      <span className={cn(
                                        "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                                        ref.status === 'subscribed' || ref.status === 'reward_applied'
                                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-450"
                                          : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                                      )}>
                                        {ref.status === 'subscribed' || ref.status === 'reward_applied' ? 'Assinante Ativo' : 'Cadastro Realizado'}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="p-8 text-center text-neutral-400 italic text-xs">
                            Você ainda não fez nenhuma indicação no iClub. Comece compartilhando seu link!
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Rewards History Timeline (5 cols) */}
                    <div className="lg:col-span-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm">
                      <div className="p-6 border-b border-neutral-100 dark:border-neutral-850">
                        <h3 className="text-sm font-bold text-neutral-800 dark:text-white font-black">Histórico de Recompensas</h3>
                        <p className="text-[10px] text-neutral-400 mt-1">Veja seus prêmios e bônus adquiridos.</p>
                      </div>

                      <div className="p-6 space-y-4 max-h-[300px] overflow-y-auto pr-2">
                        {iclubData.rewards.length > 0 ? (
                          iclubData.rewards.map(reward => (
                            <div key={reward.id} className="p-3.5 bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800 rounded-2xl flex items-center justify-between gap-3 text-xs">
                              <div className="space-y-1">
                                <span className="text-[9px] font-black uppercase text-indigo-500">
                                  {reward.reward_type === 'free_license' ? 'Licença Extra' : 'Desconto de Fatura'}
                                </span>
                                <p className="font-bold text-neutral-800 dark:text-neutral-200 leading-snug">
                                  {reward.notes || (reward.reward_type === 'free_license' ? 'Bônus de 1 licença extra' : `Desconto de ${Number(reward.reward_value)}%`)}
                                </p>
                                <span className="block text-[9px] text-neutral-400">
                                  Concedido em {new Date(reward.created_at).toLocaleDateString('pt-BR')}
                                </span>
                              </div>
                              <span className={cn(
                                "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest whitespace-nowrap",
                                reward.status === 'active'
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-450"
                                  : reward.status === 'applied'
                                    ? "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-450"
                                    : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
                              )}>
                                {reward.status === 'active' ? 'Ativo' : reward.status === 'applied' ? 'Consumido' : 'Expirado'}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="text-center text-neutral-400 italic text-xs py-8">
                            Nenhuma recompensa recebida ainda.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-neutral-400 italic bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl text-xs">
                  Não foi possível inicializar o painel do iClub.
                </div>
              )}
            </div>
          )}

          {/* ── TAB: Assinatura ───────────────────────────────────────── */}
          {activeTab === 'subscription' && (
            <div className="space-y-8">

              {/* Real-time Asaas data loading */}
              {loadingAsaasData && (
                <div className="flex items-center gap-3 p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl animate-pulse">
                  <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Verificando pagamentos e faturamento em tempo real...</span>
                </div>
              )}

              {/* Pending Invoice Display (PIX QR code / Copy PIX / Boleto) */}
              {asaasSubData?.pendingInvoice && (
                <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                      <h4 className="text-xs font-black text-amber-800 dark:text-amber-400 uppercase tracking-widest">Cobrança Pendente Encontrada</h4>
                    </div>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 max-w-xl">
                      Há um pagamento em aberto de <strong>{formatPrice(asaasSubData.pendingInvoice.value)}</strong> vencendo em <strong>{formatDate(asaasSubData.pendingInvoice.dueDate)}</strong>. Efetue o pagamento abaixo para evitar interrupções.
                    </p>

                    {/* If PIX */}
                    {asaasSubData.pendingInvoice.billingType === 'PIX' && asaasSubData.pendingInvoice.pixCopiaCola && (
                      <div className="flex flex-col gap-3 pt-2">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                          {asaasSubData.pendingInvoice.pixQrCode && (
                            <div className="bg-white p-2 rounded-2xl border border-neutral-200 w-fit shrink-0">
                              <img src={`data:image/png;base64,${asaasSubData.pendingInvoice.pixQrCode}`} alt="PIX QR Code" className="w-24 h-24" />
                            </div>
                          )}
                          <div className="flex-1 min-w-[200px] space-y-1.5">
                            <span className="text-[9px] font-black uppercase text-neutral-400 tracking-wider">Pix Copia e Cola</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                readOnly
                                value={asaasSubData.pendingInvoice.pixCopiaCola}
                                className="bg-neutral-100 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-700 dark:text-neutral-300 w-full font-mono focus:outline-none"
                              />
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(asaasSubData.pendingInvoice.pixCopiaCola);
                                  toast('Código PIX copiado!', 'success');
                                }}
                                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shrink-0 transition-colors"
                              >
                                Copiar
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* If Boleto */}
                    {asaasSubData.pendingInvoice.billingType === 'BOLETO' && (
                      <div className="flex flex-col gap-3 pt-2">
                        <div className="flex flex-wrap items-center gap-3">
                          {asaasSubData.pendingInvoice.bankSlipUrl && (
                            <a
                              href={asaasSubData.pendingInvoice.bankSlipUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-950 dark:bg-neutral-100 dark:hover:bg-white text-white dark:text-neutral-900 rounded-xl text-xs font-bold transition-colors"
                            >
                              Imprimir Boleto <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {asaasSubData.pendingInvoice.identificationField && (
                            <div className="flex-1 max-w-md">
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  readOnly
                                  value={asaasSubData.pendingInvoice.identificationField}
                                  className="bg-neutral-100 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-700 dark:text-neutral-300 w-full font-mono focus:outline-none"
                                />
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(asaasSubData.pendingInvoice.identificationField);
                                    toast('Linha digitável copiada!', 'success');
                                  }}
                                  className="px-3.5 py-2 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-xl text-xs font-bold shrink-0 transition-colors"
                                >
                                  Copiar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Option to pay invoice with card */}
                  <div className="shrink-0">
                    <button
                      onClick={() => {
                        setCardForm(prev => ({
                          ...prev,
                          billingEmail: localProfile?.email || '',
                          billingName: localProfile?.full_name || ''
                        }));
                        setShowCardModal(true);
                      }}
                      className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/10 transition-all flex items-center gap-2"
                    >
                      <CreditCard className="w-4 h-4" />
                      Pagar com Cartão
                    </button>
                  </div>
                </div>
              )}

              {/* Plan Summary & Card on file */}
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 md:p-8 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-neutral-100 dark:border-neutral-800 pb-5">
                  <div>
                    <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Resumo da Assinatura</h3>
                    <p className="text-xs text-neutral-500 mt-1">Status do plano ativo e ciclo contratado</p>
                  </div>

                  {/* Masked Card Details and Plan Update */}
                  {localProfile?.subscription_licenses && localProfile.subscription_licenses > 0 && (
                    <div className="shrink-0 flex flex-wrap items-center gap-3">
                      {localProfile?.card_brand && localProfile?.card_last_digits ? (
                        <div className="flex items-center gap-2.5 px-4 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 rounded-2xl text-xs">
                          <CreditCard className="w-4 h-4 text-indigo-500" />
                          <span className="font-bold text-neutral-700 dark:text-neutral-300 uppercase">
                            {localProfile.card_brand} •••• {localProfile.card_last_digits}
                          </span>
                          <button
                            onClick={() => {
                              setCardForm(prev => ({
                                ...prev,
                                billingEmail: localProfile?.email || '',
                                billingName: localProfile?.full_name || ''
                              }));
                              setShowCardModal(true);
                            }}
                            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline ml-1.5"
                          >
                            Alterar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setCardForm(prev => ({
                              ...prev,
                              billingEmail: localProfile?.email || '',
                              billingName: localProfile?.full_name || ''
                            }));
                            setShowCardModal(true);
                          }}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-850 dark:hover:bg-neutral-750 text-neutral-850 dark:text-white text-xs font-bold rounded-2xl border border-neutral-200 dark:border-neutral-750 transition-colors"
                        >
                          <CreditCard className="w-4 h-4 text-neutral-500" /> Adicionar Cartão
                        </button>
                      )}
                      
                      <button
                        onClick={() => router.push('/checkout?mode=upgrade')}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-2xl border border-indigo-500 transition-colors shadow-sm"
                      >
                        <Sliders className="w-4 h-4" /> Alterar Plano
                      </button>
                    </div>
                  )}
                </div>

                {localProfile?.subscription_licenses && localProfile.subscription_licenses > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {/* Plan */}
                    <div className="p-5 bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-500/10 dark:to-indigo-500/5 rounded-2xl border border-indigo-100 dark:border-indigo-500/20">
                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Licenças Ativas</span>
                      <h4 className="text-xl font-black text-indigo-700 dark:text-indigo-300 mt-2">{localProfile.subscription_licenses} Licenças</h4>
                      <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1">
                        Baseado em volume
                      </p>
                    </div>

                    {/* Cycle */}
                    <div className="p-5 bg-neutral-50 dark:bg-neutral-950 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                      <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Ciclo</span>
                      <h4 className="text-lg font-bold text-neutral-800 dark:text-neutral-200 mt-2">
                        {getCycleLabel(localProfile?.subscription_cycle)}
                      </h4>
                      <p className="text-xs text-neutral-400 mt-1">Renovação recorrente</p>
                    </div>

                    {/* Status */}
                    <div className="p-5 bg-neutral-50 dark:bg-neutral-950 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                      <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Status</span>
                      <div className="mt-3">
                        <StatusBadge status={localProfile?.subscription_status} />
                        {localProfile?.subscription_status === 'canceled' && (
                          <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-2 font-medium">
                            Acesso mantido até {formatDate(localProfile.subscription_expires_at)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Next Renewal */}
                    <div className="p-5 bg-neutral-50 dark:bg-neutral-950 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                      <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                        {localProfile?.subscription_status === 'canceled' ? 'Acesso Expira Em' : 'Próxima Renovação'}
                      </span>
                      <h4 className="text-lg font-bold text-neutral-800 dark:text-neutral-200 mt-2">
                        {formatDate(localProfile?.subscription_expires_at)}
                      </h4>
                      <p className="text-xs text-neutral-400 mt-1">Débito automático se ativo</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-10 text-center bg-neutral-50 dark:bg-neutral-950 rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-800">
                    <ShieldAlert className="w-8 h-8 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
                    <p className="text-sm font-bold text-neutral-600 dark:text-neutral-400">Nenhuma assinatura ativa encontrada.</p>
                    <p className="text-xs text-neutral-400 mt-1">Contrate um plano para usufruir de todos os recursos.</p>
                  </div>
                )}

                {/* Last payment info */}
                {lastSuccessfulPayment && (
                  <div className="mt-6 pt-6 border-t border-neutral-100 dark:border-neutral-800 flex flex-wrap gap-6 text-sm">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block mb-1">Último Pagamento</span>
                      <span className="font-bold text-neutral-900 dark:text-white">{formatPrice(lastSuccessfulPayment.amount)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block mb-1">Data</span>
                      <span className="font-bold text-neutral-900 dark:text-white">{formatDate(lastSuccessfulPayment.created_at)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block mb-1">Forma de Pagamento</span>
                      <span className="font-bold text-neutral-900 dark:text-white">{getBillingTypeLabel(lastSuccessfulPayment.billing_type)}</span>
                    </div>
                  </div>
                )}
              </div>



              {/* Payments History */}
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Histórico de Faturamento</h3>
                    <p className="text-xs text-neutral-500 mt-1">Seus recibos e histórico de transações</p>
                  </div>
                  <div className="px-3 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-xs font-bold rounded-full">
                    {payments.length} {payments.length === 1 ? 'transação' : 'transações'}
                  </div>
                </div>

                {payments.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/20">
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">Data</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">Ciclo</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">Valor</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">Método</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">Status</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-500 text-right">Comprovante</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                        {payments.map(p => (
                          <tr key={p.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-850/20 transition-colors">
                            <td className="px-6 py-4 text-sm text-neutral-800 dark:text-neutral-200 font-medium">{formatDate(p.created_at)}</td>
                            <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400">{getCycleLabel(p.cycle)}</td>
                            <td className="px-6 py-4 text-sm font-bold text-neutral-900 dark:text-white">{formatPrice(p.amount)}</td>
                            <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400">{getBillingTypeLabel(p.billing_type)}</td>
                            <td className="px-6 py-4"><StatusBadge status={p.status} /></td>
                            <td className="px-6 py-4 text-right">
                              {p.invoice_url ? (
                                <a
                                  href={p.invoice_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                                >
                                  Recibo <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                <span className="text-xs text-neutral-400 italic">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-12 text-center text-neutral-500">
                    <CreditCard className="w-8 h-8 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
                    <p className="text-sm font-medium">Nenhuma transação registrada.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB: Cancelamento ─────────────────────────────────────── */}
          {activeTab === 'cancel' && (
            <div className="max-w-2xl mx-auto space-y-6">

              {localProfile?.subscription_status === 'canceled' ? (
                /* Already canceled */
                <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-3xl p-8 text-center space-y-4">
                  <div className="w-14 h-14 bg-amber-100 dark:bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center mx-auto">
                    <Clock className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-neutral-900 dark:text-white">Renovação Automática Cancelada</h3>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2 leading-relaxed">
                      A renovação automática da sua assinatura já foi cancelada. Seu acesso permanece ativo até{' '}
                      <strong className="text-amber-600 dark:text-amber-400">{formatDate(localProfile?.subscription_expires_at)}</strong>.
                    </p>
                  </div>
                </div>
              ) : !(localProfile?.subscription_licenses && localProfile.subscription_licenses > 0) ? (
                /* No active plan */
                <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-8 text-center space-y-4">
                  <ShieldAlert className="w-10 h-10 text-neutral-300 dark:text-neutral-700 mx-auto" />
                  <p className="text-sm text-neutral-500">Nenhuma assinatura ativa para cancelar.</p>
                </div>
              ) : (
                /* Can cancel */
                <>
                  {/* Cancellation Form Card */}
                  <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-8 shadow-sm space-y-6">
                    <div className="text-center space-y-2 mb-6">
                      <div className="w-12 h-12 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-2">
                        <XCircle className="w-6 h-6" />
                      </div>
                      <h3 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">
                        DESEJA REALMENTE CANCELAR SUA ASSINATURA?
                      </h3>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-lg mx-auto leading-relaxed">
                        Ao cancelar, seu acesso continuará ativo até o final do período já pago ({formatDate(localProfile?.subscription_expires_at)}). Após essa data, o acesso aos recursos do workspace será suspenso, mas seus dados permanecerão preservados.
                      </p>
                    </div>

                    {/* Motivos Checklist */}
                    <div className="space-y-3">
                      <p className="text-[11px] font-black tracking-widest text-rose-500 uppercase">
                        Motivo do cancelamento?
                      </p>

                      <div className="grid grid-cols-1 gap-2.5">
                        {CANCELLATION_REASONS.map((reason) => {
                          const isSelected = selectedReasons.includes(reason.id)
                          return (
                            <button
                              key={reason.id}
                              type="button"
                              onClick={() => {
                                setCancellationError(null)
                                setSelectedReasons(prev =>
                                  prev.includes(reason.id)
                                    ? prev.filter(id => id !== reason.id)
                                    : [...prev, reason.id]
                                )
                              }}
                              className={cn(
                                'w-full flex items-center justify-between p-4 rounded-2xl text-left transition-all duration-200 border',
                                isSelected
                                  ? 'bg-rose-500/5 dark:bg-rose-500/10 border-rose-500 text-rose-600 dark:text-rose-400'
                                  : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900'
                              )}
                            >
                              <span className="text-xs font-bold tracking-wide">{reason.label}</span>
                              <div
                                className={cn(
                                  'w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all duration-200',
                                  isSelected
                                    ? 'border-rose-500 bg-rose-500 text-white'
                                    : 'border-neutral-300 dark:border-neutral-700 bg-transparent'
                                )}
                              >
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Textarea */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-black tracking-widest text-rose-500 uppercase leading-relaxed">
                        Nos conte um pouco mais sobre o motivo do seu cancelamento e como podemos melhorar nossos serviços
                      </p>
                      <textarea
                        value={cancellationComment}
                        onChange={(e) => setCancellationComment(e.target.value)}
                        placeholder="Escreva sua resposta aqui (opcional)..."
                        rows={4}
                        className="w-full rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 p-4 text-sm text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:border-rose-500 focus:outline-none transition-colors resize-none"
                      />
                    </div>

                    {cancellationError && (
                      <p className="text-xs font-bold text-rose-500 text-center">{cancellationError}</p>
                    )}

                    {/* Action buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-neutral-150 dark:border-neutral-800">
                      <button
                        onClick={() => {
                          setSelectedReasons([])
                          setCancellationComment('')
                          setCancellationError(null)
                          setActiveTab('subscription')
                        }}
                        className="flex-1 px-4 py-3 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white text-xs font-bold rounded-xl transition-colors order-2 sm:order-1"
                      >
                        Manter Assinatura
                      </button>
                      {canCancel && (
                        <button
                          id="client-cancel-subscription-btn"
                          onClick={() => {
                            if (selectedReasons.length === 0) {
                              setCancellationError('Por favor, selecione pelo menos um motivo de cancelamento.')
                              return
                            }
                            setShowCancelModal(true)
                          }}
                          className="flex-1 px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2 order-1 sm:order-2"
                        >
                          <Zap className="w-4 h-4 fill-white" />
                          Continuar Cancelamento
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

        </motion.div>
      </AnimatePresence>

      {/* Cancel Confirmation Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Confirmar Cancelamento"
        description="Tem certeza de que deseja cancelar a renovação automática da sua assinatura?"
        size="sm"
      >
        <div className="space-y-4 mt-4">
          <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
            Seu acesso permanecerá ativo até{' '}
            <strong className="text-neutral-900 dark:text-white">
              {formatDate(localProfile?.subscription_expires_at)}
            </strong>. Após esta data, o acesso será suspenso.
          </p>

          <div className="flex gap-3 pt-4 border-t border-neutral-100 dark:border-neutral-800">
            <button
              onClick={() => setShowCancelModal(false)}
              disabled={isCanceling}
              className="flex-1 px-4 py-3 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              Voltar
            </button>
            <button
              onClick={handleCancelSubscription}
              disabled={isCanceling}
              className="flex-1 px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors shadow-lg shadow-rose-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isCanceling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Cancelando...
                </>
              ) : (
                'Confirmar Cancelamento'
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Productivity Log Detail Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={handleCloseLogModal}
        title="Detalhes do Log de Atividade"
        description={selectedLog ? `Sessão iniciada em ${new Date(selectedLog.session_start).toLocaleString('pt-BR')}` : 'Eventos registrados nesta sessão'}
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
                <span>Linha do Tempo</span>
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
                <span>JSON Bruto</span>
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
                      <span className="text-emerald-600 dark:text-emerald-400">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar JSON</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleDownloadJson(selectedLog?.events)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-lg border border-indigo-100 dark:border-indigo-900/50 transition-colors duration-150"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar JSON</span>
                </button>
              </div>
            )}
          </div>

          {/* Modal Tab Content */}
          <div className="min-h-[300px] max-h-[55vh] overflow-y-auto custom-scrollbar pr-1">
            {modalTab === 'visual' ? (
              eventsArray.length === 0 ? (
                <p className="text-sm text-neutral-500 text-center py-12">Nenhum evento detalhado registrado nesta sessão.</p>
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
                              {event.detail || 'Sem descrição detalhada.'}
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
                  {selectedLog?.events ? JSON.stringify(selectedLog.events, null, 2) : 'Nenhum evento detalhado disponível.'}
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
              Fechar
            </button>
          </div>
        </div>
      </Modal>

      {/* Credit Card Update Modal */}
      <Modal
        isOpen={showCardModal}
        onClose={() => setShowCardModal(false)}
        title="Atualizar Cartão de Crédito"
        description="Os dados inseridos abaixo serão configurados para a renovação recorrente segura de sua assinatura."
        size="2xl"
      >
        <form onSubmit={handleUpdateCard} className="flex flex-col gap-6 mt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Card Information Column */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-500 border-b border-neutral-100 dark:border-neutral-800 pb-1.5">Dados do Cartão</h4>

              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-neutral-400">Número do Cartão</label>
                <input
                  type="text"
                  required
                  placeholder="0000 0000 0000 0000"
                  value={cardForm.cardNumber}
                  onChange={e => setCardForm(prev => ({ ...prev, cardNumber: e.target.value }))}
                  className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2.5 text-xs text-neutral-850 dark:text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-neutral-400">Nome impresso no Cartão</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: JOÃO A SILVA"
                  value={cardForm.cardName}
                  onChange={e => setCardForm(prev => ({ ...prev, cardName: e.target.value.toUpperCase() }))}
                  className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2.5 text-xs text-neutral-850 dark:text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-neutral-400">Validade (MM/AA)</label>
                  <input
                    type="text"
                    required
                    placeholder="12/30"
                    value={cardForm.cardExpiry}
                    onChange={e => setCardForm(prev => ({ ...prev, cardExpiry: e.target.value }))}
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2.5 text-xs text-neutral-850 dark:text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-neutral-400">CVV</label>
                  <input
                    type="text"
                    required
                    placeholder="123"
                    value={cardForm.cardCvv}
                    onChange={e => setCardForm(prev => ({ ...prev, cardCvv: e.target.value }))}
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2.5 text-xs text-neutral-850 dark:text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Cardholder Information Column */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-500 border-b border-neutral-100 dark:border-neutral-800 pb-1.5">Titular e Endereço</h4>

              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-neutral-400">Nome / Razão Social</label>
                <input
                  type="text"
                  required
                  placeholder="Nome do titular do cartão"
                  value={cardForm.billingName}
                  onChange={e => setCardForm(prev => ({ ...prev, billingName: e.target.value }))}
                  className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2.5 text-xs text-neutral-850 dark:text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-neutral-400">CPF / CNPJ</label>
                <input
                  type="text"
                  required
                  placeholder="000.000.000-00 ou CNPJ"
                  value={cardForm.billingCpfCnpj}
                  onChange={e => setCardForm(prev => ({ ...prev, billingCpfCnpj: e.target.value }))}
                  className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2.5 text-xs text-neutral-850 dark:text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-neutral-400">CEP</label>
                  <input
                    type="text"
                    required
                    placeholder="00000-000"
                    value={cardForm.postalCode}
                    onChange={e => setCardForm(prev => ({ ...prev, postalCode: e.target.value }))}
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2.5 text-xs text-neutral-850 dark:text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-neutral-400">Nº Residencial</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 45"
                    value={cardForm.addressNumber}
                    onChange={e => setCardForm(prev => ({ ...prev, addressNumber: e.target.value }))}
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2.5 text-xs text-neutral-850 dark:text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-neutral-400">E-mail de Faturamento</label>
                  <input
                    type="email"
                    required
                    placeholder="email@faturamento.com"
                    value={cardForm.billingEmail}
                    onChange={e => setCardForm(prev => ({ ...prev, billingEmail: e.target.value }))}
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2.5 text-xs text-neutral-850 dark:text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-neutral-400">Telefone</label>
                  <input
                    type="text"
                    placeholder="(00) 00000-0000"
                    value={cardForm.phone}
                    onChange={e => setCardForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2.5 text-xs text-neutral-850 dark:text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

          </div>

          <div className="flex gap-3 pt-4 border-t border-neutral-100 dark:border-neutral-850">
            <button
              type="button"
              onClick={() => setShowCardModal(false)}
              className="flex-1 px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-750 text-neutral-800 dark:text-neutral-200 text-xs font-bold rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isUpdatingCard}
              className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {isUpdatingCard ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processando...
                </>
              ) : (
                'Salvar Novo Cartão'
              )}
            </button>
          </div>
        </form>
      </Modal>

      <TeamDrawer 
        isOpen={isTeamDrawerOpen}
        onClose={() => setIsTeamDrawerOpen(false)}
        onRequestSubscriptionUpdate={() => setActiveTab('subscription')}
      />
    </div>
  )
}
