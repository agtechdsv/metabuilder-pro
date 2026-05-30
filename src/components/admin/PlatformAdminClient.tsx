'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
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
  Loader2,
  Calendar,
  MessageCircle,
  Video,
  Clock,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  User,
  BarChart3,
  Zap,
  Lightbulb
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import { savePlan, deletePlan, toggleWorkspaceBlock, deleteClientAdmin } from '@/app/actions/admin'
import { Modal } from '@/components/ui/Modal'
import {
  getAllAppointments,
  updateAppointmentStatus,
  deleteAppointment,
  updateAppointmentDate,
  updateAppointmentLink,
  sendConfirmationEmail
} from '@/app/actions/agenda'
import { getIClubAdminRules, saveIClubAdminRule, deleteIClubAdminRule, IClubRule } from '@/app/actions/iclub'
import { MetaVoiceAdminView } from './MetaVoiceAdminView'
import CommunityHubView from '@/components/client/CommunityHubView'

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
  plan_id?: string | null
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

interface WorkspaceMember {
  workspace_id: string
  user_id: string
}

interface Appointment {
  id: string
  titulo: string
  descricao: string | null
  data_inicio: string
  data_fim: string
  status: 'Pendente' | 'Confirmado' | 'Cancelado'
  categoria: string | null
  prioridade: string | null
  cor_etiqueta: string | null
  cliente_nome: string | null
  cliente_email: string | null
  cliente_whatsapp: string | null
  link_demonstracao?: string | null
  created_at: string
  updated_at: string
}

const TAB_CONFIG = {
  dashboard: { label: 'Dashboard BI', icon: BarChart3, iconColor: 'text-blue-500 dark:text-blue-400' },
  plans: { label: 'Cadastro de Planos', icon: Layers, iconColor: 'text-emerald-500 dark:text-emerald-400' },
  clients: { label: 'Gestão de Clientes', icon: Users, iconColor: 'text-purple-500 dark:text-purple-400' },
  agenda: { label: 'Agenda', icon: Calendar, iconColor: 'text-teal-500 dark:text-teal-400' },
  iclub: { label: 'Gestão do iClub', icon: Zap, iconColor: 'text-indigo-500 dark:text-indigo-400' },
  metavoice: { label: 'MetaVoice', icon: Lightbulb, iconColor: 'text-amber-500 dark:text-amber-400' },
  community: { label: 'MetaBuilders', icon: Users, iconColor: 'text-blue-500 dark:text-blue-400' },
} as const

interface PlatformAdminClientProps {
  initialPlans: Plan[]
  initialWorkspaces: Workspace[]
  profiles: Profile[]
  currentUserEmail: string
  payments: Payment[]
  workspaceMembers: WorkspaceMember[]
  ownerGuests: any[]
}

