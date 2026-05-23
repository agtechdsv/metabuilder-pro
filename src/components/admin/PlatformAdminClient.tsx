'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingUp,
  Users,
  Building2,
  Activity,
  Plus,
  Pencil,
  Trash2,
  Lock,
  Unlock,
  Search,
  Check,
  X,
  CreditCard,
  Layers,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  AlertTriangle,
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import { savePlan, deletePlan, toggleWorkspaceBlock } from '@/app/actions/admin'
import { Modal } from '@/components/ui/Modal'

interface Plan {
  id: string
  name: string
  licenses_count: number
  price: number
  price_monthly?: number | null
  price_quarterly?: number | null
  price_semiannually?: number | null
  price_yearly?: number | null
  description: string | null
  features: string[]
  is_active: boolean
  created_at: string
}

interface Workspace {
  id: string
  name: string
  slug: string
  owner_id: string
  plan_id: string | null
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
}

interface Payment {
  id: string
  user_id: string
  workspace_id: string
  plan_id: string | null
  cycle: string
  amount: number
  status: string
  external_reference: string
  billing_type: string | null
  invoice_url: string | null
  created_at: string
}

interface PlatformAdminClientProps {
  initialPlans: Plan[]
  initialWorkspaces: Workspace[]
  profiles: Profile[]
  currentUserEmail: string
  payments: Payment[]
}

