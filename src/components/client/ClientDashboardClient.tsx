'use client'

import { useState, useMemo } from 'react'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Profile {
  id: string
  full_name: string | null
  email: string | null
  plan_id?: string | null
  subscription_status?: string | null
  subscription_cycle?: string | null
  subscription_expires_at?: string | null
  asaas_customer_id?: string | null
  asaas_subscription_id?: string | null
  is_super_admin?: boolean | null
}

interface Plan {
  id: string
  name: string
  licenses_count: number
  price: number
  price_monthly: number | null
  price_quarterly: number | null
  price_semiannually: number | null
  price_yearly: number | null
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
  plan_id: string | null
}

interface ClientDashboardClientProps {
  profile: Profile | null
  plan: Plan | null
  workspaces: any[]
  projects: any[]
  useCases: UseCase[]
  members: Member[]
  profiles: { id: string; full_name: string | null; email: string | null }[]
  payments: Payment[]
  activityLogs?: any[]
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

const TABS = [
  { id: 'dashboard', label: 'Dashboard BI', icon: BarChart3 },
  { id: 'productivity', label: 'Produtividade', icon: Activity },
  { id: 'subscription', label: 'Assinatura', icon: CreditCard },
  { id: 'cancel', label: 'Cancelamento', icon: XCircle },
] as const

type TabId = typeof TABS[number]['id']

export default function ClientDashboardClient({
  profile,
  plan,
  workspaces,
  projects,
  useCases,
  members,
  profiles,
  payments,
  activityLogs = [],
}: ClientDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')
  const [isCanceling, setIsCanceling] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [selectedLog, setSelectedLog] = useState<any>(null)
  const [localProfile, setLocalProfile] = useState(profile)
  
  // Filters for Productivity Tab
  const [prodFilterProject, setProdFilterProject] = useState<string>('all')
  const [prodFilterUser, setProdFilterUser] = useState<string>('all')
  const [prodFilterPeriod, setProdFilterPeriod] = useState<string>('all')

  const { toast } = useToast()
  const router = useRouter()

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
    // Count unique users across all workspaces the client owns (+1 for the owner)
    const uniqueUsers = new Set<string>()
    if (profile?.id) uniqueUsers.add(profile.id)
    members.forEach(m => uniqueUsers.add(m.user_id))
    return uniqueUsers.size
  }, [profile, members])

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
    if (!plan) return null
    switch (localProfile?.subscription_cycle) {
      case 'monthly': return plan.price_monthly ?? plan.price
      case 'quarterly': return plan.price_quarterly
      case 'semiannual': return plan.price_semiannually
      case 'yearly': return plan.price_yearly
      default: return plan.price_monthly ?? plan.price
    }
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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shadow-inner">
            <Gauge className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-neutral-900 dark:text-white">Central de Controle</h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
              Visão geral dos seus dados, assinatura e conta
            </p>
          </div>
        </div>
        {localProfile?.subscription_status && (
          <StatusBadge status={localProfile.subscription_status} />
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 p-1.5 bg-neutral-100 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            id={`client-tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200',
              activeTab === tab.id
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                : 'text-neutral-500 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            )}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:block">{tab.label}</span>
          </button>
        ))}
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

          {/* ── TAB: Dashboard BI ─────────────────────────────────────── */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8">

              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <LicenseGaugeCard
                  licensesUsed={licensesUsed}
                  licensesTotal={plan?.licenses_count ?? 0}
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
                              const wsMembers = members.filter(m => m.workspace_id === ws.id)
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
                                    <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200">{wsMembers.length + 1}</span>
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
              </div>

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
                  <div className="space-y-8">
                    {/* Resumo por Profissional */}
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

                    <div className="border-t border-neutral-100 dark:border-neutral-800 pt-8">
                      <div className="flex items-center gap-2 mb-6">
                        <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                          <Activity className="w-4 h-4" />
                        </div>
                        <h3 className="text-sm font-bold text-neutral-800 dark:text-white">Logs de Atividade Detalhados</h3>
                      </div>
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
                              
                              return (
                                <tr key={log.id} className="group hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                                  <td className="py-4 text-sm font-bold text-neutral-800 dark:text-neutral-200">
                                    {name}
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
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB: Assinatura ───────────────────────────────────────── */}
          {activeTab === 'subscription' && (
            <div className="space-y-8">

              {/* Plan Summary */}
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 md:p-8 shadow-sm">
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-6">Resumo da Assinatura</h3>

                {plan ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {/* Plan */}
                    <div className="p-5 bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-500/10 dark:to-indigo-500/5 rounded-2xl border border-indigo-100 dark:border-indigo-500/20">
                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Plano Atual</span>
                      <h4 className="text-xl font-black text-indigo-700 dark:text-indigo-300 mt-2">{plan.name}</h4>
                      <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1">
                        {getPlanPrice() !== null ? `${formatPrice(getPlanPrice()!)} / ${getCycleLabel(localProfile?.subscription_cycle).toLowerCase()}` : '—'}
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
              ) : !plan ? (
                /* No active plan */
                <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-8 text-center space-y-4">
                  <ShieldAlert className="w-10 h-10 text-neutral-300 dark:text-neutral-700 mx-auto" />
                  <p className="text-sm text-neutral-500">Nenhuma assinatura ativa para cancelar.</p>
                </div>
              ) : (
                /* Can cancel */
                <>
                  {/* What happens card */}
                  <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-8 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                        <XCircle className="w-5 h-5" />
                      </div>
                      <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Cancelar Renovação Automática</h3>
                    </div>

                    <div className="space-y-4 mb-8">
                      <div className="flex gap-3 items-start">
                        <div className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-[10px] font-black">1</span>
                        </div>
                        <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                          Ao cancelar, <strong>você não perderá acesso imediatamente</strong>. Seu workspace continuará ativo até o final do período já pago: <strong className="text-neutral-900 dark:text-white">{formatDate(localProfile?.subscription_expires_at)}</strong>.
                        </p>
                      </div>
                      <div className="flex gap-3 items-start">
                        <div className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-[10px] font-black">2</span>
                        </div>
                        <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                          Após essa data, o acesso aos recursos pagos será suspenso. Você e sua equipe não poderão criar nem visualizar projetos.
                        </p>
                      </div>
                      <div className="flex gap-3 items-start">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-[10px] font-black">3</span>
                        </div>
                        <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                          Seus dados ficam preservados. Caso mude de ideia, basta contratar um novo plano para reativar o acesso.
                        </p>
                      </div>
                    </div>

                    {/* Security note */}
                    <div className="p-4 bg-neutral-50 dark:bg-neutral-950 rounded-2xl border border-neutral-100 dark:border-neutral-800 flex items-start gap-3 mb-6">
                      <Shield className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                        As assinaturas são geridas com segurança via Asaas. O cancelamento é processado automaticamente e você receberá uma confirmação.
                      </p>
                    </div>

                    <div className="flex gap-4">
                      <button
                        onClick={() => setActiveTab('subscription')}
                        className="flex-1 px-4 py-3 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white text-sm font-bold rounded-2xl transition-colors"
                      >
                        Manter Assinatura
                      </button>
                      {canCancel && (
                        <button
                          id="client-cancel-subscription-btn"
                          onClick={() => setShowCancelModal(true)}
                          className="flex-1 px-4 py-3 bg-rose-500/10 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 dark:border-rose-500/30 dark:hover:border-rose-600 text-sm font-bold rounded-2xl transition-all"
                        >
                          Cancelar Renovação
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
        onClose={() => setSelectedLog(null)}
        title="Detalhes do Log"
        description="Eventos registrados nesta sessão"
        size="lg"
      >
        <div className="mt-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 overflow-x-auto max-h-[60vh] overflow-y-auto custom-scrollbar">
          <pre className="text-[10px] sm:text-xs text-neutral-800 dark:text-neutral-300 font-mono whitespace-pre-wrap">
            {selectedLog?.events ? JSON.stringify(selectedLog.events, null, 2) : 'Nenhum evento detalhado disponível.'}
          </pre>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={() => setSelectedLog(null)}
            className="px-6 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white text-xs font-bold rounded-xl transition-colors"
          >
            Fechar
          </button>
        </div>
      </Modal>
    </div>
  )
}