export default function PlatformAdminClient({
  initialPlans,
  initialWorkspaces,
  profiles,
  currentUserEmail,
  payments,
  workspaceMembers,
  ownerGuests = []
}: PlatformAdminClientProps) {
  const { toast } = useToast()

  // State variables
  const [activeTab, setActiveTab] = useState<'dashboard' | 'plans' | 'clients' | 'agenda' | 'iclub' | 'metavoice' | 'community'>('dashboard')
  const [plans, setPlans] = useState<Plan[]>(initialPlans)
  const [workspaces, setWorkspaces] = useState<Workspace[]>(initialWorkspaces)

  // iClub States
  const [iclubRules, setIclubRules] = useState<IClubRule[]>([])
  const [isLoadingRules, setIsLoadingRules] = useState(false)
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<Partial<IClubRule> | null>(null)

  // Rule Form States
  const [ruleName, setRuleName] = useState('')
  const [ruleBenefitType, setRuleBenefitType] = useState<'volume_license' | 'referral_discount'>('referral_discount')
  const [ruleTargetCount, setRuleTargetCount] = useState(1)
  const [ruleRewardType, setRuleRewardType] = useState<'free_license' | 'percent_discount'>('percent_discount')
  const [ruleRewardValue, setRuleRewardValue] = useState(5)
  const [ruleIsActive, setRuleIsActive] = useState(true)
  const [isSavingRule, setIsSavingRule] = useState(false)

  const [isDeleteRuleModalOpen, setIsDeleteRuleModalOpen] = useState(false)
  const [ruleToDelete, setRuleToDelete] = useState<IClubRule | null>(null)
  const [isDeletingRule, setIsDeletingRule] = useState(false)

  const fetchIClubRules = async () => {
    setIsLoadingRules(true)
    const res = await getIClubAdminRules()
    if (res.success && res.rules) {
      setIclubRules(res.rules)
    } else {
      toast(res.error || 'Erro ao carregar regras do iClub.', 'error')
    }
    setIsLoadingRules(false)
  }

  useEffect(() => {
    if (activeTab === 'iclub') {
      fetchIClubRules()
    }
  }, [activeTab])

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ruleName) {
      toast('Nome da regra é obrigatório', 'info')
      return
    }

    setIsSavingRule(true)
    const result = await saveIClubAdminRule({
      id: editingRule?.id,
      name: ruleName,
      benefit_type: ruleBenefitType,
      target_count: ruleTargetCount,
      reward_type: ruleRewardType,
      reward_value: ruleRewardValue,
      is_active: ruleIsActive
    })
    setIsSavingRule(false)

    if (result.success) {
      toast(editingRule ? 'Regra atualizada com sucesso!' : 'Nova regra criada com sucesso!', 'success')
      setIsRuleModalOpen(false)
      fetchIClubRules()
    } else {
      toast(result.error || 'Erro ao salvar a regra', 'error')
    }
  }

  const handleConfirmDeleteRule = async () => {
    if (!ruleToDelete || !ruleToDelete.id) return
    setIsDeletingRule(true)
    const result = await deleteIClubAdminRule(ruleToDelete.id)
    setIsDeletingRule(false)
    if (result.success) {
      toast(`Regra "${ruleToDelete.name}" excluída com sucesso.`, 'success')
      setIsDeleteRuleModalOpen(false)
      setRuleToDelete(null)
      fetchIClubRules()
    } else {
      toast(result.error || 'Erro ao excluir a regra.', 'error')
    }
  }

  // Agenda / Appointment States
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false)
  const [agendaFilter, setAgendaFilter] = useState<'all' | 'Pendente' | 'Confirmado' | 'Cancelado'>('all')
  const [agendaSearchQuery, setAgendaSearchQuery] = useState('')
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)

  // Rescheduling Modal States
  const [isRescheduling, setIsRescheduling] = useState(false)

  // Status Action States
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [isDeletingAppointment, setIsDeletingAppointment] = useState(false)
  const [isDeleteAppointmentModalOpen, setIsDeleteAppointmentModalOpen] = useState(false)
  const [appointmentToDelete, setAppointmentToDelete] = useState<Appointment | null>(null)

  // Fast Reschedule Mode States
  const [fastRescheduleMode, setFastRescheduleMode] = useState(false)
  const [reschedulingAppointment, setReschedulingAppointment] = useState<Appointment | null>(null)
  const [isConfirmFastRescheduleOpen, setIsConfirmFastRescheduleOpen] = useState(false)
  const [fastRescheduleTargetDate, setFastRescheduleTargetDate] = useState<Date | null>(null)
  const [fastRescheduleTargetSlot, setFastRescheduleTargetSlot] = useState<string | null>(null)

  // Calendar Week View Focus
  const [focusDate, setFocusDate] = useState<Date>(new Date())

  const fetchAppointments = async () => {
    setIsLoadingAppointments(true)
    const res = await getAllAppointments()
    if (res.success && res.appointments) {
      setAppointments(res.appointments as Appointment[])
    } else {
      toast(res.error || 'Erro ao carregar a agenda.', 'error')
    }
    setIsLoadingAppointments(false)
  }

  useEffect(() => {
    if (activeTab === 'agenda') {
      fetchAppointments()
    }
  }, [activeTab])

  const whatsappWindowRef = useRef<Window | null>(null)

  // Demo Link States & Effects
  const [demoLink, setDemoLink] = useState('')
  const [isSavingLink, setIsSavingLink] = useState(false)

  useEffect(() => {
    if (selectedAppointment) {
      setDemoLink(selectedAppointment.link_demonstracao || '')
    } else {
      setDemoLink('')
    }
  }, [selectedAppointment])

  const handleSaveDemoLink = async (id: string) => {
    setIsSavingLink(true)
    const res = await updateAppointmentLink(id, demoLink)
    if (res.success) {
      toast('Link da demonstração atualizado com sucesso!', 'success')
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, link_demonstracao: demoLink } : a))
      if (selectedAppointment?.id === id) {
        setSelectedAppointment(prev => prev ? { ...prev, link_demonstracao: demoLink } : null)
      }
    } else {
      toast(res.error || 'Erro ao atualizar link da demonstração.', 'error')
    }
    setIsSavingLink(false)
  }

  const [isSendingEmail, setIsSendingEmail] = useState<string | null>(null)

  const handleSendEmail = async (app: Appointment) => {
    if (!app.link_demonstracao) {
      toast('Por favor, defina e salve um link da demonstração primeiro antes de enviar o e-mail.', 'error')
      return
    }

    setIsSendingEmail(app.id)
    const res = await sendConfirmationEmail({
      id: app.id,
      clientName: app.cliente_nome || 'Cliente',
      clientEmail: app.cliente_email || '',
      dateInicio: app.data_inicio,
      linkDemonstracao: app.link_demonstracao
    })

    if (res.success) {
      toast('E-mail de confirmação enviado com sucesso para o cliente!', 'success')
      // Update local status to Confirmado as the server action updates it on DB
      setAppointments(prev => prev.map(a => a.id === app.id ? { ...a, status: 'Confirmado' } : a))
      if (selectedAppointment?.id === app.id) {
        setSelectedAppointment(prev => prev ? { ...prev, status: 'Confirmado' } : null)
      }
    } else {
      toast(res.error || 'Erro ao enviar o e-mail de confirmação.', 'error')
    }
    setIsSendingEmail(null)
  }

  const getWhatsappUrl = (app: Appointment) => {
    const cleanPhone = app.cliente_whatsapp?.replace(/\D/g, '') || ''
    const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`

    const startDate = new Date(app.data_inicio)
    const friendlyDate = startDate.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
    const timeStr = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}h`

    const message = `Olá, *${app.cliente_nome || 'Cliente'}*! Tudo bem?

Aqui é o Alexandre Moura do *MetaBuilderPRO*. \u{1F680}

Passando para confirmar o agendamento da sua demonstração prática exclusiva de 30 minutos!

\u{1F4C5} *Data*: ${friendlyDate}
\u{23F0} *Hora*: ${timeStr} (Horário de Brasília)
\u{1F517} *Link da Reunião*: ${app.link_demonstracao || 'O link do Google Meet será gerado/enviado próximo à reunião'}

Você pode acessar a sala de videoconferência diretamente pelo link acima no horário agendado. Qualquer dúvida ou necessidade de reagendamento, basta me mandar uma mensagem por aqui.

Nos vemos em breve!`

    return `https://web.whatsapp.com/send/?phone=${phoneWithCountry}&text=${encodeURIComponent(message)}`
  }

  const handleOpenWhatsapp = (app: Appointment) => {
    const url = getWhatsappUrl(app)
    try {
      if (whatsappWindowRef.current && !whatsappWindowRef.current.closed) {
        whatsappWindowRef.current.location.href = url
        whatsappWindowRef.current.focus()
      } else {
        whatsappWindowRef.current = window.open(url, "whatsapp_web")
      }
    } catch (e) {
      whatsappWindowRef.current = window.open(url, "whatsapp_web")
    }
  }

  // Handlers for Agenda Actions
  const handleUpdateStatus = async (id: string, newStatus: string) => {
    setIsUpdatingStatus(true)
    const res = await updateAppointmentStatus(id, newStatus)
    if (res.success) {
      if (newStatus === 'Cancelado') {
        toast('Compromisso cancelado com sucesso.', 'success', {
          label: 'Desfazer',
          onClick: () => handleUpdateStatus(id, 'Pendente')
        })
      } else {
        toast(`Status do compromisso atualizado para ${newStatus}.`, 'success')
      }
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: newStatus as any } : a))
      if (selectedAppointment?.id === id) {
        setSelectedAppointment(prev => prev ? { ...prev, status: newStatus as any } : null)
      }
    } else {
      toast(res.error || 'Erro ao atualizar status.', 'error')
    }
    setIsUpdatingStatus(false)
  }

  const handleDeleteAppointmentAction = async () => {
    if (!appointmentToDelete) return
    setIsDeletingAppointment(true)
    const res = await deleteAppointment(appointmentToDelete.id)
    if (res.success) {
      toast('Compromisso excluído permanentemente.', 'success')
      setAppointments(prev => prev.filter(a => a.id !== appointmentToDelete.id))
      setIsDeleteAppointmentModalOpen(false)
      setAppointmentToDelete(null)
      if (selectedAppointment?.id === appointmentToDelete.id) {
        setSelectedAppointment(null)
      }
    } else {
      toast(res.error || 'Erro ao excluir compromisso.', 'error')
    }
    setIsDeletingAppointment(false)
  }

  const handleConfirmFastReschedule = async () => {
    if (!reschedulingAppointment || !fastRescheduleTargetDate || !fastRescheduleTargetSlot) return
    setIsRescheduling(true)
    try {
      const [hours, minutes] = fastRescheduleTargetSlot.split(':').map(Number)

      const startDateTime = new Date(fastRescheduleTargetDate)
      startDateTime.setHours(hours, minutes, 0, 0)

      const endDateTime = new Date(startDateTime)
      endDateTime.setMinutes(endDateTime.getMinutes() + 30)

      const res = await updateAppointmentDate(
        reschedulingAppointment.id,
        startDateTime.toISOString(),
        endDateTime.toISOString()
      )

      if (res.success) {
        toast('Compromisso reagendado com sucesso!', 'success')
        setAppointments(prev => prev.map(a => a.id === reschedulingAppointment.id ? {
          ...a,
          data_inicio: startDateTime.toISOString(),
          data_fim: endDateTime.toISOString(),
          updated_at: new Date().toISOString()
        } : a))
        setIsConfirmFastRescheduleOpen(false)
        setFastRescheduleMode(false)
        setReschedulingAppointment(null)
      } else {
        toast(res.error || 'Erro ao reagendar compromisso.', 'error')
      }
    } catch (err) {
      toast('Erro de processamento. Verifique os dados.', 'error')
    } finally {
      setIsRescheduling(false)
    }
  }

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = async (e: React.DragEvent, targetDate: Date, targetSlot: string) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain')
    const app = appointments.find(a => a.id === id)
    if (!app) return

    const [hours, minutes] = targetSlot.split(':').map(Number)

    const startDateTime = new Date(targetDate)
    startDateTime.setHours(hours, minutes, 0, 0)

    // Validate target slot is not in the past
    if (startDateTime < new Date()) {
      toast('Não é possível reagendar compromissos para um horário passado.', 'error')
      return
    }

    const endDateTime = new Date(startDateTime)
    endDateTime.setMinutes(endDateTime.getMinutes() + 30)

    const isOccupied = findAppointmentForSlot(targetDate, targetSlot)
    if (isOccupied && isOccupied.id !== id) {
      toast('Este horário já está ocupado por outro compromisso.', 'error')
      return
    }

    setIsRescheduling(true)
    const res = await updateAppointmentDate(id, startDateTime.toISOString(), endDateTime.toISOString())
    setIsRescheduling(false)

    if (res.success) {
      toast('Compromisso reagendado com sucesso!', 'success')
      setAppointments(prev => prev.map(a => a.id === id ? {
        ...a,
        data_inicio: startDateTime.toISOString(),
        data_fim: endDateTime.toISOString(),
        updated_at: new Date().toISOString()
      } : a))
      if (selectedAppointment?.id === id) {
        setSelectedAppointment(prev => prev ? {
          ...prev,
          data_inicio: startDateTime.toISOString(),
          data_fim: endDateTime.toISOString(),
          updated_at: new Date().toISOString()
        } : null)
      }
    } else {
      toast(res.error || 'Erro ao reagendar compromisso.', 'error')
    }
  }

  const handleFastRescheduleClick = (dayDate: Date, slotStr: string) => {
    if (!fastRescheduleMode || !reschedulingAppointment) return
    setFastRescheduleTargetDate(dayDate)
    setFastRescheduleTargetSlot(slotStr)
    setIsConfirmFastRescheduleOpen(true)
  }

  // Week days calculator
  const weekDays = useMemo(() => {
    const d = new Date(focusDate)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Ajusta para segunda-feira
    const monday = new Date(d.setDate(diff))

    return Array.from({ length: 7 }).map((_, i) => {
      const dayDate = new Date(monday)
      dayDate.setDate(monday.getDate() + i)
      return dayDate
    })
  }, [focusDate])

  const findAppointmentForSlot = (dayDate: Date, slotStr: string) => {
    const [slotH, slotM] = slotStr.split(':').map(Number)

    return appointments.find(app => {
      const appDate = new Date(app.data_inicio)
      return (
        appDate.getFullYear() === dayDate.getFullYear() &&
        appDate.getMonth() === dayDate.getMonth() &&
        appDate.getDate() === dayDate.getDate() &&
        appDate.getHours() === slotH &&
        appDate.getMinutes() === slotM
      )
    })
  }

  const filteredAppointments = useMemo(() => {
    return appointments.filter(app => {
      // 1. Status Filter
      if (agendaFilter !== 'all' && app.status !== agendaFilter) {
        return false
      }

      // 2. Search query
      const matchSearch =
        (app.cliente_nome?.toLowerCase() || '').includes(agendaSearchQuery.toLowerCase()) ||
        (app.cliente_email?.toLowerCase() || '').includes(agendaSearchQuery.toLowerCase()) ||
        (app.cliente_whatsapp?.toLowerCase() || '').includes(agendaSearchQuery.toLowerCase()) ||
        (app.titulo?.toLowerCase() || '').includes(agendaSearchQuery.toLowerCase())

      return matchSearch
    })
  }, [appointments, agendaFilter, agendaSearchQuery])

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

  const [isDeleteClientModalOpen, setIsDeleteClientModalOpen] = useState(false)
  const [clientToDelete, setClientToDelete] = useState<{ id: string, name: string, ownerName: string, ownerId: string, ownerEmail: string } | null>(null)
  const [isDeletingClient, setIsDeletingClient] = useState(false)

  // Map workspace with profile and plan
  const mappedWorkspaces = useMemo(() => {
    return workspaces.map(w => {
      const ownerProfile = profiles.find(p => p.id === w.owner_id)
      const workspacePlan = plans.find(p => p.id === ownerProfile?.plan_id)

      // Calculate monthly equivalent price for MRR
      let planPrice = 0
      if (workspacePlan) {
        // Find the latest successful payment for this workspace
        const wPayments = payments.filter(p =>
          p.workspace_id === w.id &&
          p.plan_id === ownerProfile?.plan_id &&
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

      const uniqueGuests = new Set<string>()
      workspaceMembers.filter(m => m.workspace_id === w.id && m.user_id !== w.owner_id).forEach(m => uniqueGuests.add(m.user_id))
      ownerGuests.filter(g => g.owner_id === w.owner_id && g.access_level === 'global').forEach(g => uniqueGuests.add(g.user_id))

      const guestCount = uniqueGuests.size

      return {
        ...w,
        plan_id: ownerProfile?.plan_id || null,
        ownerName: ownerProfile?.full_name || 'Sem nome',
        ownerEmail: ownerProfile?.email || 'Sem e-mail',
        ownerIsSuperAdmin: ownerProfile?.is_super_admin || false,
        planName: workspacePlan?.name || 'Gratuito / Nenhum',
        planPrice,
        planLicenses: workspacePlan?.licenses_count || 0,
        guestCount
      }
    })
  }, [workspaces, profiles, plans, payments, workspaceMembers, ownerGuests])

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

    // "Total de Clientes" represents unique Owners that passed the filters
    const ownerIds = new Set(filteredWorkspaces.map(w => w.owner_id))
    const totalClients = ownerIds.size

    // "Usuários Ativos" agora conta donos únicos + convidados ativos (que existem na tabela profiles)
    const activeUserIds = new Set<string>()
    filteredWorkspaces.forEach(w => {
      activeUserIds.add(w.owner_id)
      
      // Find all guests of this owner (global and granular)
      const clientGuests = ownerGuests.filter(g => g.owner_id === w.owner_id)
      clientGuests.forEach(g => {
        if (profiles.some(p => p.id === g.user_id)) {
          activeUserIds.add(g.user_id)
        }
      })
    })
    const totalUsers = activeUserIds.size

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
  }, [filteredDashboardData, profiles, workspaceMembers])

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

  // Delete Client Handler (Trigger Modal)
  const handleDeleteClient = (workspaceId: string, wsName: string, ownerName: string, ownerId: string, ownerEmail: string) => {
    setClientToDelete({ id: workspaceId, name: wsName, ownerName, ownerId, ownerEmail })
    setIsDeleteClientModalOpen(true)
  }

  // Delete Client Action (Confirm from Modal)
  const handleConfirmDeleteClient = async () => {
    if (!clientToDelete) return
    setIsDeletingClient(true)
    const result = await deleteClientAdmin(clientToDelete.ownerId)
    setIsDeletingClient(false)
    if (result.success) {
      toast(`Cliente "${clientToDelete.ownerName}" (${clientToDelete.name}) excluído com sucesso.`, 'success')
      setWorkspaces(prev => prev.filter(w => w.owner_id !== clientToDelete.ownerId))
      setIsDeleteClientModalOpen(false)
      setClientToDelete(null)
    } else {
      toast(result.error || 'Erro ao excluir o cliente.', 'error')
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

    // 1. Chart Data for Total de Clientes (Owners)
    const plansWithClients = plans.map(p => {
      const wForPlan = filteredWorkspaces.filter(w => w.plan_id === p.id && !w.is_blocked)
      const count = new Set(wForPlan.map(w => w.owner_id)).size
      return { name: p.name, count }
    })
    const maxClientsCount = Math.max(...plansWithClients.map(p => p.count), 1)

    // 2. Chart Data for Usuários Ativos (Owners + Active Guests)
    const plansWithUsers = plans.map(p => {
      const wForPlan = filteredWorkspaces.filter(w => w.plan_id === p.id && !w.is_blocked)

      const activeUserIds = new Set<string>()
      wForPlan.forEach(w => activeUserIds.add(w.owner_id))

      const planWorkspaceIds = new Set(wForPlan.map(w => w.id))
      workspaceMembers.forEach(m => {
        if (planWorkspaceIds.has(m.workspace_id)) {
          if (profiles.some(prof => prof.id === m.user_id)) {
            activeUserIds.add(m.user_id)
          }
        }
      })
      return { name: p.name, count: activeUserIds.size }
    })
    const maxUsersCount = Math.max(...plansWithUsers.map(p => p.count), 1)

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Chart 1: Clientes */}
        <div className="bg-white dark:bg-neutral-900/40 p-6 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col justify-between h-[300px]">
          <div>
            <h4 className="text-[10px] font-black uppercase text-neutral-400 tracking-wider mb-4">Distribuição (Total de Clientes)</h4>
          </div>
          <div className="flex items-end justify-around h-48 px-2 border-b border-l border-neutral-200 dark:border-neutral-800/80 pt-4">
            {plansWithClients.map((p, idx) => {
              const pct = (p.count / maxClientsCount) * 100
              return (
                <div key={idx} className="flex flex-col items-center gap-2 w-12 group">
                  <div className="h-36 w-6 flex items-end justify-center relative">
                    <div className="relative w-6 bg-gradient-to-t from-indigo-600 to-indigo-400 dark:from-indigo-500 dark:to-purple-500 rounded-t-lg transition-all duration-500" style={{ height: `${Math.max(pct, 5)}%` }}>
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-neutral-900 dark:bg-neutral-800 text-white text-[9px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {p.count}
                      </div>
                    </div>
                  </div>
                  <span className="text-[9px] font-bold text-neutral-500 dark:text-neutral-400 truncate max-w-full">{p.name}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Chart 2: Usuários */}
        <div className="bg-white dark:bg-neutral-900/40 p-6 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col justify-between h-[300px]">
          <div>
            <h4 className="text-[10px] font-black uppercase text-neutral-400 tracking-wider mb-4">Distribuição (Usuários Ativos)</h4>
          </div>
          <div className="flex items-end justify-around h-48 px-2 border-b border-l border-neutral-200 dark:border-neutral-800/80 pt-4">
            {plansWithUsers.map((p, idx) => {
              const pct = (p.count / maxUsersCount) * 100
              return (
                <div key={idx} className="flex flex-col items-center gap-2 w-12 group">
                  <div className="h-36 w-6 flex items-end justify-center relative">
                    <div className="relative w-6 bg-gradient-to-t from-amber-500 to-amber-300 dark:from-amber-600 dark:to-orange-400 rounded-t-lg transition-all duration-500" style={{ height: `${Math.max(pct, 5)}%` }}>
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-neutral-900 dark:bg-neutral-800 text-white text-[9px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {p.count}
                      </div>
                    </div>
                  </div>
                  <span className="text-[9px] font-bold text-neutral-500 dark:text-neutral-400 truncate max-w-full">{p.name}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  const renderSlotButton = (dayDate: Date, slotStr: string, app?: Appointment) => {
    const isPast = new Date(dayDate)
    const [sh, sm] = slotStr.split(':').map(Number)
    isPast.setHours(sh, sm, 0, 0)
    const today = new Date()
    const isBeforeNow = isPast < today

    if (app) {
      const isSelected = selectedAppointment?.id === app.id
      return (
        <button
          key={slotStr}
          type="button"
          onClick={() => setSelectedAppointment(app)}
          draggable
          onDragStart={(e) => handleDragStart(e, app.id)}
          className={cn(
            "h-10 rounded-lg border text-left px-2 py-1 flex flex-col justify-between transition-all group cursor-grab active:cursor-grabbing text-[10px] font-semibold w-full",
            isSelected ? "ring-2 ring-indigo-500 ring-offset-2 ring-offset-white dark:ring-offset-black scale-95" : "",
            app.status === 'Confirmado'
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-450 hover:bg-emerald-500/20"
              : app.status === 'Cancelado'
                ? "bg-red-500/5 border-dashed border-red-500/20 text-red-500 dark:text-red-400 line-through opacity-60"
                : "bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20"
          )}
        >
          <span className="font-bold truncate w-full text-left">{app.cliente_nome || 'Demo'}</span>
          <span className="text-[8px] opacity-75 font-mono flex items-center justify-between">
            <span>{slotStr}</span>
            {app.status === 'Confirmado' && <Video className="w-2.5 h-2.5 text-emerald-500 inline ml-1" />}
          </span>
        </button>
      )
    }

    if (fastRescheduleMode && reschedulingAppointment) {
      if (isBeforeNow) {
        return (
          <div
            key={slotStr}
            className="h-10 border border-neutral-100 dark:border-neutral-900 bg-neutral-100/50 dark:bg-neutral-950/20 rounded-lg flex items-center justify-center text-[9px] font-semibold text-neutral-350 dark:text-neutral-700"
          >
            Passado
          </div>
        )
      }

      return (
        <button
          key={slotStr}
          type="button"
          onClick={() => handleFastRescheduleClick(dayDate, slotStr)}
          className="h-10 border border-dashed border-indigo-500/40 hover:border-indigo-500 hover:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg flex items-center justify-center text-[9px] font-bold cursor-pointer transition-all hover:scale-95 animate-pulse"
        >
          <span>Escolher</span>
        </button>
      )
    }

    return (
      <div
        key={slotStr}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, dayDate, slotStr)}
        className={cn(
          "h-10 border rounded-lg flex items-center justify-center text-[9px] font-semibold transition-all duration-200",
          isBeforeNow
            ? "border-neutral-100 dark:border-neutral-900 bg-neutral-100/30 dark:bg-neutral-950/10 text-neutral-400 dark:text-neutral-600"
            : "border-neutral-200 dark:border-neutral-850 bg-neutral-50/50 dark:bg-neutral-950/20 text-neutral-400 dark:text-neutral-500 hover:border-indigo-500/40 hover:bg-indigo-500/5 hover:text-indigo-500 cursor-default"
        )}
      >
        <span>Livre</span>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-10">

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
            {(['community', 'metavoice', 'iclub'] as const).map(tab => {
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
                    Donos de workspaces
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
                    Total de usuários
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
                          <td className="px-6 py-4.5 font-mono font-bold text-xs">
                            {ws.planLicenses > 0 ? `${ws.planLicenses} Contratada(s) / ${1 + ws.guestCount} Consumida(s)` : 'Gratuito'}
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
                            <div className="flex items-center justify-end gap-2">
                              {ws.is_blocked ? (
                                <button
                                  type="button"
                                  onClick={() => handleToggleBlock(ws.id, false, ws.name)}
                                  className="px-3 py-1.5 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-lg transition-all font-black text-[9px] uppercase tracking-wider flex items-center gap-1.5 shrink-0"
                                >
                                  <Unlock className="w-3.5 h-3.5" />
                                  <span>Ativar</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleToggleBlock(ws.id, true, ws.name)}
                                  className="px-3 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all font-black text-[9px] uppercase tracking-wider flex items-center gap-1.5 shrink-0"
                                >
                                  <Lock className="w-3.5 h-3.5" />
                                  <span>Bloquear</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteClient(ws.id, ws.name, ws.ownerName, ws.owner_id, ws.ownerEmail)}
                                className="px-3 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all font-black text-[9px] uppercase tracking-wider flex items-center gap-1.5 shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Excluir</span>
                              </button>
                            </div>
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

        {activeTab === 'agenda' && (
          <motion.div
            key="agenda"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            {/* Banner for Fast Reschedule Mode */}
            {fastRescheduleMode && reschedulingAppointment && (
              <div className="bg-indigo-600 text-white px-6 py-4 rounded-2xl flex items-center justify-between shadow-lg animate-pulse">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 animate-bounce" />
                  <span className="text-xs font-bold">
                    Reagendamento Rápido Ativo: Clique em um horário disponível no calendário para reagendar a demonstração de {reschedulingAppointment.cliente_nome}.
                  </span>
                </div>
                <button
                  onClick={() => {
                    setFastRescheduleMode(false)
                    setReschedulingAppointment(null)
                  }}
                  className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-black uppercase transition-colors"
                >
                  Cancelar
                </button>
              </div>
            )}

            {/* KPI Cards for Agenda */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {/* Total Appointments */}
              <div className="bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-850 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Total de Agendados</span>
                <h3 className="text-2xl font-black text-neutral-900 dark:text-white mt-2">{appointments.length}</h3>
              </div>
              {/* Pending */}
              <div className="bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-850 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider text-indigo-500">Pendentes</span>
                <h3 className="text-2xl font-black text-neutral-900 dark:text-white mt-2">
                  {appointments.filter(a => a.status === 'Pendente').length}
                </h3>
              </div>
              {/* Confirmed */}
              <div className="bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-850 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider text-emerald-500">Confirmados</span>
                <h3 className="text-2xl font-black text-neutral-900 dark:text-white mt-2">
                  {appointments.filter(a => a.status === 'Confirmado').length}
                </h3>
              </div>
              {/* Canceled */}
              <div className="bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-850 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider text-red-500">Cancelados</span>
                <h3 className="text-2xl font-black text-neutral-900 dark:text-white mt-2">
                  {appointments.filter(a => a.status === 'Cancelado').length}
                </h3>
              </div>
            </div>

            {/* Split Screen Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Triage List (4 cols) */}
              <div className="lg:col-span-4 space-y-4">
                <div className="bg-white dark:bg-neutral-900/40 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="text"
                      placeholder="Buscar por nome, email..."
                      value={agendaSearchQuery}
                      onChange={e => setAgendaSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 text-neutral-800 dark:text-neutral-200"
                    />
                  </div>

                  {/* Status selection buttons */}
                  <div className="flex gap-1 bg-neutral-50 dark:bg-neutral-950 p-1 rounded-xl justify-between border border-neutral-200/50 dark:border-neutral-800/50">
                    {(['all', 'Pendente', 'Confirmado', 'Cancelado'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setAgendaFilter(f)}
                        className={cn(
                          "px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all",
                          agendaFilter === f
                            ? "bg-white dark:bg-neutral-850 text-indigo-600 dark:text-indigo-400 shadow-sm"
                            : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                        )}
                      >
                        {f === 'all' ? 'Todos' : f}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Appointment Cards */}
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  {isLoadingAppointments ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-3 text-neutral-500 bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Buscando compromissos...</span>
                    </div>
                  ) : filteredAppointments.length > 0 ? (
                    filteredAppointments.map(app => {
                      const startDate = new Date(app.data_inicio)
                      const isSelected = selectedAppointment?.id === app.id

                      return (
                        <div
                          key={app.id}
                          onClick={() => setSelectedAppointment(app)}
                          className={cn(
                            "p-4 bg-white dark:bg-neutral-900/40 border rounded-2xl cursor-pointer transition-all hover:translate-y-[-2px] flex flex-col gap-3 relative",
                            isSelected
                              ? "border-indigo-500 shadow-md shadow-indigo-500/5"
                              : "border-neutral-200 dark:border-neutral-850"
                          )}
                        >
                          {/* Tag */}
                          <div className="flex justify-between items-center">
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                              app.status === 'Confirmado'
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-450"
                                : app.status === 'Cancelado'
                                  ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400"
                                  : "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400"
                            )}>
                              {app.status}
                            </span>
                            <span className="text-[9px] text-neutral-400 font-bold">
                              {startDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                            </span>
                          </div>

                          {/* Client details */}
                          <div>
                            <h4 className="font-black text-xs text-neutral-900 dark:text-white line-clamp-1">{app.cliente_nome || 'Sem Nome'}</h4>
                            <div className="flex items-center gap-1.5 mt-1 text-[10px] text-neutral-500">
                              <Clock className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                              <span className="font-bold">
                                {String(startDate.getHours()).padStart(2, '0')}:{String(startDate.getMinutes()).padStart(2, '0')}h (30 min)
                              </span>
                            </div>
                          </div>

                          {/* Detail expansion if selected */}
                          {isSelected && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="border-t border-neutral-100 dark:border-neutral-850/60 pt-3 flex flex-col gap-3 text-[11px]"
                            >
                              {/* Contacts */}
                              <div className="space-y-1.5 text-neutral-600 dark:text-neutral-400">
                                <div className="flex items-center gap-2">
                                  <Mail className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                                  <span className="font-medium truncate">{app.cliente_email}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Phone className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                                  <span className="font-semibold">{app.cliente_whatsapp}</span>
                                </div>
                              </div>

                              {/* Campo de link da demonstração */}
                              <div className="space-y-1.5 border-t border-neutral-100 dark:border-neutral-850/60 pt-2 pb-1">
                                <label className="text-[9px] font-black uppercase tracking-wider text-neutral-450 dark:text-neutral-400 block">Link da Demonstração (Meet / Zoom)</label>
                                <div className="flex gap-1.5">
                                  <input
                                    type="text"
                                    value={demoLink}
                                    onChange={(e) => setDemoLink(e.target.value)}
                                    placeholder="Ex: https://meet.google.com/abc-defg-hij"
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex-grow px-2 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-[10px] font-semibold focus:outline-none focus:border-indigo-500 text-neutral-850 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600"
                                  />
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleSaveDemoLink(app.id)
                                    }}
                                    disabled={isSavingLink}
                                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-bold text-[9px] uppercase tracking-wider cursor-pointer"
                                  >
                                    {isSavingLink ? '...' : 'Salvar'}
                                  </button>
                                </div>
                                {app.link_demonstracao && (
                                  <div className="flex items-center gap-1.5 mt-1 text-[10px]">
                                    <Video className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                                    <a
                                      href={app.link_demonstracao}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline truncate"
                                    >
                                      Acessar link salvo
                                    </a>
                                  </div>
                                )}
                              </div>

                              {/* Communications Buttons */}
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleOpenWhatsapp(app)
                                  }}
                                  className="h-8 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-colors flex items-center justify-center gap-1.5 font-bold text-[10px] uppercase tracking-wider cursor-pointer"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                  <span>WhatsApp</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleSendEmail(app)
                                  }}
                                  disabled={isSendingEmail === app.id}
                                  className="h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-750 text-neutral-700 dark:text-neutral-300 transition-colors flex items-center justify-center gap-1.5 font-bold text-[10px] uppercase tracking-wider border border-neutral-200 dark:border-neutral-700 cursor-pointer disabled:opacity-50"
                                >
                                  {isSendingEmail === app.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Mail className="w-3.5 h-3.5" />
                                  )}
                                  <span>{isSendingEmail === app.id ? 'Enviando...' : 'Enviar Email'}</span>
                                </button>
                              </div>

                              {/* Administration actions */}
                              <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-neutral-100 dark:border-neutral-850/60">
                                {app.status !== 'Confirmado' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleUpdateStatus(app.id, 'Confirmado')
                                    }}
                                    disabled={isUpdatingStatus}
                                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-bold text-[9px] uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Confirmar</span>
                                  </button>
                                )}

                                {app.status !== 'Cancelado' ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleUpdateStatus(app.id, 'Cancelado')
                                    }}
                                    disabled={isUpdatingStatus}
                                    className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-bold text-[9px] uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    <span>Cancelar</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleUpdateStatus(app.id, 'Pendente')
                                    }}
                                    disabled={isUpdatingStatus}
                                    className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg font-bold text-[9px] uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                                  >
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>Reverter Cancelamento</span>
                                  </button>
                                )}

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    // Trigger quick reschedule mode directly
                                    setReschedulingAppointment(app)
                                    setFastRescheduleMode(true)
                                    toast('Selecione um horário no calendário para reagendar.', 'info')
                                  }}
                                  className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-750 text-white rounded-lg font-bold text-[9px] uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                                >
                                  <Calendar className="w-3.5 h-3.5" />
                                  <span>Reagendar</span>
                                </button>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setAppointmentToDelete(app)
                                    setIsDeleteAppointmentModalOpen(true)
                                  }}
                                  className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg ml-auto cursor-pointer"
                                  title="Excluir agendamento"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      )
                    })
                  ) : (
                    <div className="py-12 text-center text-neutral-400 italic bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 rounded-2xl text-xs">
                      Nenhum agendamento encontrado para os filtros selecionados.
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Weekly Grid (8 cols) */}
              <div className="lg:col-span-8 bg-white dark:bg-neutral-900/40 p-6 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col gap-6">
                {/* Calendar Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const prevW = new Date(focusDate)
                        prevW.setDate(focusDate.getDate() - 7)
                        setFocusDate(prevW)
                      }}
                      className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer border border-neutral-200 dark:border-neutral-850"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-black uppercase tracking-wider text-neutral-900 dark:text-white min-w-[200px] text-center capitalize">
                      {weekDays[0].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} - {weekDays[6].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                    </span>
                    <button
                      onClick={() => {
                        const nextW = new Date(focusDate)
                        nextW.setDate(focusDate.getDate() + 7)
                        setFocusDate(nextW)
                      }}
                      className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer border border-neutral-200 dark:border-neutral-850"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setFocusDate(new Date())}
                      className="px-3.5 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-950 dark:hover:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 cursor-pointer"
                    >
                      Hoje
                    </button>
                    <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest hidden sm:inline">Grade Comercial</span>
                  </div>
                </div>

                {/* Calendar Grid Container (Horizontal scroll on mobile) */}
                <div className="overflow-x-auto">
                  <div className="min-w-[800px] grid grid-cols-8 gap-2.5">
                    {/* Time labels column */}
                    <div className="flex flex-col gap-2.5 pt-8">
                      {/* Morning Header */}
                      <span className="text-[8px] font-black uppercase text-neutral-400 tracking-wider text-center h-4 flex items-center justify-center border-b border-neutral-200 dark:border-neutral-800/80 pb-1">Manhã</span>

                      {/* Generate typical morning slots */}
                      {Array.from({ length: 8 }).map((_, idx) => {
                        const h = 8 + Math.floor(idx / 2)
                        const m = (idx % 2) * 30
                        return (
                          <div key={`ml-${idx}`} className="h-10 text-[10px] font-bold text-neutral-400 flex items-center justify-end pr-2 border-r border-neutral-200 dark:border-neutral-850">
                            {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}h
                          </div>
                        )
                      })}

                      {/* Evening Header */}
                      <span className="text-[8px] font-black uppercase text-neutral-400 tracking-wider text-center h-4 flex items-center justify-center border-b border-neutral-200 dark:border-neutral-800/80 pb-1 mt-2">Noite</span>

                      {/* Generate typical evening slots */}
                      {Array.from({ length: 4 }).map((_, idx) => {
                        const h = 19 + Math.floor(idx / 2)
                        const m = (idx % 2) * 30
                        return (
                          <div key={`el-${idx}`} className="h-10 text-[10px] font-bold text-neutral-400 flex items-center justify-end pr-2 border-r border-neutral-200 dark:border-neutral-850">
                            {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}h
                          </div>
                        )
                      })}
                    </div>

                    {/* 7 Days Columns */}
                    {weekDays.map((dayDate, dayIdx) => {
                      const dayOfWeek = dayDate.getDay() // 0: Sunday, 6: Saturday
                      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
                      const dayNameShort = dayDate.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
                      const isToday = new Date().toDateString() === dayDate.toDateString()

                      return (
                        <div key={dayIdx} className="flex flex-col gap-2.5">
                          {/* Day column header */}
                          <div className={cn(
                            "flex flex-col items-center justify-center p-1.5 rounded-xl border",
                            isToday
                              ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-650 dark:text-white"
                              : "border-transparent text-neutral-600 dark:text-neutral-400"
                          )}>
                            <span className="text-[9px] font-black uppercase tracking-wider">{dayNameShort}</span>
                            <span className="text-sm font-black mt-0.5">{dayDate.getDate()}</span>
                          </div>

                          {/* Morning Slots */}
                          <span className="h-4 flex-shrink-0" /> {/* Spacer alignment matching header */}
                          {Array.from({ length: 8 }).map((_, idx) => {
                            const h = 8 + Math.floor(idx / 2)
                            const m = (idx % 2) * 30
                            const slotStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
                            const app = findAppointmentForSlot(dayDate, slotStr)

                            return renderSlotButton(dayDate, slotStr, app)
                          })}

                          {/* Evening Spacer */}
                          <span className="h-4 flex-shrink-0 mt-2 border-b border-neutral-100 dark:border-neutral-850/60" />

                          {/* Evening Slots */}
                          {isWeekend ? (
                            /* No evening commercial slots on weekends */
                            Array.from({ length: 4 }).map((_, idx) => (
                              <div
                                key={`empty-weekend-${idx}`}
                                className="h-10 border border-dashed border-neutral-100 dark:border-neutral-900 bg-neutral-50/20 dark:bg-neutral-950/10 rounded-lg flex items-center justify-center text-[9px] font-semibold text-neutral-300 dark:text-neutral-800"
                              >
                                Indisponível
                              </div>
                            ))
                          ) : (
                            Array.from({ length: 4 }).map((_, idx) => {
                              const h = 19 + Math.floor(idx / 2)
                              const m = (idx % 2) * 30
                              const slotStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
                              const app = findAppointmentForSlot(dayDate, slotStr)

                              return renderSlotButton(dayDate, slotStr, app)
                            })
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Calendar Legend */}
                <div className="flex flex-wrap gap-4 items-center text-[10px] text-neutral-500 font-bold border-t border-neutral-100 dark:border-neutral-850/60 pt-4">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full" />
                    <span>Pendente</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                    <span>Confirmado</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-red-500 rounded-full" />
                    <span>Cancelado</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded" />
                    <span>Livre / Disponível</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'iclub' && (
          <motion.div
            key="iclub"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            {/* Header Banner */}
            <div className="flex justify-between items-center bg-white dark:bg-neutral-900/40 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
              <span className="text-xs font-bold text-neutral-500">Configure as regras de pontuação e fidelidade do iClub</span>
              <button
                type="button"
                onClick={() => {
                  setEditingRule(null)
                  setRuleName('')
                  setRuleBenefitType('referral_discount')
                  setRuleTargetCount(1)
                  setRuleRewardType('percent_discount')
                  setRuleRewardValue(5)
                  setRuleIsActive(true)
                  setIsRuleModalOpen(true)
                }}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-md shadow-indigo-500/10 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Nova Regra</span>
              </button>
            </div>

            {/* Rules Cards List */}
            {isLoadingRules ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-neutral-500 bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem]">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Carregando regras...</span>
              </div>
            ) : iclubRules.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {iclubRules.map(rule => (
                  <div
                    key={rule.id}
                    className={cn(
                      "bg-white dark:bg-neutral-900/40 border rounded-[2rem] p-8 shadow-sm flex flex-col justify-between relative backdrop-blur-sm",
                      rule.is_active ? "border-neutral-200 dark:border-neutral-850" : "border-dashed border-neutral-200 dark:border-neutral-800 opacity-60"
                    )}
                  >
                    {!rule.is_active && (
                      <span className="absolute top-4 left-4 px-2 py-0.5 bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 text-[8px] font-black uppercase tracking-wider rounded">Inativo</span>
                    )}

                    {/* Actions */}
                    <div className="absolute top-4 right-4 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRule(rule)
                          setRuleName(rule.name)
                          setRuleBenefitType(rule.benefit_type)
                          setRuleTargetCount(rule.target_count)
                          setRuleRewardType(rule.reward_type)
                          setRuleRewardValue(Number(rule.reward_value))
                          setRuleIsActive(rule.is_active)
                          setIsRuleModalOpen(true)
                        }}
                        className="p-2 bg-neutral-50 dark:bg-neutral-950 text-neutral-400 hover:text-indigo-500 dark:hover:text-indigo-400 rounded-xl transition-all shadow-sm"
                        title="Editar regra"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRuleToDelete(rule)
                          setIsDeleteRuleModalOpen(true)
                        }}
                        className="p-2 bg-neutral-50 dark:bg-neutral-950 text-neutral-400 hover:text-red-500 rounded-xl transition-all shadow-sm"
                        title="Excluir regra"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-4 pt-2">
                      <div>
                        <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">
                          Tipo: {rule.benefit_type === 'volume_license' ? 'Volume de Licenças' : 'Indicação'}
                        </span>
                        <h4 className="text-xl font-black text-neutral-900 dark:text-white mt-1">{rule.name}</h4>
                      </div>

                      <div className="space-y-1.5 text-xs text-neutral-600 dark:text-neutral-350">
                        <p>
                          <span className="font-bold text-neutral-400">Meta: </span>
                          A cada <strong className="text-neutral-850 dark:text-white">{rule.target_count}</strong> {rule.benefit_type === 'volume_license' ? 'licenças contratadas' : 'indicações ativas'}
                        </p>
                        <p>
                          <span className="font-bold text-neutral-400">Recompensa: </span>
                          <strong className="text-indigo-600 dark:text-indigo-400">
                            {rule.reward_type === 'free_license'
                              ? `${Number(rule.reward_value)} Licença(s) Grátis`
                              : `${Number(rule.reward_value)}% de Desconto`}
                          </strong>
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-neutral-400 italic bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] text-xs">
                Nenhuma regra cadastrada no iClub.
              </div>
            )}
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

      {/* Confirm Delete Appointment Modal */}
      <Modal
        isOpen={isDeleteAppointmentModalOpen}
        onClose={() => {
          if (!isDeletingAppointment) {
            setIsDeleteAppointmentModalOpen(false)
            setAppointmentToDelete(null)
          }
        }}
        title="Excluir Agendamento"
        description="Esta ação removerá o compromisso permanentemente da agenda."
        size="md"
      >
        <div className="space-y-6">
          <div className="flex items-center gap-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-650 dark:text-red-400">
            <div className="p-2.5 bg-red-500/20 rounded-xl">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-black">Excluir Compromisso?</p>
              <p className="text-xs opacity-90 mt-0.5">
                O agendamento de <span className="font-bold">"{appointmentToDelete?.cliente_nome}"</span> será apagado permanentemente.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={isDeletingAppointment}
              onClick={() => {
                setIsDeleteAppointmentModalOpen(false)
                setAppointmentToDelete(null)
              }}
              className="h-10 px-5 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 font-bold text-xs uppercase tracking-widest border border-neutral-200 dark:border-neutral-750 rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isDeletingAppointment}
              onClick={handleDeleteAppointmentAction}
              className="h-10 px-6 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-md shadow-red-500/20 flex items-center gap-2"
            >
              {isDeletingAppointment ? (
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

      {/* Confirm Fast Reschedule Modal */}
      <Modal
        isOpen={isConfirmFastRescheduleOpen}
        onClose={() => {
          if (!isRescheduling) {
            setIsConfirmFastRescheduleOpen(false)
            setFastRescheduleTargetDate(null)
            setFastRescheduleTargetSlot(null)
          }
        }}
        title="Confirmar Reagendamento Rápido"
        description="Você está alterando a data e o horário da demonstração."
        size="md"
      >
        <div className="space-y-6">
          <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-neutral-850 dark:text-indigo-300">
            <p className="text-sm font-bold">Deseja reagendar o compromisso?</p>
            <div className="mt-3 space-y-2 text-xs">
              <p>
                <span className="text-neutral-400">Cliente:</span>{" "}
                <span className="font-bold text-neutral-900 dark:text-white">{reschedulingAppointment?.cliente_nome}</span>
              </p>
              <p>
                <span className="text-neutral-400">De:</span>{" "}
                <span className="font-semibold text-red-500 line-through">
                  {reschedulingAppointment && new Date(reschedulingAppointment.data_inicio).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}h
                </span>
              </p>
              <p>
                <span className="text-neutral-400">Para:</span>{" "}
                <span className="font-bold text-emerald-500">
                  {fastRescheduleTargetDate && fastRescheduleTargetDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })} às {fastRescheduleTargetSlot}h
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={isRescheduling}
              onClick={() => {
                setIsConfirmFastRescheduleOpen(false)
                setFastRescheduleTargetDate(null)
                setFastRescheduleTargetSlot(null)
              }}
              className="h-10 px-5 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 font-bold text-xs uppercase tracking-widest border border-neutral-200 dark:border-neutral-750 rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isRescheduling}
              onClick={handleConfirmFastReschedule}
              className="h-10 px-6 bg-indigo-600 hover:bg-indigo-750 disabled:bg-indigo-400 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-md shadow-indigo-500/20 flex items-center gap-2"
            >
              {isRescheduling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Reagendando...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Confirmar Reagendamento</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Save/Edit Rule Modal Dialog */}
      <AnimatePresence>
        {isRuleModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-850 flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-widest text-indigo-500">
                  {editingRule ? 'Editar Regra iClub' : 'Nova Regra iClub'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsRuleModalOpen(false)}
                  className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleSaveRule} className="flex-grow flex flex-col">
                <div className="p-6 space-y-4">
                  {/* Name */}
                  <div>
                    <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider mb-1.5 block">Nome da Regra</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Licença Grátis a cada 12 contratadas"
                      value={ruleName}
                      onChange={(e) => setRuleName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-semibold focus:outline-none focus:border-indigo-500 text-neutral-850 dark:text-neutral-100"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Benefit Type */}
                    <div>
                      <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider mb-1.5 block">Tipo de Meta</label>
                      <select
                        value={ruleBenefitType}
                        onChange={(e) => setRuleBenefitType(e.target.value as any)}
                        className="w-full h-10 px-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 text-neutral-850 dark:text-neutral-100"
                      >
                        <option value="volume_license">Volume de Licenças</option>
                        <option value="referral_discount">Indicação Convertida</option>
                      </select>
                    </div>

                    {/* Target Count */}
                    <div>
                      <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider mb-1.5 block">Quantidade Meta</label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={ruleTargetCount}
                        onChange={(e) => setRuleTargetCount(Number(e.target.value))}
                        className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-semibold focus:outline-none focus:border-indigo-500 text-neutral-850 dark:text-neutral-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Reward Type */}
                    <div>
                      <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider mb-1.5 block">Tipo de Recompensa</label>
                      <select
                        value={ruleRewardType}
                        onChange={(e) => setRuleRewardType(e.target.value as any)}
                        className="w-full h-10 px-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 text-neutral-850 dark:text-neutral-100"
                      >
                        <option value="free_license">Licença Grátis</option>
                        <option value="percent_discount">Desconto em Porcentagem</option>
                      </select>
                    </div>

                    {/* Reward Value */}
                    <div>
                      <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider mb-1.5 block">Valor da Recompensa</label>
                      <input
                        type="number"
                        required
                        step="0.01"
                        min="0"
                        value={ruleRewardValue}
                        onChange={(e) => setRuleRewardValue(Number(e.target.value))}
                        className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-semibold focus:outline-none focus:border-indigo-500 text-neutral-850 dark:text-neutral-100"
                      />
                    </div>
                  </div>

                  {/* Is Active Status checkbox */}
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="ruleIsActive"
                      checked={ruleIsActive}
                      onChange={(e) => setRuleIsActive(e.target.checked)}
                      className="w-4 h-4 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="ruleIsActive" className="text-xs font-bold text-neutral-700 dark:text-neutral-350">
                      Disponibilizar regra (Ativa)
                    </label>
                  </div>
                </div>

                {/* Modal Footer Actions */}
                <div className="px-6 py-4 bg-neutral-50 dark:bg-neutral-900/40 border-t border-neutral-100 dark:border-neutral-850 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsRuleModalOpen(false)}
                    className="h-10 px-5 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 font-bold text-xs uppercase tracking-widest border border-neutral-200 dark:border-neutral-700 rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingRule}
                    className="h-10 px-5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-md shadow-indigo-500/20 flex items-center gap-2"
                  >
                    {isSavingRule ? 'Salvando...' : 'Salvar Regra'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Delete Rule Modal */}
      <Modal
        isOpen={isDeleteRuleModalOpen}
        onClose={() => {
          if (!isDeletingRule) {
            setIsDeleteRuleModalOpen(false)
            setRuleToDelete(null)
          }
        }}
        title="Excluir Regra iClub"
        description="Esta ação removerá a regra permanentemente do iClub."
        size="md"
      >
        <div className="space-y-6">
          <div className="flex items-center gap-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-650 dark:text-red-400">
            <div className="p-2.5 bg-red-500/20 rounded-xl">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-black">Você tem certeza absoluta?</p>
              <p className="text-xs opacity-90 mt-0.5">
                A regra <span className="font-bold">"{ruleToDelete?.name}"</span> será removida permanentemente.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={isDeletingRule}
              onClick={() => {
                setIsDeleteRuleModalOpen(false)
                setRuleToDelete(null)
              }}
              className="h-10 px-5 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 font-bold text-xs uppercase tracking-widest border border-neutral-200 dark:border-neutral-750 rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isDeletingRule}
              onClick={handleConfirmDeleteRule}
              className="h-10 px-6 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-md shadow-red-500/20 flex items-center gap-2"
            >
              {isDeletingRule ? (
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

      {/* Confirm Delete Client Modal */}
      <Modal
        isOpen={isDeleteClientModalOpen}
        onClose={() => {
          if (!isDeletingClient) {
            setIsDeleteClientModalOpen(false)
            setClientToDelete(null)
          }
        }}
        title="Excluir Geral o Cliente"
        description="Esta ação removerá permanentemente o cliente, seu usuário de acesso, workspaces e todos os dados associados."
        size="md"
      >
        <div className="space-y-6">
          <div className="flex items-center gap-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-650 dark:text-red-400">
            <div className="p-2.5 bg-red-500/20 rounded-xl">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-black">Você tem certeza absoluta?</p>
              <p className="text-xs opacity-90 mt-0.5">
                Esta ação é <span className="font-bold">irreversível</span>. O cliente <span className="font-bold">"{clientToDelete?.ownerName}"</span> ({clientToDelete?.ownerEmail}) e todas as suas informações de workspaces serão apagadas para sempre.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={isDeletingClient}
              onClick={() => {
                setIsDeleteClientModalOpen(false)
                setClientToDelete(null)
              }}
              className="h-10 px-5 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 font-bold text-xs uppercase tracking-widest border border-neutral-200 dark:border-neutral-750 rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isDeletingClient}
              onClick={handleConfirmDeleteClient}
              className="h-10 px-6 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-md shadow-red-500/20 flex items-center gap-2"
            >
              {isDeletingClient ? (
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

    </div>
  )
}
