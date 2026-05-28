'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  LayoutDashboard,
  Calendar,
  CreditCard,
  XCircle,
  Search,
  Sparkles,
  Terminal,
  Database,
  Layout,
  Cpu,
  Activity,
  Clock,
  Check,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  CheckSquare,
  Square,
  Play,
  ArrowRight,
  TrendingUp,
  RotateCcw,
  Zap,
  Users,
  Eye,
  FileText,
  ExternalLink,
  Sliders,
  Compass,
  Copy,
  Download,
  Code,
  Loader2,
  AlertTriangle,
  Shield,
  ShieldAlert,
  Lightbulb,
  MessageCircle,
  ThumbsUp,
  Star,
  Heart
} from 'lucide-react'
import Link from 'next/link'
import { BottomCta } from '@/components/landing/BottomCta'
import { useI18n } from '@/i18n/I18nContext'
import { cn } from '@/lib/utils'
import CommunityHubView from '@/components/client/CommunityHubView'

type TabType = 'bi' | 'productivity' | 'iclub' | 'subscription' | 'cancel' | 'metavoice' | 'community'

export default function ControlCenterFeaturePage() {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<TabType>('bi')

  // BI Tab States
  const biWorkspaces = [
    { name: 'AGTech', slug: 'agtech', projects: 1, cases: 3, users: 3, created: '23/05/2026' }
  ]

  // Productivity Tab States
  const [selectedProject, setSelectedProject] = useState('All')
  const [selectedDev, setSelectedDev] = useState('All')
  const [selectedPeriod, setSelectedPeriod] = useState('All')
  const [isDetailedLogOpen, setIsDetailedLogOpen] = useState(false)
  const [detailedLogTheme, setDetailedLogTheme] = useState<'dark' | 'light'>('dark')
  const [simulatedModalTab, setSimulatedModalTab] = useState<'visual' | 'raw'>('visual')
  const [simulatedCopied, setSimulatedCopied] = useState(false)
  const [simulatedProdSubTab, setSimulatedProdSubTab] = useState<'summary' | 'detailed'>('summary')

  // Detailed Log mock database
  const mockDetailedLogs = {
    session1: {
      dev: 'Alexandre Moura',
      start: '26/05/2026, 19:05:50',
      activeTime: '0m 8s',
      actions: [
        { time: '2026-05-26T19:05:50.000Z', action: 'SESSION_START', detail: 'Entrou no configurador do Caso de Uso', gap: 'START' },
        { time: '2026-05-26T19:05:58.000Z', action: 'NAVIGATION', detail: 'Fechou a sessão sem salvar', gap: '+8s' }
      ]
    },
    session2: {
      dev: 'Alexandre Moura',
      start: '26/05/2026, 18:48:35',
      activeTime: '1m 13s',
      actions: [
        { time: '2026-05-26T18:48:35.000Z', action: 'SESSION_START', detail: 'Entrou no configurador do Caso de Uso "contratos"', gap: 'START' },
        { time: '2026-05-26T18:48:45.000Z', action: 'CONFIG_CHANGE', detail: 'Removeu o botão "salvar" (Etapa 3 - Layout)', gap: '+10s' },
        { time: '2026-05-26T18:49:02.000Z', action: 'CONFIG_CHANGE', detail: 'Adicionou o botão "salvar" (Etapa 3 - Layout)', gap: '+17s' },
        { time: '2026-05-26T18:49:15.000Z', action: 'CONFIG_CHANGE', detail: 'Removeu o botão "salvar" (Etapa 3 - Layout)', gap: '+13s' },
        { time: '2026-05-26T18:49:30.000Z', action: 'CONFIG_CHANGE', detail: 'Adicionou o botão "salvar" (Etapa 3 - Layout)', gap: '+15s' },
        { time: '2026-05-26T18:49:48.000Z', action: 'NAVIGATION', detail: 'Finalizou e salvou alterações (Etapa 4 - Finalizar)', gap: '+18s' }
      ]
    }
  }

  const [activeDetailedLog, setActiveDetailedLog] = useState<keyof typeof mockDetailedLogs>('session2')

  const handleCloseSimulatedLog = () => {
    setIsDetailedLogOpen(false)
    setSimulatedModalTab('visual')
    setSimulatedCopied(false)
  }

  const handleSimulatedCopyJson = (actions: any) => {
    const text = JSON.stringify(actions, null, 2)
    navigator.clipboard.writeText(text)
      .then(() => {
        setSimulatedCopied(true)
        setTimeout(() => setSimulatedCopied(false), 2000)
      })
      .catch((err) => {
        console.error('Erro ao copiar:', err)
      })
  }

  const handleSimulatedDownloadJson = (actions: any) => {
    const blob = new Blob([JSON.stringify(actions, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mock_session_log_${activeDetailedLog}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Cancel Tab States
  const [selectedReasons, setSelectedReasons] = useState<string[]>([])
  const [cancelComment, setCancelComment] = useState('')
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Simulated Subscription States
  const simulatedPlans = [
    {
      id: 'start',
      name: 'Start',
      licenses_count: 1,
      price: 450.00,
      price_monthly: 450.00,
      price_quarterly: 1215.00,
      price_semiannually: 2295.00,
      price_yearly: 4320.00
    },
    {
      id: 'professional',
      name: 'Professional',
      licenses_count: 3,
      price: 1190.00,
      price_monthly: 1190.00,
      price_quarterly: 3213.00,
      price_semiannually: 6069.00,
      price_yearly: 11424.00
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      licenses_count: 5,
      price: 1500.00,
      price_monthly: 1500.00,
      price_quarterly: 4050.00,
      price_semiannually: 7650.00,
      price_yearly: 14400.00
    }
  ]

  const [simulatedPlanId, setSimulatedPlanId] = useState('professional')
  const [simulatedCycle, setSimulatedCycle] = useState('semiannual')
  const [selectedSimulatedPlanId, setSelectedSimulatedPlanId] = useState('professional')
  const [selectedSimulatedCycle, setSelectedSimulatedCycle] = useState('semiannual')

  const [simulatedCardBrand, setSimulatedCardBrand] = useState('VISA')
  const [simulatedCardDigits, setSimulatedCardDigits] = useState('1234')

  const [showSimulatedCardModal, setShowSimulatedCardModal] = useState(false)
  const [showSimulatedPlanConfirmModal, setShowSimulatedPlanConfirmModal] = useState(false)

  const [isSimulatingCardUpdate, setIsSimulatingCardUpdate] = useState(false)
  const [isSimulatingPlanUpdate, setIsSimulatingPlanUpdate] = useState(false)

  const [simulatedCardForm, setSimulatedCardForm] = useState({
    cardNumber: '',
    cardName: '',
    cardExpiry: '',
    cardCvv: '',
    billingName: 'Alexandre Moura',
    billingCpfCnpj: '',
    billingEmail: 'contato@agtech.com.br',
    phone: '',
    postalCode: '',
    addressNumber: ''
  })

  const getSimulatedCycleLabel = (cycle: string) => {
    switch (cycle) {
      case 'monthly': return 'Mensal'
      case 'quarterly': return 'Trimestral'
      case 'semiannual': return 'Semestral'
      case 'yearly': return 'Anual'
      default: return '—'
    }
  }

  const formatSimulatedPrice = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)
  }

  const getSimulatedPlanPrice = (planId: string, cycle: string) => {
    const p = simulatedPlans.find(pl => pl.id === planId)
    if (!p) return 0
    switch (cycle) {
      case 'monthly': return p.price_monthly
      case 'quarterly': return p.price_quarterly
      case 'semiannual': return p.price_semiannually
      case 'yearly': return p.price_yearly
      default: return p.price_monthly
    }
  }

  const handleSimulatedCardSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSimulatingCardUpdate(true)
    setTimeout(() => {
      const brand = simulatedCardForm.cardNumber.startsWith('5') ? 'MASTERCARD' : 'VISA'
      const digits = simulatedCardForm.cardNumber.slice(-4) || '4321'
      setSimulatedCardBrand(brand)
      setSimulatedCardDigits(digits)
      setIsSimulatingCardUpdate(false)
      setShowSimulatedCardModal(false)
      triggerToast('Cartão de crédito atualizado com sucesso! (Simulado)')
      setSimulatedCardForm(prev => ({
        ...prev,
        cardNumber: '',
        cardName: '',
        cardExpiry: '',
        cardCvv: ''
      }))
    }, 1500)
  }

  const handleSimulatedPlanChange = () => {
    setIsSimulatingPlanUpdate(true)
    setTimeout(() => {
      setSimulatedPlanId(selectedSimulatedPlanId)
      setSimulatedCycle(selectedSimulatedCycle)
      setIsSimulatingPlanUpdate(false)
      setShowSimulatedPlanConfirmModal(false)
      triggerToast('Plano de assinatura atualizado com sucesso! (Simulado)')
    }, 1500)
  }

  const toggleReason = (reason: string) => {
    if (selectedReasons.includes(reason)) {
      setSelectedReasons(selectedReasons.filter(r => r !== reason))
    } else {
      setSelectedReasons([...selectedReasons, reason])
    }
  }

  const triggerToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-20 space-y-16">

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-6 right-6 z-50 bg-neutral-900 text-white border border-neutral-800 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3"
          >
            <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Check className="w-4 h-4" />
            </div>
            <span className="text-sm font-bold">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Back Link */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          id="back-home-link"
          className="inline-flex items-center gap-2 text-neutral-500 hover:text-indigo-600 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>{t('common.back_to_home')}</span>
        </Link>
        <span className="text-[10px] font-black tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1 rounded-full uppercase border border-indigo-500/20">
          {t('marketing_v2.control_center_page.badge')}
        </span>
      </div>

      {/* Hero Section */}
      <section className="space-y-6 max-w-4xl">
        <h1 className="text-5xl md:text-7xl font-black tracking-tighter dark:text-white leading-[1]">
          {t('marketing_v2.control_center_page.title')} <br />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">
            {t('marketing_v2.control_center_page.title_highlight')}
          </span>
        </h1>
        <p className="text-xl text-neutral-500 dark:text-neutral-400 leading-relaxed font-medium">
          {t('marketing_v2.control_center_page.desc')}
        </p>
      </section>

      {/* Main Grid: Info Section & Simulator Mockup */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* Left Column: Feature Details */}
        <div className="lg:col-span-4 space-y-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-neutral-800 dark:text-neutral-200">
              {t('marketing_v2.control_center_page.interactive_title')}
            </h2>
            <p className="text-xs text-neutral-400">
              {t('marketing_v2.control_center_page.interactive_desc')}
            </p>
          </div>

          <div className="space-y-4">
            {/* 1. Dashboard BI Description */}
            <div
              onClick={() => setActiveTab('bi')}
              className={cn(
                "p-6 rounded-3xl border transition-all duration-300 cursor-pointer text-left space-y-3",
                activeTab === 'bi'
                  ? 'bg-indigo-500/10 border-indigo-500/30 shadow-lg'
                  : 'bg-white dark:bg-neutral-900/40 border-neutral-200 dark:border-neutral-800/80 hover:bg-neutral-50 dark:hover:bg-neutral-900/60'
              )}
            >
              <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400">
                <LayoutDashboard className="w-5 h-5" />
                <h3 className="font-bold text-base">Dashboard BI</h3>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Visão unificada das métricas vitais da sua empresa. Acompanhe licenças ativas, quantidade de workspaces criados, número de projetos e a distribuição de casos de uso por tipo (Cadastro, Consulta, Mestre-Detalhe).
              </p>
            </div>

            {/* 2. Produtividade & VAR Description */}
            <div
              onClick={() => setActiveTab('productivity')}
              className={cn(
                "p-6 rounded-3xl border transition-all duration-300 cursor-pointer text-left space-y-3",
                activeTab === 'productivity'
                  ? 'bg-purple-500/10 border-purple-500/30 shadow-lg'
                  : 'bg-white dark:bg-neutral-900/40 border-neutral-200 dark:border-neutral-800/80 hover:bg-neutral-50 dark:hover:bg-neutral-900/60'
              )}
            >
              <div className="flex items-center gap-3 text-purple-600 dark:text-purple-400">
                <Activity className="w-5 h-5" />
                <h3 className="font-bold text-base">O "VAR do Desenvolvimento"</h3>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                <strong>O coração da Central.</strong> Auditoria completa de sessões com linha do tempo visual interativa, rastreamento granular de eventos de configuração e navegação, e cálculo preciso de inatividade (gaps de tempo) entre cada ação dos desenvolvedores no Studio.
              </p>
            </div>

            {/* 3. Assinatura Description */}
            <div
              onClick={() => setActiveTab('subscription')}
              className={cn(
                "p-6 rounded-3xl border transition-all duration-300 cursor-pointer text-left space-y-3",
                activeTab === 'subscription'
                  ? 'bg-emerald-500/10 border-emerald-500/30 shadow-lg'
                  : 'bg-white dark:bg-neutral-900/40 border-neutral-200 dark:border-neutral-800/80 hover:bg-neutral-50 dark:hover:bg-neutral-900/60'
              )}
            >
              <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                <CreditCard className="w-5 h-5" />
                <h3 className="font-bold text-base">Assinatura & Faturamento</h3>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Gestão simplificada do seu plano de contratação. Veja os valores contratados, ciclos de renovação recorrente (semestral/anual), métodos de pagamento (Pix/Cartão) e baixe recibos de pagamento com um clique.
              </p>
            </div>

            {/* 4. Cancelamento Description */}
            <div
              onClick={() => setActiveTab('cancel')}
              className={cn(
                "p-6 rounded-3xl border transition-all duration-300 cursor-pointer text-left space-y-3",
                activeTab === 'cancel'
                  ? 'bg-rose-500/10 border-rose-500/30 shadow-lg'
                  : 'bg-white dark:bg-neutral-900/40 border-neutral-200 dark:border-neutral-800/80 hover:bg-neutral-50 dark:hover:bg-neutral-900/60'
              )}
            >
              <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
                <XCircle className="w-5 h-5" />
                <h3 className="font-bold text-base">Fluxo de Cancelamento Transparente</h3>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Formulário interativo whitelabel para feedback. Os usuários podem justificar sua saída através de múltiplos motivos de cancelamento estruturados e comentários adicionais antes da desativação no Asaas.
              </p>
            </div>

            {/* 5. MetaBuilders Description */}
            <div
              onClick={() => setActiveTab('community')}
              className={cn(
                "p-6 rounded-3xl border transition-all duration-300 cursor-pointer text-left space-y-3",
                activeTab === 'community'
                  ? 'bg-blue-500/10 border-blue-500/30 shadow-lg'
                  : 'bg-white dark:bg-neutral-900/40 border-neutral-200 dark:border-neutral-800/80 hover:bg-neutral-50 dark:hover:bg-neutral-900/60'
              )}
            >
              <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
                <Users className="w-5 h-5" />
                <h3 className="font-bold text-base">MetaBuilders - Rede Exclusiva</h3>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Hub de networking exclusivo para clientes. Conecte-se com Owners e Devs, compartilhe insights, troque experiências em tempo real e amplie suas conexões dentro do ecossistema MetaBuilderPRO.
              </p>
            </div>

            {/* MetaVoice Description */}
            <div
              onClick={() => setActiveTab('metavoice')}
              className={cn(
                "p-6 rounded-3xl border transition-all duration-300 cursor-pointer text-left space-y-3",
                activeTab === 'metavoice'
                  ? 'bg-amber-500/10 border-amber-500/30 shadow-lg'
                  : 'bg-white dark:bg-neutral-900/40 border-neutral-200 dark:border-neutral-800/80 hover:bg-neutral-50 dark:hover:bg-neutral-900/60'
              )}
            >
              <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
                <Lightbulb className="w-5 h-5" />
                <h3 className="font-bold text-base">MetaVoice - Sugestões & Feedback</h3>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Canal de feedback bidirecional integrado para a comunidade de clientes. Permite o envio de novas sugestões, votação de recursos e troca de comentários, permitindo priorizar o roadmap em tempo real.
              </p>
            </div>

            {/* 6. iClub Description */}
            <div
              onClick={() => setActiveTab('iclub')}
              className={cn(
                "p-6 rounded-3xl border transition-all duration-300 cursor-pointer text-left space-y-3",
                activeTab === 'iclub'
                  ? 'bg-indigo-500/10 border-indigo-500/30 shadow-lg'
                  : 'bg-white dark:bg-neutral-900/40 border-neutral-200 dark:border-neutral-800/80 hover:bg-neutral-50 dark:hover:bg-neutral-900/60'
              )}
            >
              <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400">
                <Zap className="w-5 h-5" />
                <h3 className="font-bold text-base">iClub - Vantagens e Fidelidade</h3>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Clube de benefícios e fidelidade integrado. Oferece descontos automáticos e acumulativos na fatura para indicações ativas (5% por indicado) e licenças grátis por volume contratado (ex: 12 licenças).
              </p>
            </div>

          </div>
        </div>

        {/* Right Column: Simulator Mockup Container */}
        <div className="lg:col-span-8 sticky top-24">
          <div className="relative rounded-[2.5rem] bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-2xl min-h-[550px] flex flex-col">

            {/* Mockup Window Header */}
            <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
              </div>
              <span className="text-[10px] font-black tracking-widest text-neutral-400 uppercase">
                Painel de Controle - Simulador
              </span>
              <div className="w-6"></div>
            </div>

            {/* Inner Dashboard Header */}
            <div className="bg-white dark:bg-neutral-950 p-6 border-b border-neutral-200 dark:border-neutral-800 text-left flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-neutral-800 dark:text-white leading-none">Painel de Controle</h3>
                  <span className="text-[10px] text-neutral-400 font-medium">Visão geral dos seus dados, assinatura e conta</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-[9px] font-extrabold tracking-wider uppercase self-start sm:self-auto">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                <span>Ativo</span>
              </div>
            </div>

            {/* Tabs Selector Bar */}
            <div className="bg-white dark:bg-neutral-950 px-4 py-2.5 border-b border-neutral-200 dark:border-neutral-800 flex flex-col md:flex-row md:items-center md:justify-between gap-2 shrink-0">
              {/* Left group */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setActiveTab('bi')}
                  className={cn(
                    "px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1",
                    activeTab === 'bi'
                      ? 'bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-white shadow-sm'
                      : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-900/40'
                  )}
                >
                  <LayoutDashboard className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                  <span>Dashboard BI</span>
                </button>
                <button
                  onClick={() => setActiveTab('productivity')}
                  className={cn(
                    "px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1",
                    activeTab === 'productivity'
                      ? 'bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-white shadow-sm'
                      : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-900/40'
                  )}
                >
                  <Activity className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
                  <span>Produtividade</span>
                </button>
                <button
                  onClick={() => setActiveTab('subscription')}
                  className={cn(
                    "px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1",
                    activeTab === 'subscription'
                      ? 'bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-white shadow-sm'
                      : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-900/40'
                  )}
                >
                  <CreditCard className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                  <span>Assinatura</span>
                </button>
                <button
                  onClick={() => setActiveTab('cancel')}
                  className={cn(
                    "px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1",
                    activeTab === 'cancel'
                      ? 'bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-white shadow-sm'
                      : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-900/40'
                  )}
                >
                  <XCircle className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                  <span>Cancelamento</span>
                </button>
              </div>

              {/* Right group: MetaVoice & iClub */}
              <div className="flex gap-1.5">
                <button
                  onClick={() => setActiveTab('community')}
                  className={cn(
                    "px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1",
                    activeTab === 'community'
                      ? 'bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-white shadow-sm'
                      : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-900/40'
                  )}
                >
                  <Users className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                  <span>MetaBuilders</span>
                </button>
                <button
                  onClick={() => setActiveTab('metavoice')}
                  className={cn(
                    "px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1",
                    activeTab === 'metavoice'
                      ? 'bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-white shadow-sm'
                      : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-900/40'
                  )}
                >
                  <Lightbulb className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                  <span>MetaVoice</span>
                </button>
                <button
                  onClick={() => setActiveTab('iclub')}
                  className={cn(
                    "px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1",
                    activeTab === 'iclub'
                      ? 'bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-white shadow-sm'
                      : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-900/40'
                  )}
                >
                  <Zap className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                  <span>iClub</span>
                </button>
              </div>
            </div>

            {/* Simulated Content Frame */}
            <div className="p-6 flex-grow overflow-y-auto max-h-[480px]">

              {/* TAB 1: DASHBOARD BI */}
              {activeTab === 'bi' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-6 text-left"
                >
                  {/* Cards Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-4 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col items-center justify-between text-center min-h-[110px]">
                      <span className="text-[9px] font-black uppercase text-neutral-400">Licenças</span>
                      <div className="relative w-16 h-8 flex items-end justify-center overflow-hidden">
                        <svg className="w-full h-full" viewBox="0 0 60 30">
                          <path d="M 5,30 A 25,25 0 0,1 55,30" fill="none" stroke="#e5e7eb" strokeWidth="6" className="dark:stroke-neutral-800" />
                          <path d="M 5,30 A 25,25 0 0,1 55,30" fill="none" stroke="#10b981" strokeWidth="6" strokeDasharray="78" strokeDashoffset="26" />
                        </svg>
                        <span className="absolute bottom-0 text-xs font-black dark:text-white">2 <span className="text-[10px] text-neutral-400 font-bold">/ 3</span></span>
                      </div>
                      <span className="text-[8px] text-neutral-400 font-bold leading-none">Usuários ativos</span>
                    </div>

                    <div className="p-4 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col items-center justify-between text-center min-h-[110px]">
                      <span className="text-[9px] font-black uppercase text-neutral-400">Workspaces</span>
                      <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                        <Users className="w-4 h-4" />
                      </div>
                      <h4 className="text-lg font-black dark:text-white leading-none">1</h4>
                      <span className="text-[8px] text-neutral-400 font-bold leading-none">Ambiente criado</span>
                    </div>

                    <div className="p-4 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col items-center justify-between text-center min-h-[110px]">
                      <span className="text-[9px] font-black uppercase text-neutral-400">Projetos</span>
                      <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                        <FileText className="w-4 h-4" />
                      </div>
                      <h4 className="text-lg font-black dark:text-white leading-none">1</h4>
                      <span className="text-[8px] text-neutral-400 font-bold leading-none">Em todos workspaces</span>
                    </div>

                    <div className="p-4 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col items-center justify-between text-center min-h-[110px]">
                      <span className="text-[9px] font-black uppercase text-neutral-400">Casos de Uso</span>
                      <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <Layout className="w-4 h-4" />
                      </div>
                      <h4 className="text-lg font-black dark:text-white leading-none">3</h4>
                      <span className="text-[8px] text-neutral-400 font-bold leading-none">Telas funcionais</span>
                    </div>
                  </div>

                  {/* Horizon Charts grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-3">
                      <h5 className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Projetos por Workspace</h5>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-neutral-700 dark:text-neutral-300">
                          <span>AGTech</span>
                          <span>1</span>
                        </div>
                        <div className="w-full h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500 w-full"></div>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-3">
                      <h5 className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Casos de Uso por Projeto</h5>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-neutral-700 dark:text-neutral-300">
                          <span>Build Flow</span>
                          <span>3</span>
                        </div>
                        <div className="w-full h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 w-full"></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Donut Chart & Details Table */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Donut Chart */}
                    <div className="p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col items-center justify-between min-h-[180px]">
                      <h5 className="text-[10px] font-black uppercase text-neutral-400 tracking-wider w-full">Casos de Uso por Tipo</h5>

                      <div className="relative w-20 h-20 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                          {/* Mestre-Detalhe (orange) */}
                          <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f59e0b" strokeWidth="4" strokeDasharray="33.3 100" strokeDashoffset="0" />
                          {/* Cadastro (green) */}
                          <circle cx="18" cy="18" r="15.915" fill="none" stroke="#10b981" strokeWidth="4" strokeDasharray="33.3 100" strokeDashoffset="-33.3" />
                          {/* Analytios (blue) */}
                          <circle cx="18" cy="18" r="15.915" fill="none" stroke="#6366f1" strokeWidth="4" strokeDasharray="33.4 100" strokeDashoffset="-66.6" />
                        </svg>
                        <span className="absolute text-[10px] font-black dark:text-white">3</span>
                      </div>

                      <div className="flex gap-2 flex-wrap text-[8px] font-black uppercase text-neutral-400 justify-center">
                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>Consulta</span>
                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Cadastro</span>
                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>Mestre</span>
                      </div>
                    </div>

                    {/* Table workspace */}
                    <div className="sm:col-span-2 p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-3">
                      <h5 className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Detalhamento por Workspace</h5>

                      <div className="border border-neutral-100 dark:border-neutral-800 rounded-xl overflow-hidden bg-neutral-50/50 dark:bg-neutral-900/10">
                        <table className="w-full text-left border-collapse text-[10px]">
                          <thead>
                            <tr className="bg-neutral-100 dark:bg-neutral-900/60 border-b border-neutral-200 dark:border-neutral-800 text-[8px] font-black uppercase text-neutral-400 tracking-wider">
                              <th className="px-3 py-2">Workspace</th>
                              <th className="px-3 py-2 text-center">Projetos</th>
                              <th className="px-3 py-2 text-center">Casos</th>
                              <th className="px-3 py-2 text-center">Usuários</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-neutral-700 dark:text-neutral-300">
                            {biWorkspaces.map((ws, i) => (
                              <tr key={i} className="hover:bg-neutral-100/50 dark:hover:bg-neutral-900/20">
                                <td className="px-3 py-2.5 font-bold flex items-center gap-1.5">
                                  <span className="w-4 h-4 rounded bg-indigo-500/10 text-indigo-500 flex items-center justify-center text-[8px] font-black">AG</span>
                                  <span>{ws.name}</span>
                                </td>
                                <td className="px-3 py-2.5 text-center font-bold">{ws.projects}</td>
                                <td className="px-3 py-2.5 text-center font-bold">{ws.cases}</td>
                                <td className="px-3 py-2.5 text-center font-bold">{ws.users}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB: COMMUNITY PRO */}
              {activeTab === 'community' && (
                <CommunityHubView />
              )}

              {/* TAB 2: PRODUTIVIDADE */}
              {activeTab === 'productivity' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-6 text-left relative"
                >
                  {/* Filters bar */}
                  <div className="p-3 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-wrap gap-3 items-center text-xs">
                    <span className="text-[9px] font-black uppercase text-neutral-400 tracking-wider">Filtros:</span>
                    <div className="flex gap-2">
                      <select
                        value={selectedProject}
                        onChange={(e) => setSelectedProject(e.target.value)}
                        className="px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-[10px] font-bold outline-none text-neutral-700 dark:text-neutral-300"
                      >
                        <option value="All">Todos os Projetos</option>
                      </select>
                      <select
                        value={selectedDev}
                        onChange={(e) => setSelectedDev(e.target.value)}
                        className="px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-[10px] font-bold outline-none text-neutral-700 dark:text-neutral-300"
                      >
                        <option value="All">Todos os Profissionais</option>
                      </select>
                      <select
                        value={selectedPeriod}
                        onChange={(e) => setSelectedPeriod(e.target.value)}
                        className="px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-[10px] font-bold outline-none text-neutral-700 dark:text-neutral-300"
                      >
                        <option value="All">Todo o Período</option>
                      </select>
                    </div>
                  </div>

                  {/* Sub-tabs Selector for Productivity */}
                  <div className="flex gap-2 p-1 bg-neutral-100 dark:bg-neutral-950 rounded-xl border border-neutral-200 dark:border-neutral-800 w-fit shrink-0">
                    <button
                      onClick={() => setSimulatedProdSubTab('summary')}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200',
                        simulatedProdSubTab === 'summary'
                          ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                          : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                      )}
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Resumo por DEV</span>
                    </button>
                    <button
                      onClick={() => setSimulatedProdSubTab('detailed')}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200',
                        simulatedProdSubTab === 'detailed'
                          ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                          : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                      )}
                    >
                      <Activity className="w-3.5 h-3.5" />
                      <span>Detalhado por DEV</span>
                    </button>
                  </div>

                  {/* Simulated Content Panel */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={simulatedProdSubTab}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.15 }}
                      className="space-y-6"
                    >
                      {simulatedProdSubTab === 'summary' ? (
                        <div className="space-y-6">
                          {/* Summary Metric Cards */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl space-y-3 shadow-sm flex flex-col justify-between min-h-[110px]">
                              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                                <Clock className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Tempo Ativo Total</span>
                                <h4 className="text-xl font-black dark:text-white mt-0.5">6 min</h4>
                                <p className="text-[9px] text-neutral-400 font-bold mt-1">Tempo gasto construindo na plataforma</p>
                              </div>
                            </div>

                            <div className="p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl space-y-3 shadow-sm flex flex-col justify-between min-h-[110px]">
                              <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                                <Activity className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Ações Realizadas</span>
                                <h4 className="text-xl font-black dark:text-white mt-0.5">8</h4>
                                <p className="text-[9px] text-neutral-400 font-bold mt-1">Interações com o Studio</p>
                              </div>
                            </div>
                          </div>

                          {/* Produtividade por profissional */}
                          <div className="p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl space-y-4 shadow-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
                                <Users className="w-3.5 h-3.5" />
                              </div>
                              <h5 className="text-[10px] font-bold text-neutral-800 dark:text-white uppercase tracking-wider">Produtividade por Profissional</h5>
                            </div>

                            <div className="p-4 bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-100 dark:border-neutral-800 rounded-2xl max-w-xs space-y-3">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[9px] font-black">A</div>
                                <span className="text-xs font-bold dark:text-white">Alexandre Moura</span>
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-[10px] text-neutral-500 border-t border-neutral-100 dark:border-neutral-800 pt-2.5">
                                <div>
                                  <span className="text-[8px] font-black text-neutral-400 block uppercase">Tempo Ativo</span>
                                  <span className="font-bold text-neutral-800 dark:text-neutral-300">6m</span>
                                </div>
                                <div>
                                  <span className="text-[8px] font-black text-neutral-400 block uppercase">Ações</span>
                                  <span className="font-bold text-neutral-800 dark:text-neutral-300">8</span>
                                </div>
                                <div>
                                  <span className="text-[8px] font-black text-neutral-400 block uppercase font-bold">Sessões</span>
                                  <span className="font-bold text-neutral-800 dark:text-neutral-300">1</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Audit logs table */
                        <div className="p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl space-y-4 shadow-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
                              <Activity className="w-3.5 h-3.5" />
                            </div>
                            <h5 className="text-[10px] font-bold text-neutral-800 dark:text-white uppercase tracking-wider">Logs de Atividade Detalhados</h5>
                          </div>

                          <div className="border border-neutral-100 dark:border-neutral-800 rounded-xl overflow-hidden bg-neutral-50/50 dark:bg-neutral-900/10">
                            <table className="w-full text-left border-collapse text-[10px]">
                              <thead>
                                <tr className="bg-neutral-100 dark:bg-neutral-900/60 border-b border-neutral-200 dark:border-neutral-800 text-[8px] font-black uppercase text-neutral-400 tracking-wider">
                                  <th className="px-3 py-2">Profissional</th>
                                  <th className="px-3 py-2 hidden sm:table-cell">Início da Sessão</th>
                                  <th className="px-3 py-2">Tempo Ativo</th>
                                  <th className="px-3 py-2 text-center">Ações</th>
                                  <th className="px-3 py-2 text-right">Ação</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-neutral-700 dark:text-neutral-300">
                                <tr className="hover:bg-neutral-100/50 dark:hover:bg-neutral-900/20">
                                  <td className="px-3 py-2 font-bold">Alexandre Moura</td>
                                  <td className="px-3 py-2 hidden sm:table-cell font-mono text-[9px]">26/05/2026, 22:51:05</td>
                                  <td className="px-3 py-2 font-bold font-mono">6m 33s</td>
                                  <td className="px-3 py-2 text-center font-bold">8</td>
                                  <td className="px-3 py-2 text-right">
                                    <button
                                      onClick={() => {
                                        setActiveDetailedLog('session2')
                                        setIsDetailedLogOpen(true)
                                      }}
                                      className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-350 font-bold hover:underline"
                                    >
                                      Ver log detalhado
                                    </button>
                                  </td>
                                </tr>
                                <tr className="hover:bg-neutral-100/50 dark:hover:bg-neutral-900/20">
                                  <td className="px-3 py-2 font-bold">Alexandre Moura</td>
                                  <td className="px-3 py-2 hidden sm:table-cell font-mono text-[9px]">26/05/2026, 19:05:50</td>
                                  <td className="px-3 py-2 font-bold font-mono">0m 8s</td>
                                  <td className="px-3 py-2 text-center font-bold">2</td>
                                  <td className="px-3 py-2 text-right">
                                    <button
                                      onClick={() => {
                                        setActiveDetailedLog('session1')
                                        setIsDetailedLogOpen(true)
                                      }}
                                      className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-350 font-bold hover:underline"
                                    >
                                      Ver log detalhado
                                    </button>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>

                  {/* Code-style Audit Log pop-up overlay simulator */}
                  <AnimatePresence>
                    {isDetailedLogOpen && (
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-30 rounded-2xl overflow-hidden flex items-center justify-center p-4">
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className={cn(
                            "w-full max-w-md rounded-2xl border flex flex-col justify-between shadow-2xl transition-colors duration-300 h-[92%] max-h-[430px] overflow-hidden",
                            detailedLogTheme === 'dark'
                              ? 'bg-neutral-950 border-neutral-800 text-neutral-300'
                              : 'bg-white border-neutral-200 text-neutral-700'
                          )}
                        >
                          {/* Audit header */}
                          <div className={cn(
                            "px-4 py-3 border-b flex items-center justify-between shrink-0",
                            detailedLogTheme === 'dark' ? 'border-neutral-800 bg-neutral-900/60' : 'border-neutral-200 bg-neutral-50/60'
                          )}>
                            <div className="flex flex-col text-left">
                              <span className="text-[10px] font-black uppercase tracking-wider dark:text-white">
                                Detalhes do Log de Atividade
                              </span>
                              <span className="text-[8px] text-neutral-400 dark:text-neutral-500 font-medium">
                                Sessão iniciada em {mockDetailedLogs[activeDetailedLog].start}
                              </span>
                            </div>

                            {/* Controls: Theme Toggle & Close */}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setDetailedLogTheme(detailedLogTheme === 'dark' ? 'light' : 'dark')}
                                className={cn(
                                  "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider transition-colors",
                                  detailedLogTheme === 'dark' ? 'bg-neutral-800 hover:bg-neutral-700 text-indigo-400' : 'bg-neutral-100 hover:bg-neutral-200 text-indigo-600'
                                )}
                              >
                                {detailedLogTheme === 'dark' ? 'Tema Claro' : 'Tema Escuro'}
                              </button>
                              <button
                                onClick={handleCloseSimulatedLog}
                                className="text-[10px] font-black text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 ml-1"
                              >
                                ✕
                              </button>
                            </div>
                          </div>

                          {/* Sub-tabs inside Simulated Modal */}
                          <div className={cn(
                            "flex items-center justify-between border-b px-4 py-2 gap-2 shrink-0",
                            detailedLogTheme === 'dark' ? 'border-neutral-800 bg-neutral-950' : 'border-neutral-100 bg-white'
                          )}>
                            <div className="flex gap-1 p-0.5 bg-neutral-100 dark:bg-neutral-950 rounded-lg border border-neutral-200/50 dark:border-neutral-800 w-fit">
                              <button
                                onClick={() => setSimulatedModalTab('visual')}
                                className={cn(
                                  'flex items-center gap-1 px-2 py-1 rounded text-[8px] font-bold transition-all duration-200',
                                  simulatedModalTab === 'visual'
                                    ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                                    : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                                )}
                              >
                                <Activity className="w-2.5 h-2.5" />
                                <span>Linha do Tempo</span>
                              </button>
                              <button
                                onClick={() => setSimulatedModalTab('raw')}
                                className={cn(
                                  'flex items-center gap-1 px-2 py-1 rounded text-[8px] font-bold transition-all duration-200',
                                  simulatedModalTab === 'raw'
                                    ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                                    : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                                )}
                              >
                                <Code className="w-2.5 h-2.5" />
                                <span>JSON Bruto</span>
                              </button>
                            </div>

                            {simulatedModalTab === 'raw' && (
                              <div className="flex items-center gap-1 animate-in fade-in zoom-in-95 duration-150">
                                <button
                                  onClick={() => handleSimulatedCopyJson(mockDetailedLogs[activeDetailedLog].actions)}
                                  className={cn(
                                    "flex items-center gap-1 px-2 py-0.5 text-[8px] font-bold rounded border transition-colors",
                                    detailedLogTheme === 'dark'
                                      ? "bg-neutral-800 hover:bg-neutral-800 border-neutral-700 text-neutral-300"
                                      : "bg-neutral-50 hover:bg-neutral-100 border-neutral-200 text-neutral-600"
                                  )}
                                >
                                  {simulatedCopied ? (
                                    <>
                                      <Check className="w-2.5 h-2.5 text-emerald-500" />
                                      <span className="text-emerald-500">Copiado!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-2.5 h-2.5" />
                                      <span>Copiar</span>
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={() => handleSimulatedDownloadJson(mockDetailedLogs[activeDetailedLog].actions)}
                                  className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[8px] font-bold rounded border border-indigo-100 dark:border-indigo-900/50 transition-colors"
                                >
                                  <Download className="w-2.5 h-2.5" />
                                  <span>Exportar</span>
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Content Frame */}
                          <div className="flex-grow overflow-y-auto custom-scrollbar p-4 text-left min-h-0">
                            {simulatedModalTab === 'visual' ? (
                              <div className={cn(
                                "relative border-l ml-2 pl-4 space-y-4",
                                detailedLogTheme === 'dark' ? "border-neutral-800" : "border-neutral-200"
                              )}>
                                {mockDetailedLogs[activeDetailedLog].actions.map((event: any, idx: number) => {
                                  const normalized = String(event.action || '').toUpperCase()
                                  let icon = Activity
                                  let color = {
                                    bg: detailedLogTheme === 'dark'
                                      ? 'bg-neutral-500/10 text-neutral-400 border border-neutral-800'
                                      : 'bg-neutral-500/10 text-neutral-600 border border-neutral-200',
                                    badge: detailedLogTheme === 'dark'
                                      ? 'bg-neutral-550/10 border-neutral-800 text-neutral-400'
                                      : 'bg-neutral-100 border-neutral-200 text-neutral-600',
                                    label: 'Ação'
                                  }

                                  if (normalized === 'CONFIG_CHANGE') {
                                    icon = Sliders
                                    color = {
                                      bg: 'bg-amber-500/10 text-amber-500 border border-amber-500/20',
                                      badge: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
                                      label: 'Configuração'
                                    }
                                  } else if (normalized === 'NAVIGATION') {
                                    icon = Compass
                                    color = {
                                      bg: 'bg-blue-500/10 text-blue-500 border border-blue-500/20',
                                      badge: 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400',
                                      label: 'Navegação'
                                    }
                                  } else if (normalized === 'SESSION_START') {
                                    icon = Clock
                                    color = {
                                      bg: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
                                      badge: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
                                      label: 'Início'
                                    }
                                  }

                                  const IconComponent = icon
                                  const eventTime = new Date(event.time)
                                  const formattedTime = isNaN(eventTime.getTime()) ? '18:48:35' : eventTime.toLocaleTimeString('pt-BR', { hour12: false })

                                  return (
                                    <div key={idx} className="relative">
                                      {/* Dot / Icon */}
                                      <div className={cn(
                                        "absolute -left-[25px] top-0.5 w-5 h-5 rounded-full flex items-center justify-center shadow-sm",
                                        color.bg,
                                        detailedLogTheme === 'dark' ? "bg-neutral-950" : "bg-white"
                                      )}>
                                        <IconComponent className="w-2.5 h-2.5" />
                                      </div>

                                      {/* Event Content */}
                                      <div className={cn(
                                        "border rounded-xl p-2.5 transition-colors",
                                        detailedLogTheme === 'dark'
                                          ? "bg-neutral-900/40 border-neutral-800 hover:border-neutral-800"
                                          : "bg-neutral-50/50 border-neutral-100 hover:border-neutral-200"
                                      )}>
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                          <div className="flex items-center gap-1.5">
                                            <span className={cn(
                                              "px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-wider border leading-none",
                                              color.badge
                                            )}>
                                              {color.label}
                                            </span>
                                          </div>
                                          <span className="text-[7px] text-neutral-400 dark:text-neutral-500 font-mono">
                                            {formattedTime}
                                          </span>
                                        </div>

                                        <div className="flex items-center justify-between gap-2 mt-1">
                                          <p className={cn(
                                            "text-[9px] font-bold leading-snug",
                                            detailedLogTheme === 'dark' ? "text-neutral-200" : "text-neutral-700"
                                          )}>
                                            {event.detail}
                                          </p>
                                          {event.gap && (
                                            <div className={cn(
                                              "flex items-center gap-0.5 px-1 py-0.2 rounded border shrink-0 leading-none",
                                              event.gap === 'START'
                                                ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                                : "bg-neutral-200/50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-800 text-neutral-550 dark:text-neutral-400"
                                            )}>
                                              <span className="text-[7px] font-black font-mono tracking-wider">
                                                {event.gap}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            ) : (
                              <div className={cn(
                                "border rounded-xl p-3 overflow-x-auto h-full overflow-y-auto custom-scrollbar text-left",
                                detailedLogTheme === 'dark' ? "bg-neutral-950 border-neutral-800" : "bg-neutral-50 border-neutral-200"
                              )}>
                                <pre className="text-[8px] font-mono whitespace-pre-wrap leading-tight">
                                  {JSON.stringify(mockDetailedLogs[activeDetailedLog].actions, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>

                          {/* Footer */}
                          <div className={cn(
                            "px-4 py-2.5 border-t text-right shrink-0",
                            detailedLogTheme === 'dark' ? 'border-neutral-800 bg-neutral-900/20' : 'border-neutral-100 bg-neutral-50'
                          )}>
                            <button
                              onClick={handleCloseSimulatedLog}
                              className={cn(
                                "px-3 py-1 text-[9px] font-bold rounded-lg transition-colors",
                                detailedLogTheme === 'dark'
                                  ? "bg-neutral-800 hover:bg-neutral-700 text-white"
                                  : "bg-neutral-100 hover:bg-neutral-200 text-neutral-800"
                              )}
                            >
                              Fechar
                            </button>
                          </div>
                        </motion.div>
                      </div>
                    )}
                  </AnimatePresence>

                </motion.div>
              )}

              {/* TAB 3: ASSINATURA */}
              {activeTab === 'subscription' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-6 text-left relative"
                >
                  {/* Plan Summary & Card on file */}
                  <div className="p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 dark:border-neutral-800 pb-3">
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-widest text-neutral-800 dark:text-white">
                          Resumo da Assinatura
                        </h4>
                        <p className="text-[10px] text-neutral-400 mt-0.5">Status do plano ativo e ciclo contratado</p>
                      </div>

                      {/* Masked Card Details */}
                      <div>
                        {simulatedCardBrand && simulatedCardDigits ? (
                          <div className="flex items-center gap-2.5 px-3 py-1.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-[10px] font-bold">
                            <CreditCard className="w-3.5 h-3.5 text-indigo-500" />
                            <span className="text-neutral-700 dark:text-neutral-300 uppercase">
                              {simulatedCardBrand} •••• {simulatedCardDigits}
                            </span>
                            <button
                              onClick={() => {
                                setSimulatedCardForm(prev => ({
                                  ...prev,
                                  billingEmail: 'contato@agtech.com.br',
                                  billingName: 'Alexandre Moura'
                                }))
                                setShowSimulatedCardModal(true)
                              }}
                              className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline ml-1.5"
                            >
                              Alterar
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setSimulatedCardForm(prev => ({
                                ...prev,
                                billingEmail: 'contato@agtech.com.br',
                                billingName: 'Alexandre Moura'
                              }))
                              setShowSimulatedCardModal(true)
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-200 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-800 dark:text-white text-[10px] font-bold rounded-xl border border-neutral-200 dark:border-neutral-700 transition-colors"
                          >
                            <CreditCard className="w-3.5 h-3.5 text-neutral-500" /> Adicionar Cartão Salvo
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                      {/* Plan */}
                      <div className="p-4 bg-indigo-600/5 dark:bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-left space-y-1">
                        <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">Plano Atual</span>
                        <h5 className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                          {simulatedPlans.find(p => p.id === simulatedPlanId)?.name}
                        </h5>
                        <p className="text-[9px] font-bold text-neutral-500">
                          {formatSimulatedPrice(getSimulatedPlanPrice(simulatedPlanId, simulatedCycle))} / {getSimulatedCycleLabel(simulatedCycle).toLowerCase()}
                        </p>
                      </div>

                      {/* Cycle */}
                      <div className="p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-left space-y-1">
                        <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">Ciclo</span>
                        <h5 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                          {getSimulatedCycleLabel(simulatedCycle)}
                        </h5>
                        <p className="text-[9px] text-neutral-400 font-bold">Renovação recorrente</p>
                      </div>

                      {/* Status */}
                      <div className="p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-left space-y-1">
                        <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">Status</span>
                        <h5 className="text-sm font-bold text-emerald-500 flex items-center gap-1">✓ Ativo</h5>
                        <p className="text-[9px] text-neutral-400 font-bold">Operação normal</p>
                      </div>

                      {/* Next Renewal */}
                      <div className="p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-left space-y-1">
                        <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">Próxima Renovação</span>
                        <h5 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">23/11/2026</h5>
                        <p className="text-[9px] text-neutral-400 font-bold">Cobrança recorrente</p>
                      </div>
                    </div>

                    <div className="pt-2 text-[10px] text-neutral-500 flex flex-wrap gap-x-6 gap-y-1 font-mono">
                      <span><strong>ÚLTIMO PAGAMENTO:</strong> {formatSimulatedPrice(getSimulatedPlanPrice(simulatedPlanId, simulatedCycle))}</span>
                      <span><strong>DATA:</strong> 23/05/2026</span>
                      <span><strong>FORMA DE PAGAMENTO:</strong> {simulatedCardBrand ? 'Cartão de Crédito' : 'Pix'}</span>
                    </div>
                  </div>

                  {/* Plan & Cycle Switcher (Upgrade/Downgrade Section) */}
                  <div className="p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl space-y-4">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-neutral-800 dark:text-white">Alterar Plano ou Ciclo</h3>
                      <p className="text-[10px] text-neutral-400 mt-0.5">Troque de plano ou ciclo de faturamento instantaneamente</p>
                    </div>

                    {/* Billing Cycle Selector Buttons */}
                    <div className="flex flex-wrap gap-2 p-1 bg-neutral-100 dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 w-fit">
                      {(['monthly', 'quarterly', 'semiannual', 'yearly'] as const).map(c => {
                        const discountLabels: Record<string, string> = {
                          quarterly: '-10%',
                          semiannual: '-15%',
                          yearly: '-20%',
                        }
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setSelectedSimulatedCycle(c)}
                            className={cn(
                              'px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1',
                              selectedSimulatedCycle === c
                                ? 'bg-white dark:bg-neutral-800 text-neutral-800 dark:text-white shadow-sm'
                                : 'text-neutral-550 hover:text-neutral-700 dark:hover:text-neutral-300'
                            )}
                          >
                            <span>{getSimulatedCycleLabel(c)}</span>
                            {discountLabels[c] && (
                              <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[8px] font-black leading-none">
                                {discountLabels[c]}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>

                    {/* Plans Selector Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {simulatedPlans.map(p => {
                        const isCurrent = p.id === simulatedPlanId && selectedSimulatedCycle === simulatedCycle
                        const isSelected = p.id === selectedSimulatedPlanId

                        let displayPrice = p.price
                        if (selectedSimulatedCycle === 'monthly') displayPrice = p.price_monthly
                        else if (selectedSimulatedCycle === 'quarterly') displayPrice = p.price_quarterly / 3
                        else if (selectedSimulatedCycle === 'semiannual') displayPrice = p.price_semiannually / 6
                        else if (selectedSimulatedCycle === 'yearly') displayPrice = p.price_yearly / 12

                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setSelectedSimulatedPlanId(p.id)}
                            className={cn(
                              'p-4 rounded-xl border text-left transition-all flex flex-col justify-between gap-3 outline-none',
                              isSelected
                                ? 'bg-indigo-50/5 dark:bg-indigo-500/5 border-indigo-500 shadow-md ring-1 ring-indigo-500'
                                : 'bg-neutral-50 dark:bg-neutral-900/40 hover:bg-neutral-100 dark:hover:bg-neutral-900/60 border-neutral-200 dark:border-neutral-800'
                            )}
                          >
                            <div className="space-y-1 w-full">
                              <div className="flex items-center justify-between">
                                <h4 className="text-[10px] font-black text-neutral-800 dark:text-white uppercase tracking-wider">{p.name}</h4>
                                {isCurrent && (
                                  <span className="px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[8px] font-black uppercase tracking-wider shrink-0">
                                    Ativo
                                  </span>
                                )}
                              </div>
                              <p className="text-[9px] text-neutral-400">Até {p.licenses_count} {p.licenses_count === 1 ? 'licença ativa' : 'licenças ativas'}</p>
                            </div>

                            <div className="w-full">
                              <div className="flex items-baseline gap-0.5">
                                <span className="text-base font-black text-neutral-800 dark:text-white">{formatSimulatedPrice(displayPrice)}</span>
                                <span className="text-[8px] text-neutral-400 font-bold">/mês</span>
                              </div>
                              {selectedSimulatedCycle !== 'monthly' && (
                                <p className="text-[8px] text-neutral-400 mt-0.5 leading-normal">
                                  Cobrado {formatSimulatedPrice(
                                    selectedSimulatedCycle === 'quarterly' ? p.price_quarterly :
                                      selectedSimulatedCycle === 'semiannual' ? p.price_semiannually : p.price_yearly
                                  )} ao contratar
                                </p>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>

                    {/* Trigger to show inline modal */}
                    {(selectedSimulatedPlanId !== simulatedPlanId || selectedSimulatedCycle !== simulatedCycle) && (
                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => setShowSimulatedPlanConfirmModal(true)}
                          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black shadow-lg shadow-indigo-500/10 transition-all flex items-center gap-1.5"
                        >
                          <Zap className="w-3.5 h-3.5 fill-white" />
                          Confirmar Nova Assinatura
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Invoice table */}
                  <div className="p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl space-y-3">
                    <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-2">
                      <h4 className="text-xs font-black uppercase tracking-widest text-neutral-800 dark:text-white">
                        Histórico de Faturamento
                      </h4>
                      <span className="px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-900 text-[8px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                        1 transação
                      </span>
                    </div>

                    <div className="border border-neutral-100 dark:border-neutral-800 rounded-xl overflow-hidden bg-neutral-50/50 dark:bg-neutral-900/10">
                      <table className="w-full text-left border-collapse text-[10px]">
                        <thead>
                          <tr className="bg-neutral-100 dark:bg-neutral-900/60 border-b border-neutral-200 dark:border-neutral-800 text-[8px] font-black uppercase text-neutral-400 tracking-wider">
                            <th className="px-3 py-2">Data</th>
                            <th className="px-3 py-2">Ciclo</th>
                            <th className="px-3 py-2">Valor</th>
                            <th className="px-3 py-2">Método</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2 text-right">Comprovante</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-neutral-700 dark:text-neutral-300">
                          <tr className="hover:bg-neutral-100/50 dark:hover:bg-neutral-900/20">
                            <td className="px-3 py-2.5 font-bold font-mono">23/05/2026</td>
                            <td className="px-3 py-2.5 font-bold">{getSimulatedCycleLabel(simulatedCycle)}</td>
                            <td className="px-3 py-2.5 font-bold font-mono text-indigo-600 dark:text-indigo-400">
                              {formatSimulatedPrice(getSimulatedPlanPrice(simulatedPlanId, simulatedCycle))}
                            </td>
                            <td className="px-3 py-2.5 font-medium">{simulatedCardBrand ? 'Cartão de Crédito' : 'Pix'}</td>
                            <td className="px-3 py-2.5">
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase">Ativo</span>
                            </td>
                            <td className="px-3 py-2.5 text-right font-bold">
                              <button
                                onClick={() => triggerToast('Carregando comprovante em PDF...')}
                                className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-350 flex items-center justify-end gap-1"
                              >
                                <span>Recibo</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Simulated Modal Overlay for Credit Card Update */}
                  <AnimatePresence>
                    {showSimulatedCardModal && (
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-30 rounded-2xl overflow-hidden flex items-center justify-center p-4">
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 shadow-2xl flex flex-col max-h-[92%] overflow-hidden"
                        >
                          <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/60 flex items-center justify-between shrink-0">
                            <div className="flex flex-col text-left">
                              <span className="text-[10px] font-black uppercase tracking-wider dark:text-white">
                                Atualizar Cartão de Crédito (Simulado)
                              </span>
                              <span className="text-[8px] text-neutral-400 font-medium">
                                Configure os dados simulados para a renovação de sua assinatura
                              </span>
                            </div>
                            <button
                              onClick={() => setShowSimulatedCardModal(false)}
                              className="text-[10px] font-black text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                            >
                              ✕
                            </button>
                          </div>

                          <form onSubmit={handleSimulatedCardSubmit} className="p-4 space-y-4 overflow-y-auto custom-scrollbar flex-grow text-left">
                            <div className="space-y-3">
                              <h5 className="text-[9px] font-black uppercase tracking-widest text-indigo-500 border-b border-neutral-100 dark:border-neutral-800 pb-1">Dados do Cartão</h5>

                              <div className="space-y-1">
                                <label className="text-[8px] font-black uppercase text-neutral-400">Número do Cartão</label>
                                <input
                                  type="text"
                                  required
                                  placeholder="4000 1234 5678 9010"
                                  value={simulatedCardForm.cardNumber}
                                  onChange={e => setSimulatedCardForm(prev => ({ ...prev, cardNumber: e.target.value }))}
                                  className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-2.5 py-2 text-[11px] focus:border-indigo-500 focus:outline-none text-neutral-800 dark:text-white"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[8px] font-black uppercase text-neutral-400">Nome no Cartão</label>
                                <input
                                  type="text"
                                  required
                                  placeholder="ALEXANDRE MOURA"
                                  value={simulatedCardForm.cardName}
                                  onChange={e => setSimulatedCardForm(prev => ({ ...prev, cardName: e.target.value.toUpperCase() }))}
                                  className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-2.5 py-2 text-[11px] focus:border-indigo-500 focus:outline-none text-neutral-800 dark:text-white"
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <label className="text-[8px] font-black uppercase text-neutral-400">Validade (MM/AA)</label>
                                  <input
                                    type="text"
                                    required
                                    placeholder="12/30"
                                    value={simulatedCardForm.cardExpiry}
                                    onChange={e => setSimulatedCardForm(prev => ({ ...prev, cardExpiry: e.target.value }))}
                                    className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-2.5 py-2 text-[11px] focus:border-indigo-500 focus:outline-none text-neutral-800 dark:text-white"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[8px] font-black uppercase text-neutral-400">CVV</label>
                                  <input
                                    type="text"
                                    required
                                    placeholder="123"
                                    value={simulatedCardForm.cardCvv}
                                    onChange={e => setSimulatedCardForm(prev => ({ ...prev, cardCvv: e.target.value }))}
                                    className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-2.5 py-2 text-[11px] focus:border-indigo-500 focus:outline-none text-neutral-800 dark:text-white"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="space-y-3 pt-2">
                              <h5 className="text-[9px] font-black uppercase tracking-widest text-indigo-500 border-b border-neutral-100 dark:border-neutral-800 pb-1">Titular e Endereço</h5>

                              <div className="space-y-1">
                                <label className="text-[8px] font-black uppercase text-neutral-400">Nome Completo</label>
                                <input
                                  type="text"
                                  required
                                  value={simulatedCardForm.billingName}
                                  onChange={e => setSimulatedCardForm(prev => ({ ...prev, billingName: e.target.value }))}
                                  className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-2.5 py-2 text-[11px] focus:border-indigo-500 focus:outline-none text-neutral-800 dark:text-white"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[8px] font-black uppercase text-neutral-400">E-mail de Faturamento</label>
                                <input
                                  type="email"
                                  required
                                  value={simulatedCardForm.billingEmail}
                                  onChange={e => setSimulatedCardForm(prev => ({ ...prev, billingEmail: e.target.value }))}
                                  className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-2.5 py-2 text-[11px] focus:border-indigo-500 focus:outline-none text-neutral-800 dark:text-white"
                                />
                              </div>
                            </div>

                            <div className="flex gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800 shrink-0">
                              <button
                                type="button"
                                onClick={() => setShowSimulatedCardModal(false)}
                                className="flex-1 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-[10px] font-bold rounded-xl transition-colors"
                              >
                                Cancelar
                              </button>
                              <button
                                type="submit"
                                disabled={isSimulatingCardUpdate}
                                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-[10px] font-bold rounded-xl transition-all flex items-center justify-center gap-1.5"
                              >
                                {isSimulatingCardUpdate ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin" /> Salvando...
                                  </>
                                ) : (
                                  'Salvar Cartão'
                                )}
                              </button>
                            </div>
                          </form>
                        </motion.div>
                      </div>
                    )}
                  </AnimatePresence>

                  {/* Simulated Modal Overlay for Plan Confirmation */}
                  <AnimatePresence>
                    {showSimulatedPlanConfirmModal && (
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-30 rounded-2xl overflow-hidden flex items-center justify-center p-4">
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="w-full max-w-sm rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 shadow-2xl flex flex-col p-5 space-y-4"
                        >
                          <div className="text-left space-y-1">
                            <h4 className="text-[11px] font-black uppercase tracking-wider dark:text-white">
                              Confirmar Alteração de Plano (Simulado)
                            </h4>
                            <p className="text-[9px] text-neutral-400 font-medium">
                              Verifique os detalhes da nova assinatura simulada antes de prosseguir
                            </p>
                          </div>

                          <div className="p-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-2.5 text-left text-[10px]">
                            <div>
                              <span className="text-[8px] font-black uppercase tracking-widest text-neutral-400">Plano Atual</span>
                              <p className="font-bold text-neutral-700 dark:text-neutral-300">
                                {simulatedPlans.find(p => p.id === simulatedPlanId)?.name} ({getSimulatedCycleLabel(simulatedCycle)})
                              </p>
                            </div>
                            <div className="border-t border-neutral-200 dark:border-neutral-800 pt-2 font-semibold">
                              <span className="text-[8px] font-black uppercase tracking-widest text-indigo-500">Novo Plano Escolhido</span>
                              <p className="font-black text-indigo-600 dark:text-indigo-400">
                                {simulatedPlans.find(p => p.id === selectedSimulatedPlanId)?.name} ({getSimulatedCycleLabel(selectedSimulatedCycle)})
                              </p>
                              <p className="text-[9px] text-neutral-500 mt-0.5 leading-relaxed">
                                Novo valor: {formatSimulatedPrice(getSimulatedPlanPrice(selectedSimulatedPlanId, selectedSimulatedCycle))} cobrado no ciclo selecionado.
                              </p>
                            </div>
                          </div>

                          <div className="flex items-start gap-1.5 text-[9px] text-neutral-500 leading-relaxed text-left">
                            <Shield className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                            <p>
                              Esta é uma simulação da sincronização instantânea com o gateway de pagamentos. Valores pro-rata seriam aplicados na fatura real.
                            </p>
                          </div>

                          <div className="flex gap-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                            <button
                              type="button"
                              onClick={() => setShowSimulatedPlanConfirmModal(false)}
                              className="flex-1 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-[10px] font-bold rounded-xl transition-colors"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={handleSimulatedPlanChange}
                              disabled={isSimulatingPlanUpdate}
                              className="flex-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-[10px] font-bold rounded-xl transition-all flex items-center justify-center gap-1.5"
                            >
                              {isSimulatingPlanUpdate ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Atualizando...
                                </>
                              ) : (
                                'Confirmar'
                              )}
                            </button>
                          </div>
                        </motion.div>
                      </div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* TAB 4: CANCELAMENTO */}
              {activeTab === 'cancel' && (
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
                        Deseja realmente cancelar sua assinatura?
                      </h4>
                      <p className="text-[10px] text-neutral-500 leading-normal max-w-sm">
                        Ao cancelar, seu acesso continuará ativo até o final do período já pago (23/11/2026). Após essa data, o acesso aos recursos será suspenso, mas seus dados permanecerão preservados.
                      </p>
                    </div>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      triggerToast('Cancelamento simulado com sucesso!')
                      setSelectedReasons([])
                      setCancelComment('')
                    }}
                    className="space-y-5 pt-4 border-t border-neutral-100 dark:border-neutral-800"
                  >
                    <div className="space-y-3">
                      <label className="text-[9px] font-black uppercase text-red-500 tracking-wider">
                        Motivo do cancelamento?
                      </label>

                      <div className="space-y-2">
                        {[
                          'PREÇO MUITO ALTO',
                          'DIFICULDADE DE USO',
                          'FALTA DE RECURSOS / CONEXÕES',
                          'MUDANÇA DE ESTRATÉGIA / NÃO PRECISO',
                          'OUTRO MOTIVO'
                        ].map((reason) => {
                          const checked = selectedReasons.includes(reason)
                          return (
                            <div
                              key={reason}
                              onClick={() => toggleReason(reason)}
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
                              <span>{reason}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase text-red-500 tracking-wider">
                        Nos conte um pouco mais sobre o motivo do seu cancelamento e como podemos melhorar nossos serviços
                      </label>
                      <textarea
                        value={cancelComment}
                        onChange={(e) => setCancelComment(e.target.value)}
                        placeholder="Escreva sua resposta aqui (opcional)..."
                        className="w-full p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs font-medium focus:outline-none focus:border-indigo-500 text-neutral-800 dark:text-neutral-200 min-h-[80px]"
                      />
                    </div>

                    <div className="flex gap-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('bi')
                          triggerToast('Obrigado por continuar conosco! ❤️')
                        }}
                        className="flex-grow py-2.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 rounded-xl text-xs font-bold transition-colors"
                      >
                        Manter Assinatura
                      </button>
                      <button
                        type="submit"
                        className="flex-grow py-2.5 bg-red-600 hover:bg-red-750 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1"
                      >
                        <Zap className="w-3.5 h-3.5 fill-current" />
                        <span>Continuar Cancelamento</span>
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}

              {/* TAB 5: iCLUB */}
              {activeTab === 'iclub' && (
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
                        <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Indique & Ganhe</span>
                      </div>
                      <h4 className="text-sm font-black dark:text-white">Seu Link do iClub</h4>
                      <p className="text-[10px] text-neutral-500">Compartilhe o link. A cada indicado que se tornar assinante, você ganha 5% de desconto — <span className="font-black text-indigo-500">vitalício enquanto ele for assinante!</span></p>

                      <div className="flex gap-2 items-center bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-2.5">
                        <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-400 truncate flex-grow">
                          https://metabuilder.pro/?ref=d502254b
                        </span>
                        <button
                          onClick={() => triggerToast('Link copiado com sucesso! (Simulado)')}
                          className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[9px] font-black uppercase transition-all"
                        >
                          Copiar
                        </button>
                      </div>
                    </div>

                    {/* Faturamento com Desconto Acumulado */}
                    <div className="p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl space-y-3 shadow-sm flex flex-col justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
                          <Zap className="w-4 h-4 text-indigo-500" />
                        </div>
                        <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Faturamento iClub</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Desconto Acumulado</span>
                        <h4 className="text-xl font-black text-indigo-600 dark:text-indigo-400 leading-none mt-1">15% de Desconto</h4>
                        <p className="text-[9px] text-neutral-400 font-bold mt-1.5">Na sua próxima fatura do Asaas (3 indicações ativas) — desconto <span className="text-indigo-500">vitalício por indicado</span></p>
                      </div>
                    </div>
                  </div>

                  {/* Volume Progresso */}
                  <div className="p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl space-y-3 shadow-sm">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-neutral-500">Progresso de Volume (Meta: 12 Licenças)</span>
                      <span className="text-neutral-900 dark:text-white">3 / 12 Licenças</span>
                    </div>
                    <div className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-full h-2 overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: '23%' }}></div>
                    </div>
                    <p className="text-[9px] text-neutral-400 font-bold leading-none">
                      A cada 12  licenças ativas contratadas, o iClub libera 1 licença extra totalmente gratuita. Falta(m) 09 licença(s) para sua próxima recompensa.
                    </p>
                  </div>

                  {/* Table of referrals and rewards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Indicações Table */}
                    <div className="sm:col-span-2 p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl space-y-3">
                      <h5 className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Indicações Recentes</h5>
                      <div className="border border-neutral-100 dark:border-neutral-800 rounded-xl overflow-hidden bg-neutral-50/50 dark:bg-neutral-900/10">
                        <table className="w-full text-left border-collapse text-[9px]">
                          <thead>
                            <tr className="bg-neutral-100 dark:bg-neutral-900/60 border-b border-neutral-200 dark:border-neutral-800 text-[8px] font-black uppercase text-neutral-400 tracking-wider">
                              <th className="px-3 py-1.5">E-mail Indicado</th>
                              <th className="px-3 py-1.5 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium">
                            <tr>
                              <td className="px-3 py-2">joao.silva@empresa.com</td>
                              <td className="px-3 py-2 text-center">
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase">Assinante</span>
                              </td>
                            </tr>
                            <tr>
                              <td className="px-3 py-2">maria.santos@empresa.com</td>
                              <td className="px-3 py-2 text-center">
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase">Assinante</span>
                              </td>
                            </tr>
                            <tr>
                              <td className="px-3 py-2">pedro.oliveira@empresa.com</td>
                              <td className="px-3 py-2 text-center">
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase">Assinante</span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Rewards Historial */}
                    <div className="p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl space-y-3">
                      <h5 className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Prêmios Concedidos</h5>
                      <div className="space-y-2">
                        <div className="p-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-1">
                          <div className="flex justify-between items-center text-[8px] font-bold text-neutral-400">
                            <span>Desconto de Fatura</span>
                            <span>25/05/2026</span>
                          </div>
                          <p className="text-[9px] font-bold dark:text-white leading-none">Bônus de 5% de desconto</p>
                        </div>
                        <div className="p-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-1">
                          <div className="flex justify-between items-center text-[8px] font-bold text-neutral-400">
                            <span>Desconto de Fatura</span>
                            <span>24/05/2026</span>
                          </div>
                          <p className="text-[9px] font-bold dark:text-white leading-none">Bônus de 5% de desconto</p>
                        </div>
                        <div className="p-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-1">
                          <div className="flex justify-between items-center text-[8px] font-bold text-neutral-400">
                            <span>Desconto de Fatura</span>
                            <span>23/05/2026</span>
                          </div>
                          <p className="text-[9px] font-bold dark:text-white leading-none">Bônus de 5% de desconto</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB 6: METAVOICE */}
              {activeTab === 'metavoice' && (
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
                      <h4 className="text-sm font-black">Ideias & Sugestões da Comunidade</h4>
                      <p className="text-[10px] text-indigo-200 leading-relaxed">
                        Envie suas ideias, vote nas sugestões de outros usuários e ajude a priorizar o roadmap do MetaBuilderPRO.
                      </p>
                    </div>
                  </div>

                  {/* Mock Suggestions Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Card 1 */}
                    <div className="p-4 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-3 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 text-[8px] font-black uppercase">Planejado</span>
                          <span className="text-[8px] font-black uppercase text-neutral-400 bg-neutral-100 dark:bg-neutral-900 px-2 py-0.5 rounded">UI / UX</span>
                        </div>
                        <h5 className="text-xs font-black dark:text-white line-clamp-1">Modo Escuro no Editor SQL</h5>
                        <p className="text-[10px] text-neutral-500 line-clamp-2 mt-1">Adicionar um botão rápido para alterar o tema especificamente no editor de código SQL no painel de administração.</p>
                      </div>
                      <div className="flex items-center justify-between pt-2.5 border-t border-neutral-100 dark:border-neutral-900 mt-2">
                        <div className="flex items-center gap-3 text-[10px] text-neutral-450 font-bold">
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
                          <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-500 text-[8px] font-black uppercase">Em Execução</span>
                          <span className="text-[8px] font-black uppercase text-neutral-400 bg-neutral-100 dark:bg-neutral-900 px-2 py-0.5 rounded">Integração</span>
                        </div>
                        <h5 className="text-xs font-black dark:text-white line-clamp-1">Integração nativa com n8n</h5>
                        <p className="text-[10px] text-neutral-500 line-clamp-2 mt-1">Disparar Webhooks automáticos do n8n sempre que um caso de uso CRUD salvar ou deletar registros.</p>
                      </div>
                      <div className="flex items-center justify-between pt-2.5 border-t border-neutral-100 dark:border-neutral-900 mt-2">
                        <div className="flex items-center gap-3 text-[10px] text-neutral-450 font-bold">
                          <span className="flex items-center gap-1 text-indigo-500"><ThumbsUp className="w-3.5 h-3.5" /> 42</span>
                          <span className="flex items-center gap-1 text-neutral-400"><MessageCircle className="w-3.5 h-3.5" /> 7</span>
                        </div>
                        <span className="text-[9px] text-amber-500 font-bold flex items-center gap-0.5"><Star className="w-3 h-3 fill-current" /> 4.9</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB 7: COMMUNITY (MetaBuilders) */}
              {activeTab === 'community' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4 text-left"
                >
                  {/* Banner */}
                  <div className="bg-gradient-to-br from-indigo-900 to-blue-900 rounded-2xl p-5 text-white relative overflow-hidden border border-blue-500/20">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/20 rounded-full blur-2xl pointer-events-none" />
                    <div className="relative z-10 space-y-1.5">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black bg-white/10 border border-white/20">
                        <Users className="w-3 h-3 text-blue-300" /> MetaBuilders
                      </span>
                      <h4 className="text-sm font-black">Rede Exclusiva de Builders</h4>
                      <p className="text-[10px] text-blue-100 leading-relaxed">
                        Conecte-se com Owners e Devs, compartilhe insights e faça networking no hub exclusivo de clientes MetaBuilderPRO.
                      </p>
                    </div>
                  </div>

                  {/* Mock create post */}
                  <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 space-y-3 shadow-sm">
                    <div className="flex gap-3 items-center">
                      <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center text-[10px] font-black text-indigo-500 shrink-0">AM</div>
                      <div className="flex-1 h-8 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 flex items-center">
                        <span className="text-[10px] text-neutral-400">O que você quer compartilhar com a comunidade?</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-neutral-100 dark:border-neutral-800">
                      <div className="flex items-center gap-1 text-neutral-400">
                        <Eye className="w-3.5 h-3.5" />
                        <span className="text-[9px] font-bold">Imagem</span>
                      </div>
                      <button className="px-3 py-1 bg-indigo-600 text-white text-[9px] font-black uppercase rounded-lg">Publicar</button>
                    </div>
                  </div>

                  {/* Mock posts feed */}
                  <div className="space-y-3">
                    {/* Post 1 */}
                    <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-[8px] font-black text-emerald-600 shrink-0">JS</div>
                        <div>
                          <span className="text-[10px] font-black dark:text-white">João Silva</span>
                          <span className="ml-1.5 text-[8px] px-1.5 py-0.5 bg-indigo-500/10 text-indigo-500 rounded-full font-black uppercase">OWNER</span>
                        </div>
                        <span className="ml-auto text-[8px] text-neutral-400">há 2h</span>
                      </div>
                      <p className="text-[10px] text-neutral-600 dark:text-neutral-400 leading-relaxed mb-2">Alguém conseguiu integrar o MetaBuilder com o Google Sheets? Estou tentando criar um relatório automático e preciso de dicas!</p>
                      <div className="flex items-center gap-4 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                        <span className="flex items-center gap-1 text-[9px] text-neutral-400 font-bold"><Heart className="w-3 h-3" /> 8</span>
                        <span className="flex items-center gap-1 text-[9px] text-neutral-400 font-bold"><MessageCircle className="w-3 h-3" /> 3</span>
                      </div>
                    </div>

                    {/* Post 2 */}
                    <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-[8px] font-black text-purple-600 shrink-0">ML</div>
                        <div>
                          <span className="text-[10px] font-black dark:text-white">Maria Lima</span>
                          <span className="ml-1.5 text-[8px] px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 rounded-full font-black uppercase">DEV</span>
                        </div>
                        <span className="ml-auto text-[8px] text-neutral-400">há 5h</span>
                      </div>
                      <p className="text-[10px] text-neutral-600 dark:text-neutral-400 leading-relaxed mb-2">Dica: use o campo de fórmula no Grid para calcular totais por linha sem precisar criar campo extra no banco. Economizou muito meu tempo!</p>
                      <div className="flex items-center gap-4 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                        <span className="flex items-center gap-1 text-[9px] text-indigo-500 font-bold"><Heart className="w-3 h-3 fill-current" /> 14</span>
                        <span className="flex items-center gap-1 text-[9px] text-neutral-400 font-bold"><MessageCircle className="w-3 h-3" /> 5</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

            </div>

            {/* Mockup Footer banner */}
            <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 text-[10px] text-neutral-400 bg-white dark:bg-neutral-950 flex items-center justify-center gap-2">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
              <span>Painel de Controle Whitelabel — Métricas Ativas em tempo real</span>
            </div>

          </div>
        </div>

      </section>

      {/* Grid: Auditing Details — "VAR do Desenvolvimento" */}
      <section className="border-t border-neutral-100 dark:border-neutral-900 pt-16 space-y-12">
        <div className="max-w-3xl space-y-3">
          <h2 className="text-3xl font-black dark:text-white tracking-tight">
            Auditoria Técnica Em Tempo Real: O "VAR do Desenvolvimento"
          </h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm leading-relaxed">
            Elimine a falta de visibilidade do trabalho operacional de engenharia. A aba <strong>Produtividade</strong> é uma solução de auditoria contínua que rastreia interações reais dos DEVs com a engine para gerar métricas gerenciais precisas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 rounded-[2rem] bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold dark:text-white">Tempo Ativo vs. Inatividade</h4>
            <p className="text-neutral-500 dark:text-neutral-400 text-xs leading-relaxed">
              O sistema calcula o tempo ativo real de desenvolvimento e expõe com precisão os intervalos ociosos (gaps de tempo) entre cada ação no Studio.
            </p>
          </div>

          <div className="p-8 rounded-[2rem] bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold dark:text-white">Rastreamento Granular</h4>
            <p className="text-neutral-500 dark:text-neutral-400 text-xs leading-relaxed">
              Monitore alterações de configuração detalhadas: renomeação de tabelas e slugs, adição de widgets, novos campos no Grid/Filtros e botões de layout ativos/inativos.
            </p>
          </div>

          <div className="p-8 rounded-[2rem] bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <Zap className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold dark:text-white">Auditoria Completa de Sessão</h4>
            <p className="text-neutral-500 dark:text-neutral-400 text-xs leading-relaxed">
              Rastreamento de ponta a ponta desde a inicialização automática da sessão (SESSION_START) até a finalização e publicação de alterações na Painel de Controle.
            </p>
          </div>
        </div>
      </section>

      {/* Grid: Dashboard BI importance */}
      <section className="border-t border-neutral-100 dark:border-neutral-900 pt-16 space-y-8 text-left">
        <div className="max-w-3xl space-y-3">
          <h2 className="text-3xl font-black dark:text-white tracking-tight">
            Gestão Estratégica via Dashboard BI
          </h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm leading-relaxed">
            Consolide dados de infraestrutura e consumo de licenças de todos os workspaces criados para a sua empresa ou clientes em um painel gerencial único.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-8 bg-neutral-900 rounded-[2.5rem] text-white flex flex-col justify-between min-h-[220px]">
            <h4 className="text-xl font-bold">Distribuição Dinâmica de Recursos</h4>
            <p className="text-xs opacity-70 leading-relaxed mt-3">
              Monitore instantaneamente quais tipos de telas estão sendo criadas (CRUDs de Cadastro, Telas de Relatório/Consulta e Estruturas de Mestre-Detalhe) para auditar se o ecossistema está equilibrado de acordo com a contratação de licenças.
            </p>
            <div className="pt-6 flex items-center gap-1 text-xs text-indigo-400 font-bold uppercase tracking-wider">
              <span>Mapeamento Automático</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          <div className="p-8 bg-neutral-900 rounded-[2.5rem] text-white flex flex-col justify-between min-h-[220px]">
            <h4 className="text-xl font-bold">Controle Whitelabel Financeiro</h4>
            <p className="text-xs opacity-70 leading-relaxed mt-3">
              Tenha controle total das faturas geradas, métodos de pagamento via Pix, e envie logs de cancelamento estruturados diretamente no painel. Reduza a rotatividade (churn) conhecendo as dores dos usuários em tempo real.
            </p>
            <div className="pt-6 flex items-center gap-1 text-xs text-emerald-400 font-bold uppercase tracking-wider">
              <span>Gestão de Receita (MRR)</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </section>

      {/* Grid: Detailed Control Center Features (Assinatura, Cancelamento, MetaVoice, iClub) */}
      <section className="border-t border-neutral-100 dark:border-neutral-900 pt-16 space-y-12 text-left">
        <div className="max-w-3xl space-y-3">
          <h2 className="text-3xl font-black dark:text-white tracking-tight">
            Pilares da Central de Controle
          </h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm leading-relaxed font-medium">
            Explore em detalhes cada funcionalidade integrada no cockpit de gestão do MetaBuilderPRO:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Card 1: Assinatura & Faturamento */}
          <div className="p-8 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] space-y-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500">
              <CreditCard className="w-6 h-6" />
            </div>
            <h4 className="text-xl font-bold dark:text-white">Assinatura & Faturamento</h4>
            <p className="text-neutral-500 dark:text-neutral-400 text-xs leading-relaxed">
              Monitore o status do seu plano ativo, veja a data de renovação recorrente e gerencie as licenças dos desenvolvedores. A central disponibiliza o download de recibos das faturas faturadas via Pix ou Cartão com facilidade e total transparência.
            </p>
          </div>

          {/* Card 2: Fluxo de Cancelamento Transparente */}
          <div className="p-8 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] space-y-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
              <XCircle className="w-6 h-6" />
            </div>
            <h4 className="text-xl font-bold dark:text-white">Fluxo de Cancelamento Transparente</h4>
            <p className="text-neutral-500 dark:text-neutral-400 text-xs leading-relaxed">
              Acreditamos em parcerias livres de burocracia. O cliente pode cancelar a sua conta diretamente do painel a qualquer momento. Um formulário estruturado colhe feedbacks valiosos para que nossa equipe entenda as necessidades e aprimore o serviço.
            </p>
          </div>

          {/* Card 3: MetaVoice - Sugestões & Feedback */}
          <div className="p-8 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] space-y-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Lightbulb className="w-6 h-6" />
            </div>
            <h4 className="text-xl font-bold dark:text-white">MetaVoice - Sugestões & Feedback</h4>
            <p className="text-neutral-500 dark:text-neutral-400 text-xs leading-relaxed">
              Envie sugestões de melhorias ou novos recursos. <strong className="text-indigo-500 font-extrabold">As ideias que forem de interesse geral de outros clientes serão desenvolvidas e implementadas sem qualquer custo adicional.</strong> Para requisitos muito específicos do seu negócio, você poderá contratar a execução diretamente junto à Equipe MetaBuilder PRO.
            </p>
          </div>

          {/* Card 4: MetaBuilders - Rede Exclusiva */}
          <div className="p-8 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] space-y-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
              <Users className="w-6 h-6" />
            </div>
            <h4 className="text-xl font-bold dark:text-white">MetaBuilders - Rede Exclusiva</h4>
            <p className="text-neutral-500 dark:text-neutral-400 text-xs leading-relaxed">
              Comunidade exclusiva integrada ao painel. Conecte-se com outros Owners e Devs, publique insights, curta e comente posts em tempo real. Um hub de networking pensado para quem vive e respira o ecossistema MetaBuilderPRO.
            </p>
          </div>

          {/* Card 5: iClub - Vantagens e Fidelidade */}
          <div className="p-8 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] space-y-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <Zap className="w-6 h-6" />
            </div>
            <h4 className="text-xl font-bold dark:text-white">iClub - Vantagens e Fidelidade</h4>
            <p className="text-neutral-500 dark:text-neutral-400 text-xs leading-relaxed">
              O iClub é nosso programa de indicação e benefícios. <strong className="text-emerald-550 font-extrabold">Cada indicação bem-sucedida gera 5% de desconto vitalício na sua fatura</strong> (enquanto o indicado permanecer ativo). Acumule descontos de até 100% ou receba licenças extras gratuitas para cada volume contratado!
            </p>
          </div>
        </div>
      </section>

      {/* Bottom CTA Card */}
      <section className="p-12 rounded-[3.5rem] bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-center space-y-8">
        <div className="space-y-3">
          <h2 className="text-3xl font-black dark:text-white">Gerencie seu Ecossistema com Total Visibilidade</h2>
          <p className="text-neutral-500 dark:text-neutral-400 max-w-xl mx-auto text-sm leading-relaxed">
            Acesse a Painel de Controle pelo seu menu de perfil e audite a produtividade de desenvolvimento agora mesmo.
          </p>
        </div>
        <BottomCta />
      </section>

    </div>
  )
}