export default function PlatformAdminClient({
  initialPlans,
  initialWorkspaces,
  profiles,
  currentUserEmail,
  payments
}: PlatformAdminClientProps) {
  const { toast } = useToast()
  
  // State variables
  const [activeTab, setActiveTab] = useState<'dashboard' | 'plans' | 'clients'>('dashboard')
  const [plans, setPlans] = useState<Plan[]>(initialPlans)
  const [workspaces, setWorkspaces] = useState<Workspace[]>(initialWorkspaces)
  
  // Client Search & Filter States
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked' | 'registered'>('all')

  // Dashboard Filter States
  const [dashboardPeriod, setDashboardPeriod] = useState<'all' | 'today' | '7days' | '15days' | '30days' | 'custom'>('all')
  const [dashboardCustomStart, setDashboardCustomStart] = useState('')
  const [dashboardCustomEnd, setDashboardCustomEnd] = useState('')
  const [dashboardPlan, setDashboardPlan] = useState<string>('all')
  const [dashboardClient, setDashboardClient] = useState<string>('all')
  
  // Plan Modal States
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Partial<Plan> | null>(null)
  
  // Plan Form Fields
  const [planName, setPlanName] = useState('')
  const [planLicenses, setPlanLicenses] = useState(1)
  const [planPrice, setPlanPrice] = useState(0)
  const [planPriceMonthly, setPlanPriceMonthly] = useState<number | ''>('')
  const [planPriceQuarterly, setPlanPriceQuarterly] = useState<number | ''>('')
  const [planPriceSemiannually, setPlanPriceSemiannually] = useState<number | ''>('')
  const [planPriceYearly, setPlanPriceYearly] = useState<number | ''>('')
  const [planDesc, setPlanDesc] = useState('')
  const [planFeatures, setPlanFeatures] = useState<string[]>([])
  const [newFeatureText, setNewFeatureText] = useState('')
  const [planIsActive, setPlanIsActive] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
 
  // Custom Modal States for Actions
  const [isDeletePlanModalOpen, setIsDeletePlanModalOpen] = useState(false)
  const [planToDelete, setPlanToDelete] = useState<{ id: string, name: string } | null>(null)
  const [isDeletingPlan, setIsDeletingPlan] = useState(false)
 
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false)
  const [workspaceToBlock, setWorkspaceToBlock] = useState<{ id: string, isBlocked: boolean, name: string } | null>(null)
  const [isBlockingWorkspace, setIsBlockingWorkspace] = useState(false)
 
  // Map workspace with profile and plan
  const mappedWorkspaces = useMemo(() => {
    return workspaces.map(w => {
      const ownerProfile = profiles.find(p => p.id === w.owner_id)
      const workspacePlan = plans.find(p => p.id === w.plan_id)
      
      // Calculate monthly equivalent price for MRR
      let planPrice = 0
      if (workspacePlan) {
        // Find the latest successful payment for this workspace
        const wPayments = payments.filter(p => 
          p.workspace_id === w.id && 
          p.plan_id === w.plan_id &&
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
            case 'monthly':
              planPrice = amount
              break
            case 'quarterly':
              planPrice = amount / 3
              break
            case 'semiannual':
            case 'semiannually':
              planPrice = amount / 6
              break
            case 'yearly':
              planPrice = amount / 12
              break
            default:
              planPrice = amount
          }
        } else {
          // Fallback to the plan's current configurations if no successful payments are recorded yet
          const basePrice = workspacePlan.price
          switch (w.subscription_cycle) {
            case 'monthly':
              planPrice = workspacePlan.price_monthly ?? basePrice
              break
            case 'quarterly':
              planPrice = (workspacePlan.price_quarterly ?? (basePrice * 3)) / 3
              break
            case 'semiannual':
              planPrice = (workspacePlan.price_semiannually ?? (basePrice * 6)) / 6
              break
            case 'yearly':
              planPrice = (workspacePlan.price_yearly ?? (basePrice * 12)) / 12
              break
            default:
              planPrice = basePrice
          }
        }
      }

      return {
        ...w,
        ownerName: ownerProfile?.full_name || 'Sem nome',
        ownerEmail: ownerProfile?.email || 'Sem e-mail',
        ownerIsSuperAdmin: ownerProfile?.is_super_admin || false,
        planName: workspacePlan?.name || 'Gratuito / Nenhum',
        planPrice,
        planLicenses: workspacePlan?.licenses_count || 0
      }
    })
  }, [workspaces, profiles, plans, payments])

  // Filtered workspaces and payments for dashboard calculations
  const filteredDashboardData = useMemo(() => {
    // 1. Get client-only workspaces (exclude super admins)
    const customerWorkspaces = mappedWorkspaces.filter(w => !w.ownerIsSuperAdmin)

    // Helper for period check
    const isDateInPeriod = (dateStr: string) => {
      if (dashboardPeriod === 'all') return true
      const d = new Date(dateStr)
      const now = new Date()
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      
      if (dashboardPeriod === 'today') {
        return d >= startOfToday
      }
      if (dashboardPeriod === '7days') {
        const limit = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000)
        return d >= limit
      }
      if (dashboardPeriod === '15days') {
        const limit = new Date(startOfToday.getTime() - 14 * 24 * 60 * 60 * 1000)
        return d >= limit
      }
      if (dashboardPeriod === '30days') {
        const limit = new Date(startOfToday.getTime() - 29 * 24 * 60 * 60 * 1000)
        return d >= limit
      }
      if (dashboardPeriod === 'custom') {
        if (!dashboardCustomStart) return true
        const start = new Date(dashboardCustomStart + 'T00:00:00')
        if (d < start) return false
        if (dashboardCustomEnd) {
          const end = new Date(dashboardCustomEnd + 'T23:59:59')
          if (d > end) return false
        }
        return true
      }
      return true
    }

    // 2. Filter Workspaces
    const workspacesFiltered = customerWorkspaces.filter(w => {
      // Filter by period ( adesão / workspace created_at )
      if (!isDateInPeriod(w.created_at)) return false

      // Filter by plan
      if (dashboardPlan !== 'all') {
        if (dashboardPlan === 'free') {
          if (w.plan_id) return false
        } else {
          if (w.plan_id !== dashboardPlan) return false
        }
      }

      // Filter by client
      if (dashboardClient !== 'all' && w.id !== dashboardClient) {
        return false
      }

      return true
    })

    // 3. Filter Payments
    const paymentsFiltered = payments.filter(p => {
      // Filter by period ( payment created_at )
      if (!isDateInPeriod(p.created_at)) return false

      // Filter by plan
      if (dashboardPlan !== 'all') {
        if (dashboardPlan === 'free') {
          if (p.plan_id) return false
        } else {
          if (p.plan_id !== dashboardPlan) return false
        }
      }

      // Filter by client
      if (dashboardClient !== 'all' && p.workspace_id !== dashboardClient) {
        return false
      }

      return true
    })

    return {
      workspaces: workspacesFiltered,
      payments: paymentsFiltered
    }
  }, [mappedWorkspaces, payments, dashboardPeriod, dashboardCustomStart, dashboardCustomEnd, dashboardPlan, dashboardClient])

  // BI Metric Calculations
  const metrics = useMemo(() => {
    const { workspaces: filteredWorkspaces, payments: filteredPayments } = filteredDashboardData
    
    // Na nova arquitetura, os "Clientes" são os Perfis (Profiles) que não são Super Admins.
    const customerProfiles = profiles.filter(p => !p.is_super_admin)
    const totalClients = customerProfiles.length

    // Usuários ativos agora pode contar todos os profiles (ou apenas donos, dependendo da definição. Vamos manter todos não-super admins)
    const totalUsers = customerProfiles.length
    
    // MRR: Soma do valor mensal das assinaturas ativas dos profiles (ou workspaces ativos atrelados aos planos)
    const activeMRR = filteredWorkspaces
      .filter(w => !w.is_blocked && w.plan_id)
      .reduce((acc, w) => acc + Number(w.planPrice), 0)

    // Faturamento (Revenue): Sum of successful payments
    const faturamento = filteredPayments
      .filter(p => {
        const s = p.status?.toLowerCase()
        return s === 'received' || s === 'confirmed' || s === 'active' || s === 'paid'
      })
      .reduce((acc, p) => acc + Number(p.amount), 0)

    // Taxa de Conversão: Quantos clientes (Profiles) possuem um plano ativo
    // (Como plan_id ainda não está no objeto profile que vem do banco para o frontend aqui, 
    // podemos usar a quantidade de clientes que têm algum workspace com plan_id válido, ou idealmente o profile.plan_id)
    // Para simplificar e manter a precisão com o que temos hoje no frontend:
    const clientsWithPlan = new Set(filteredWorkspaces.filter(w => w.plan_id).map(w => w.owner_id)).size
    const conversionRate = totalClients > 0 ? (clientsWithPlan / totalClients) * 100 : 0

    return {
      activeMRR,
      faturamento,
      totalClients,
      totalUsers,
      conversionRate
    }
  }, [filteredDashboardData, profiles])

  // Filtered Workspaces for client list
  const filteredWorkspaces = useMemo(() => {
    return mappedWorkspaces.filter(w => {
      // Exclude workspaces owned by super admins from client list
      if (w.ownerIsSuperAdmin) return false

      const matchesSearch = 
        w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.ownerEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.slug.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesStatus = 
        statusFilter === 'all' ||
        (statusFilter === 'active' && !w.is_blocked && w.plan_id) ||
        (statusFilter === 'blocked' && w.is_blocked) ||
        (statusFilter === 'registered' && !w.plan_id)

      return matchesSearch && matchesStatus
    })
  }, [mappedWorkspaces, searchQuery, statusFilter])

  // Open Plan Modal for edit/create
  const handleOpenPlanModal = (planToEdit?: Plan) => {
    if (planToEdit) {
      setEditingPlan(planToEdit)
      setPlanName(planToEdit.name)
      setPlanLicenses(planToEdit.licenses_count)
      setPlanPrice(planToEdit.price)
      setPlanPriceMonthly(planToEdit.price_monthly ?? planToEdit.price)
      setPlanPriceQuarterly(planToEdit.price_quarterly ?? '')
      setPlanPriceSemiannually(planToEdit.price_semiannually ?? '')
      setPlanPriceYearly(planToEdit.price_yearly ?? '')
      setPlanDesc(planToEdit.description || '')
      setPlanFeatures(planToEdit.features || [])
      setPlanIsActive(planToEdit.is_active)
    } else {
      setEditingPlan(null)
      setPlanName('')
      setPlanLicenses(1)
      setPlanPrice(0)
      setPlanPriceMonthly('')
      setPlanPriceQuarterly('')
      setPlanPriceSemiannually('')
      setPlanPriceYearly('')
      setPlanDesc('')
      setPlanFeatures([])
      setPlanIsActive(true)
    }
    setIsPlanModalOpen(true)
  }

  // Save/Create Plan Handler
  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!planName) {
      toast('Nome do plano é obrigatório', 'info')
      return
    }
    
    setIsSaving(true)
    const result = await savePlan({
      id: editingPlan?.id,
      name: planName,
      licenses_count: planLicenses,
      price: planPriceMonthly !== '' ? Number(planPriceMonthly) : planPrice,
      price_monthly: planPriceMonthly !== '' ? Number(planPriceMonthly) : undefined,
      price_quarterly: planPriceQuarterly !== '' ? Number(planPriceQuarterly) : undefined,
      price_semiannually: planPriceSemiannually !== '' ? Number(planPriceSemiannually) : undefined,
      price_yearly: planPriceYearly !== '' ? Number(planPriceYearly) : undefined,
      description: planDesc,
      features: planFeatures,
      is_active: planIsActive
    })

    setIsSaving(false)

    if (result.success) {
      toast(editingPlan ? 'Plano atualizado com sucesso!' : 'Novo plano criado com sucesso!', 'success')
      setIsPlanModalOpen(false)
      
      // Update local plans state dynamically
      if (editingPlan?.id) {
        setPlans(prev => prev.map(p => p.id === editingPlan.id ? {
          ...p,
          name: planName,
          licenses_count: planLicenses,
          price: planPriceMonthly !== '' ? Number(planPriceMonthly) : planPrice,
          price_monthly: planPriceMonthly !== '' ? Number(planPriceMonthly) : undefined,
          price_quarterly: planPriceQuarterly !== '' ? Number(planPriceQuarterly) : undefined,
          price_semiannually: planPriceSemiannually !== '' ? Number(planPriceSemiannually) : undefined,
          price_yearly: planPriceYearly !== '' ? Number(planPriceYearly) : undefined,
          description: planDesc,
          features: planFeatures,
          is_active: planIsActive
        } : p))
      } else {
        // Fetch/Reload from database or refresh page is handled, but updating local helps instant state
        window.location.reload()
      }
    } else {
      toast(result.error || 'Erro ao salvar o plano', 'error')
    }
  }

  // Delete Plan Handler (Trigger Modal)
  const handleDeletePlan = (planId: string, name: string) => {
    setPlanToDelete({ id: planId, name })
    setIsDeletePlanModalOpen(true)
  }

  // Delete Plan Action (Confirm from Modal)
  const handleConfirmDeletePlan = async () => {
    if (!planToDelete) return
    setIsDeletingPlan(true)
    const result = await deletePlan(planToDelete.id)
    setIsDeletingPlan(false)
    if (result.success) {
      toast(`Plano "${planToDelete.name}" deletado com sucesso.`, 'success')
      setPlans(prev => prev.filter(p => p.id !== planToDelete.id))
      setIsDeletePlanModalOpen(false)
      setPlanToDelete(null)
    } else {
      toast(result.error || 'Erro ao deletar o plano.', 'error')
    }
  }

  // Toggle Workspace Block Handler (Trigger Modal)
  const handleToggleBlock = (workspaceId: string, isBlocked: boolean, wsName: string) => {
    setWorkspaceToBlock({ id: workspaceId, isBlocked, name: wsName })
    setIsBlockModalOpen(true)
  }

  // Toggle Workspace Block Action (Confirm from Modal)
  const handleConfirmToggleBlock = async () => {
    if (!workspaceToBlock) return
    setIsBlockingWorkspace(true)
    const actionLabel = workspaceToBlock.isBlocked ? 'bloquear' : 'desbloquear'
    const result = await toggleWorkspaceBlock(workspaceToBlock.id, workspaceToBlock.isBlocked)
    setIsBlockingWorkspace(false)
    if (result.success) {
      toast(`Workspace "${workspaceToBlock.name}" foi ${workspaceToBlock.isBlocked ? 'bloqueado' : 'desbloqueado'} com sucesso!`, 'success')
      setWorkspaces(prev => prev.map(w => w.id === workspaceToBlock.id ? {
        ...w,
        is_blocked: workspaceToBlock.isBlocked,
        subscription_status: workspaceToBlock.isBlocked ? 'blocked' : 'active'
      } : w))
      setIsBlockModalOpen(false)
      setWorkspaceToBlock(null)
    } else {
      toast(result.error || `Erro ao ${actionLabel} o workspace.`, 'error')
    }
  }

  // Feature Array Handlers
  const addFeature = () => {
    if (newFeatureText.trim()) {
      setPlanFeatures(prev => [...prev, newFeatureText.trim()])
      setNewFeatureText('')
    }
  }

  const removeFeature = (idx: number) => {
    setPlanFeatures(prev => prev.filter((_, i) => i !== idx))
  }

  // Render Plan Distribution Custom SVG Chart
  const renderPlanChart = () => {
    const { workspaces: filteredWorkspaces } = filteredDashboardData
    const plansWithWorkspaces = plans.map(p => {
      const count = filteredWorkspaces.filter(w => w.plan_id === p.id && !w.is_blocked).length
      return {
        name: p.name,
        count
      }
    })

    const maxCount = Math.max(...plansWithWorkspaces.map(p => p.count), 1)

    return (
      <div className="bg-white dark:bg-neutral-900/40 p-6 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col justify-between h-[300px]">
        <div>
          <h4 className="text-xs font-black uppercase text-neutral-400 tracking-wider mb-4">Distribuição de Planos (Clientes Ativos)</h4>
        </div>
        <div className="flex items-end justify-around h-48 px-4 border-b border-l border-neutral-200 dark:border-neutral-800/80 pt-4">
          {plansWithWorkspaces.map((p, idx) => {
            const pct = (p.count / maxCount) * 100
            return (
              <div key={idx} className="flex flex-col items-center gap-2 w-16 group">
                <div className="h-36 w-8 flex items-end justify-center relative">
                  <div className="relative w-8 bg-gradient-to-t from-indigo-600 to-indigo-400 dark:from-indigo-500 dark:to-purple-500 rounded-t-lg transition-all duration-500" style={{ height: `${Math.max(pct, 5)}%` }}>
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-neutral-900 dark:bg-neutral-800 text-white text-[9px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {p.count}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 truncate max-w-full">{p.name}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-10">
      
      {/* Admin Panel Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-neutral-900/40 p-8 rounded-[2.5rem] border border-neutral-200 dark:border-neutral-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 rounded bg-indigo-500 text-white text-[9px] font-black uppercase tracking-wider">Super Admin</span>
            <span className="text-xs font-bold text-neutral-400">{currentUserEmail}</span>
          </div>
          <h2 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
            Central de Controle <span className="text-indigo-500">PRO</span>
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Monitore o crescimento da plataforma, crie planos e controle o acesso de clientes ativos.
          </p>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex gap-1.5 bg-neutral-100 dark:bg-neutral-950 p-1.5 rounded-[1.5rem] border border-neutral-200/50 dark:border-neutral-850">
          {(['dashboard', 'plans', 'clients'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                activeTab === tab
                  ? "bg-white dark:bg-neutral-850 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              )}
            >
              {tab === 'dashboard' ? 'Dashboard BI' : tab === 'plans' ? 'Cadastro de Planos' : 'Gestão de Clientes'}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'dashboard' && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            {/* Dashboard Filters */}
            <div className="bg-white dark:bg-neutral-900/40 p-6 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
              <div className="flex flex-wrap items-end gap-4">
                {/* Período */}
                <div className="flex-1 min-w-[200px] space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Período</label>
                  <select
                    value={dashboardPeriod}
                    onChange={(e) => setDashboardPeriod(e.target.value as any)}
                    className="w-full h-10 px-3.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 text-neutral-850 dark:text-neutral-200"
                  >
                    <option value="all">Todos os períodos</option>
                    <option value="today">Hoje</option>
                    <option value="7days">Últimos 7 Dias</option>
                    <option value="15days">Últimos 15 Dias</option>
                    <option value="30days">Últimos 30 Dias</option>
                    <option value="custom">Personalizado</option>
                  </select>
                </div>

                {/* Planos */}
                <div className="flex-1 min-w-[200px] space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Planos</label>
                  <select
                    value={dashboardPlan}
                    onChange={(e) => setDashboardPlan(e.target.value)}
                    className="w-full h-10 px-3.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 text-neutral-850 dark:text-neutral-200"
                  >
                    <option value="all">Todos os Planos</option>
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                    <option value="free">Gratuito / Sem Plano</option>
                  </select>
                </div>

                {/* Clientes */}
                <div className="flex-1 min-w-[200px] space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Clientes</label>
                  <select
                    value={dashboardClient}
                    onChange={(e) => setDashboardClient(e.target.value)}
                    className="w-full h-10 px-3.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 text-neutral-850 dark:text-neutral-200"
                  >
                    <option value="all">Todos os Clientes</option>
                    {initialWorkspaces
                      .filter(w => {
                        const ownerProfile = profiles.find(p => p.id === w.owner_id)
                        return !ownerProfile?.is_super_admin
                      })
                      .map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Custom Date Pickers */}
              {dashboardPeriod === 'custom' && (
                <div className="flex flex-wrap gap-4 pt-2 border-t border-neutral-100 dark:border-neutral-850/60 animate-in fade-in duration-300">
                  <div className="w-[180px] space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Data de Início</label>
                    <input
                      type="date"
                      value={dashboardCustomStart}
                      onChange={(e) => setDashboardCustomStart(e.target.value)}
                      className="w-full h-10 px-3.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 text-neutral-850 dark:text-neutral-200"
                    />
                  </div>
                  <div className="w-[180px] space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Data de Fim (Opcional)</label>
                    <input
                      type="date"
                      value={dashboardCustomEnd}
                      onChange={(e) => setDashboardCustomEnd(e.target.value)}
                      className="w-full h-10 px-3.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 text-neutral-850 dark:text-neutral-200"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
              
              {/* Card 0: Faturamento */}
              <div className="relative bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-850 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full pointer-events-none"></div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Faturamento (Caixa)</span>
                  <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl">
                    <CreditCard className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4">
                  <h3 className="text-3xl font-black text-neutral-900 dark:text-white">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.faturamento)}
                  </h3>
                  <p className="text-[10px] font-bold text-neutral-400 mt-1">
                    Total recebido no período
                  </p>
                </div>
              </div>

              {/* Card 1: MRR */}
              <div className="relative bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-850 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-bl-full pointer-events-none"></div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Recorrência Mensal (MRR)</span>
                  <div className="p-2.5 bg-rose-500/10 text-rose-500 rounded-xl">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4">
                  <h3 className="text-3xl font-black text-neutral-900 dark:text-white">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.activeMRR)}
                  </h3>
                  <p className="text-[10px] font-bold text-emerald-500 flex items-center gap-1 mt-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Calculado a partir de planos ativos</span>
                  </p>
                </div>
              </div>

              {/* Card 2: Clientes */}
              <div className="relative bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-850 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full pointer-events-none"></div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Total de Clientes</span>
                  <div className="p-2.5 bg-indigo-500/10 text-indigo-500 rounded-xl">
                    <Building2 className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4">
                  <h3 className="text-3xl font-black text-neutral-900 dark:text-white">
                    {metrics.totalClients}
                  </h3>
                  <p className="text-[10px] font-bold text-neutral-400 mt-1">
                    Workspaces/Empresas registradas
                  </p>
                </div>
              </div>

              {/* Card 3: Active Users */}
              <div className="relative bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-850 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-full pointer-events-none"></div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Usuários Ativos</span>
                  <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4">
                  <h3 className="text-3xl font-black text-neutral-900 dark:text-white">
                    {metrics.totalUsers}
                  </h3>
                  <p className="text-[10px] font-bold text-neutral-400 mt-1">
                    Usuários cadastrados nos profiles
                  </p>
                </div>
              </div>

              {/* Card 4: Conversion Rate */}
              <div className="relative bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-850 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 rounded-bl-full pointer-events-none"></div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Taxa de Conversão</span>
                  <div className="p-2.5 bg-violet-500/10 text-violet-500 rounded-xl">
                    <Activity className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4">
                  <h3 className="text-3xl font-black text-neutral-900 dark:text-white">
                    {metrics.conversionRate.toFixed(1)}%
                  </h3>
                  <p className="text-[10px] font-bold text-neutral-400 mt-1">
                    Workspaces convertidos para planos pagos
                  </p>
                </div>
              </div>

            </div>

            {/* Visual BI Chart Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* SVG Plan Chart */}
              <div className="lg:col-span-2">
                {renderPlanChart()}
              </div>

              {/* Quick Platform Security Health Card */}
              <div className="bg-white dark:bg-neutral-900/40 p-6 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col justify-between h-[300px]">
                <div>
                  <h4 className="text-xs font-black uppercase text-neutral-400 tracking-wider mb-2">Segurança & Conexões</h4>
                  <p className="text-[10px] text-neutral-400 font-medium">Visualização rápida de integridade da infraestrutura.</p>
                </div>
                
                <div className="space-y-4 my-2">
                  <div className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-950/60 rounded-2xl border border-neutral-100 dark:border-neutral-850">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                      <span className="text-[11px] font-bold dark:text-white">Criptografia Base de Dados</span>
                    </div>
                    <span className="text-[9px] font-black uppercase text-emerald-500 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded">Ativa</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-950/60 rounded-2xl border border-neutral-100 dark:border-neutral-850">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-indigo-500" />
                      <span className="text-[11px] font-bold dark:text-white">Supabase RPC Connection</span>
                    </div>
                    <span className="text-[9px] font-black uppercase text-indigo-500 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded">Excelente</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-950/60 rounded-2xl border border-neutral-100 dark:border-neutral-850">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <span className="text-[11px] font-bold dark:text-white">Clientes Bloqueados</span>
                    </div>
                    <span className="text-[9px] font-black uppercase text-amber-500 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded">
                      {mappedWorkspaces.filter(w => w.is_blocked && !w.ownerIsSuperAdmin).length} Bloqueados
                    </span>
                  </div>
                </div>

                <div className="text-[10px] text-neutral-400 font-medium text-center border-t border-neutral-100 dark:border-neutral-850/60 pt-3">
                  MetaBuilderPRO Platform Engine v1.2
                </div>
              </div>

            </div>

          </motion.div>
        )}

        {/* Plans Management CRUD */}
        {activeTab === 'plans' && (
          <motion.div
            key="plans"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            <div className="flex justify-between items-center bg-white dark:bg-neutral-900/40 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
              <span className="text-xs font-bold text-neutral-500">Gerencie os pacotes que aparecem na Landing Page e no Checkout</span>
              <button
                type="button"
                onClick={() => handleOpenPlanModal()}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-md shadow-indigo-500/10 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Plano</span>
              </button>
            </div>

            {/* Plans List Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map(p => (
                <div 
                  key={p.id} 
                  className={cn(
                    "bg-white dark:bg-neutral-900/40 border rounded-[2rem] p-8 shadow-sm flex flex-col justify-between relative backdrop-blur-sm",
                    p.is_active ? "border-neutral-200 dark:border-neutral-850" : "border-dashed border-neutral-200 dark:border-neutral-800 opacity-60"
                  )}
                >
                  {!p.is_active && (
                    <span className="absolute top-4 left-4 px-2 py-0.5 bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 text-[8px] font-black uppercase tracking-wider rounded">Inativo</span>
                  )}
                  
                  {/* Actions buttons */}
                  <div className="absolute top-4 right-4 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenPlanModal(p)}
                      className="p-2 bg-neutral-50 dark:bg-neutral-950 text-neutral-400 hover:text-indigo-500 dark:hover:text-indigo-400 rounded-xl transition-all shadow-sm"
                      title="Editar plano"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePlan(p.id, p.name)}
                      className="p-2 bg-neutral-50 dark:bg-neutral-950 text-neutral-400 hover:text-red-500 rounded-xl transition-all shadow-sm"
                      title="Excluir plano"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-4 pt-2">
                    <div>
                      <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Licenças: {p.licenses_count}</span>
                      <h4 className="text-xl font-black text-neutral-900 dark:text-white mt-1">{p.name}</h4>
                    </div>

                    <div className="flex items-baseline">
                      <span className="text-sm font-bold text-neutral-500">R$</span>
                      <span className="text-3xl font-black text-neutral-900 dark:text-white px-1">
                        {p.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] font-bold text-neutral-400">/mês</span>
                    </div>

                    <p className="text-xs text-neutral-500 leading-relaxed min-h-[2.5rem]">
                      {p.description || 'Sem descrição.'}
                    </p>

                    <div className="border-t border-neutral-100 dark:border-neutral-850/60 pt-4 space-y-2">
                      <span className="text-[8px] font-black uppercase text-neutral-400 tracking-widest block">Benefícios</span>
                      {p.features && p.features.length > 0 ? (
                        p.features.map((feat, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs font-medium text-neutral-700 dark:text-neutral-350">
                            <div className="w-4 h-4 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center flex-shrink-0 text-[10px]">✓</div>
                            <span className="truncate">{feat}</span>
                          </div>
                        ))
                      ) : (
                        <span className="text-[10px] italic text-neutral-400">Nenhum benefício cadastrado.</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Customer Management */}
        {activeTab === 'clients' && (
          <motion.div
            key="clients"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-white dark:bg-neutral-900/40 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm backdrop-blur-sm">
              <div className="relative w-full sm:w-auto flex-grow max-w-md">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input 
                  type="text" 
                  placeholder="Buscar workspaces por nome, proprietário ou e-mail..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-xs font-medium focus:outline-none focus:border-indigo-500 text-neutral-800 dark:text-neutral-200"
                />
              </div>
              
              <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-950 p-1 rounded-xl w-full sm:w-auto justify-center">
                {(['all', 'active', 'blocked', 'registered'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setStatusFilter(filter)}
                    className={cn(
                      "px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all capitalize",
                      statusFilter === filter
                        ? 'bg-white dark:bg-neutral-850 text-indigo-500 dark:text-indigo-400 shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'
                    )}
                  >
                    {filter === 'all' 
                      ? 'Todos' 
                      : filter === 'active' 
                        ? 'Ativos' 
                        : filter === 'blocked' 
                          ? 'Bloqueados' 
                          : 'Cadastrados'}
                  </button>
                ))}
              </div>
            </div>

            {/* Customers Data Grid Table */}
            <div className="bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-850 rounded-[2rem] overflow-hidden shadow-sm backdrop-blur-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-150 dark:border-neutral-850 bg-neutral-50/50 dark:bg-neutral-950/40 text-[10px] font-black uppercase text-neutral-400 tracking-wider">
                      <th className="px-6 py-4">Workspace</th>
                      <th className="px-6 py-4">Dono / Email</th>
                      <th className="px-6 py-4">Plano</th>
                      <th className="px-6 py-4">Licenças</th>
                      <th className="px-6 py-4">Criação</th>
                      <th className="px-6 py-4 text-center">Status</th>
                      <th className="px-6 py-4 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-850/60">
                    {filteredWorkspaces.length > 0 ? (
                      filteredWorkspaces.map(ws => (
                        <tr key={ws.id} className="text-xs text-neutral-700 dark:text-neutral-350 hover:bg-neutral-50/50 dark:hover:bg-neutral-950/20 transition-all">
                          <td className="px-6 py-4.5 font-bold text-neutral-900 dark:text-white">
                            <div>
                              <span>{ws.name}</span>
                              <span className="block text-[10px] text-neutral-400 font-mono mt-0.5">/{ws.slug}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4.5">
                            <div>
                              <span className="font-bold text-neutral-800 dark:text-neutral-200">{ws.ownerName}</span>
                              <span className="block text-[10px] text-neutral-400 mt-0.5">{ws.ownerEmail}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4.5 font-bold">
                            <span className={cn(
                              "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider",
                              ws.plan_id ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400" : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
                            )}>
                              {ws.planName}
                            </span>
                          </td>
                          <td className="px-6 py-4.5 font-mono font-bold">
                            {ws.planLicenses > 0 ? `${ws.planLicenses} Contratadas` : 'Gratuito'}
                          </td>
                          <td className="px-6 py-4.5 text-neutral-400">
                            {new Date(ws.created_at).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-6 py-4.5 text-center">
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                              ws.is_blocked 
                                ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400"
                                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-450"
                            )}>
                              {ws.is_blocked ? 'Bloqueado' : 'Ativo'}
                            </span>
                          </td>
                          <td className="px-6 py-4.5 text-right">
                            {ws.is_blocked ? (
                              <button
                                type="button"
                                onClick={() => handleToggleBlock(ws.id, false, ws.name)}
                                className="px-3 py-1.5 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-lg transition-all font-black text-[9px] uppercase tracking-wider flex items-center gap-1.5 ml-auto"
                              >
                                <Unlock className="w-3.5 h-3.5" />
                                <span>Ativar</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggleBlock(ws.id, true, ws.name)}
                                className="px-3 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all font-black text-[9px] uppercase tracking-wider flex items-center gap-1.5 ml-auto"
                              >
                                <Lock className="w-3.5 h-3.5" />
                                <span>Bloquear</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-neutral-400 italic">
                          Nenhum cliente/workspace encontrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save/Edit Plan Modal Dialog */}
      <AnimatePresence>
        {isPlanModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-850 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-neutral-400 tracking-widest flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-500" />
                  {editingPlan ? 'Editar Plano' : 'Novo Plano de Assinatura'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsPlanModalOpen(false)}
                  className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleSavePlan} className="flex-grow flex flex-col">
                <div className="p-6 space-y-4 overflow-y-auto max-h-[65vh]">
                  {/* Name field */}
                  <div>
                    <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider mb-1.5 block">Nome do Plano</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Start, Professional, Enterprise"
                      value={planName}
                      onChange={(e) => setPlanName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-semibold focus:outline-none focus:border-indigo-500 text-neutral-800 dark:text-neutral-100"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Monthly Price field */}
                    <div>
                      <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider mb-1.5 block">Preço Mensal (R$)</label>
                      <input
                        type="number"
                        required
                        step="0.01"
                        min="0"
                        placeholder="450.00"
                        value={planPriceMonthly}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPlanPriceMonthly(val === '' ? '' : Number(val));
                          setPlanPrice(val === '' ? 0 : Number(val));
                        }}
                        className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-semibold focus:outline-none focus:border-indigo-500 text-neutral-800 dark:text-neutral-100"
                      />
                    </div>

                    {/* Licenses Count field */}
                    <div>
                      <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider mb-1.5 block">Número de Licenças</label>
                      <input
                        type="number"
                        required
                        min="1"
                        placeholder="3"
                        value={planLicenses}
                        onChange={(e) => setPlanLicenses(Number(e.target.value))}
                        className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-semibold focus:outline-none focus:border-indigo-500 text-neutral-800 dark:text-neutral-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    {/* Quarterly Price field */}
                    <div>
                      <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider mb-1.5 block">Trimestral (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Opcional"
                        value={planPriceQuarterly}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPlanPriceQuarterly(val === '' ? '' : Number(val));
                        }}
                        className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-semibold focus:outline-none focus:border-indigo-500 text-neutral-800 dark:text-neutral-100"
                      />
                    </div>

                    {/* Semiannual Price field */}
                    <div>
                      <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider mb-1.5 block">Semestral (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Opcional"
                        value={planPriceSemiannually}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPlanPriceSemiannually(val === '' ? '' : Number(val));
                        }}
                        className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-semibold focus:outline-none focus:border-indigo-500 text-neutral-800 dark:text-neutral-100"
                      />
                    </div>

                    {/* Yearly Price field */}
                    <div>
                      <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider mb-1.5 block">Anual (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Opcional"
                        value={planPriceYearly}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPlanPriceYearly(val === '' ? '' : Number(val));
                        }}
                        className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-semibold focus:outline-none focus:border-indigo-500 text-neutral-800 dark:text-neutral-100"
                      />
                    </div>
                  </div>

                  {/* Description field */}
                  <div>
                    <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider mb-1.5 block">Descrição do Plano</label>
                    <textarea
                      placeholder="Breve descrição dos benefícios ou limite de atuação."
                      value={planDesc}
                      onChange={(e) => setPlanDesc(e.target.value)}
                      rows={2}
                      className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-semibold focus:outline-none focus:border-indigo-500 text-neutral-800 dark:text-neutral-100"
                    />
                  </div>

                  {/* Features manager */}
                  <div>
                    <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider mb-1.5 block">Vantagens & Benefícios</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Ex: Suporte Prioritário 24/7"
                        value={newFeatureText}
                        onChange={(e) => setNewFeatureText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            addFeature()
                          }
                        }}
                        className="flex-grow px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-semibold focus:outline-none focus:border-indigo-500 text-neutral-800 dark:text-neutral-100"
                      />
                      <button
                        type="button"
                        onClick={addFeature}
                        className="px-4 py-2 bg-neutral-900 dark:bg-neutral-800 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider"
                      >
                        Add
                      </button>
                    </div>

                    <div className="mt-3 space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                      {planFeatures.map((feat, idx) => (
                        <div key={idx} className="flex justify-between items-center p-2 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-850">
                          <span className="text-xs text-neutral-600 dark:text-neutral-450">{feat}</span>
                          <button
                            type="button"
                            onClick={() => removeFeature(idx)}
                            className="p-1 text-neutral-400 hover:text-red-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Is Active Status checkbox */}
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="planIsActive"
                      checked={planIsActive}
                      onChange={(e) => setPlanIsActive(e.target.checked)}
                      className="w-4 h-4 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="planIsActive" className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                      Disponibilizar plano para venda (Ativo)
                    </label>
                  </div>
                </div>

                {/* Modal Footer Actions */}
                <div className="px-6 py-4 bg-neutral-50 dark:bg-neutral-900/40 border-t border-neutral-100 dark:border-neutral-850 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsPlanModalOpen(false)}
                    className="h-10 px-5 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 font-bold text-xs uppercase tracking-widest border border-neutral-200 dark:border-neutral-700 rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="h-10 px-5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-md shadow-indigo-500/20 flex items-center gap-2"
                  >
                    {isSaving ? 'Salvando...' : 'Salvar Plano'}
                  </button>
                </div>
              </form>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Delete Plan Modal */}
      <Modal
        isOpen={isDeletePlanModalOpen}
        onClose={() => {
          if (!isDeletingPlan) {
            setIsDeletePlanModalOpen(false)
            setPlanToDelete(null)
          }
        }}
        title="Excluir Plano de Assinatura"
        description="Esta ação removerá o plano permanentemente do sistema."
        size="md"
      >
        <div className="space-y-6">
          <div className="flex items-center gap-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-600 dark:text-red-400">
            <div className="p-2.5 bg-red-500/20 rounded-xl text-red-600 dark:text-red-400">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-black">Você tem certeza absoluta?</p>
              <p className="text-xs opacity-90 mt-0.5">
                O plano <span className="font-bold">"{planToDelete?.name}"</span> será removido e não poderá mais ser contratado.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={isDeletingPlan}
              onClick={() => {
                setIsDeletePlanModalOpen(false)
                setPlanToDelete(null)
              }}
              className="h-10 px-5 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 font-bold text-xs uppercase tracking-widest border border-neutral-200 dark:border-neutral-750 rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isDeletingPlan}
              onClick={handleConfirmDeletePlan}
              className="h-10 px-6 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-md shadow-red-500/20 flex items-center gap-2"
            >
              {isDeletingPlan ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Excluindo...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Confirmar Exclusão</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirm Block/Unblock Workspace Modal */}
      <Modal
        isOpen={isBlockModalOpen}
        onClose={() => {
          if (!isBlockingWorkspace) {
            setIsBlockModalOpen(false)
            setWorkspaceToBlock(null)
          }
        }}
        title={workspaceToBlock?.isBlocked ? "Bloquear Workspace" : "Ativar Workspace"}
        description={workspaceToBlock?.isBlocked 
          ? "Isso suspenderá o acesso do cliente a este workspace temporariamente." 
          : "Isso restaurará o acesso do cliente a este workspace."}
        size="md"
      >
        <div className="space-y-6">
          {workspaceToBlock?.isBlocked ? (
            <div className="flex items-center gap-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-700 dark:text-amber-450">
              <div className="p-2.5 bg-amber-500/20 rounded-xl">
                <Lock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-black">Atenção!</p>
                <p className="text-xs opacity-90 mt-0.5">
                  O workspace <span className="font-bold">"{workspaceToBlock?.name}"</span> será bloqueado. Todos os seus usuários perderão acesso imediato.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-700 dark:text-emerald-450">
              <div className="p-2.5 bg-emerald-500/20 rounded-xl">
                <Unlock className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-black">Acesso Restaurado</p>
                <p className="text-xs opacity-90 mt-0.5">
                  O workspace <span className="font-bold">"{workspaceToBlock?.name}"</span> será ativado e os usuários poderão acessar novamente.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={isBlockingWorkspace}
              onClick={() => {
                setIsBlockModalOpen(false)
                setWorkspaceToBlock(null)
              }}
              className="h-10 px-5 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 font-bold text-xs uppercase tracking-widest border border-neutral-200 dark:border-neutral-750 rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isBlockingWorkspace}
              onClick={handleConfirmToggleBlock}
              className={cn(
                "h-10 px-6 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-md flex items-center gap-2 text-white",
                workspaceToBlock?.isBlocked
                  ? "bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 shadow-amber-500/20"
                  : "bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 shadow-emerald-500/20"
              )}
            >
              {isBlockingWorkspace ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processando...</span>
                </>
              ) : workspaceToBlock?.isBlocked ? (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Confirmar Bloqueio</span>
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4" />
                  <span>Confirmar Ativação</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  )
}
