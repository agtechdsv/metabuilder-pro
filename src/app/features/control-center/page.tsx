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
  ExternalLink
} from 'lucide-react'
import Link from 'next/link'
import { useI18n } from '@/i18n/I18nContext'
import { cn } from '@/lib/utils'

type TabType = 'bi' | 'productivity' | 'subscription' | 'cancel'

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

  // Detailed Log mock database
  const mockDetailedLogs = {
    session1: {
      dev: 'AG Tech Tecnologia',
      start: '26/05/2026, 19:05:50',
      activeTime: '0m 8s',
      actions: [
        { time: '19:05:51', action: 'Visualizou o Studio', stage: 'Dashboard de Controle' },
        { time: '19:05:58', action: 'Fechou a sessão', stage: 'Sair' }
      ]
    },
    session2: {
      dev: 'AG Tech Tecnologia',
      start: '26/05/2026, 18:48:35',
      activeTime: '1m 13s',
      actions: [
        { time: '18:48:36', action: 'Abriu Caso de Uso "contratos"', stage: 'Etapa 1 - Lógica' },
        { time: '18:48:45', action: 'Removeu o botão "salvar"', stage: 'Etapa 3 - Campos & Layout' },
        { time: '18:49:02', action: 'Adicionou o botão "salvar"', stage: 'Etapa 3 - Campos & Layout' },
        { time: '18:49:15', action: 'Removeu o botão "salvar"', stage: 'Etapa 3 - Campos & Layout' },
        { time: '18:49:30', action: 'Adicionou o botão "salvar"', stage: 'Etapa 3 - Campos & Layout' },
        { time: '18:49:48', action: 'Finalizou e salvou alterações', stage: 'Etapa 4 - Ações & Query' }
      ]
    }
  }

  const [activeDetailedLog, setActiveDetailedLog] = useState<keyof typeof mockDetailedLogs>('session2')

  // Cancel Tab States
  const [selectedReasons, setSelectedReasons] = useState<string[]>([])
  const [cancelComment, setCancelComment] = useState('')
  const [toastMessage, setToastMessage] = useState<string | null>(null)

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
          {t('marketing_v2.control_center_page.title')} <br/>
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
        <div className="lg:col-span-5 space-y-6">
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
              <p className="text-xs text-neutral-500 dark:text-neutral-450 leading-relaxed">
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
              <p className="text-xs text-neutral-500 dark:text-neutral-450 leading-relaxed">
                <strong>O coração da Central.</strong> Um log detalhado audita cada ação dos desenvolvedores. O gestor pode auditar exatamente quais botões foram adicionados ou removidos e calcular tempos reais ativos vs. ociosos no Studio.
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
              <p className="text-xs text-neutral-500 dark:text-neutral-450 leading-relaxed">
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
              <div className="flex items-center gap-3 text-rose-600 dark:text-rose-450">
                <XCircle className="w-5 h-5" />
                <h3 className="font-bold text-base">Fluxo de Cancelamento Transparente</h3>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-450 leading-relaxed">
                Formulário interativo whitelabel para feedback. Os usuários podem justificar sua saída através de múltiplos motivos de cancelamento estruturados e comentários adicionais antes da desativação no Asaas.
              </p>
            </div>

          </div>
        </div>

        {/* Right Column: Simulator Mockup Container */}
        <div className="lg:col-span-7 sticky top-24">
          <div className="relative rounded-[2.5rem] bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-2xl min-h-[550px] flex flex-col">
            
            {/* Mockup Window Header */}
            <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
              </div>
              <span className="text-[10px] font-black tracking-widest text-neutral-400 uppercase">
                Central de Controle - Simulador
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
                  <h3 className="text-lg font-black text-neutral-800 dark:text-white leading-none">Central de Controle</h3>
                  <span className="text-[10px] text-neutral-400 font-medium">Visão geral dos seus dados, assinatura e conta</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-[9px] font-extrabold tracking-wider uppercase self-start sm:self-auto">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                <span>Ativo</span>
              </div>
            </div>

            {/* Tabs Selector Bar */}
            <div className="bg-white dark:bg-neutral-950 px-6 py-3 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap gap-2">
              <button 
                onClick={() => setActiveTab('bi')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                  activeTab === 'bi'
                    ? 'bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-white shadow-sm'
                    : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-900/40'
                )}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard BI</span>
              </button>
              <button 
                onClick={() => setActiveTab('productivity')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                  activeTab === 'productivity'
                    ? 'bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-white shadow-sm'
                    : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-900/40'
                )}
              >
                <Activity className="w-4 h-4" />
                <span>Produtividade</span>
              </button>
              <button 
                onClick={() => setActiveTab('subscription')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                  activeTab === 'subscription'
                    ? 'bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-white shadow-sm'
                    : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-900/40'
                )}
              >
                <CreditCard className="w-4 h-4" />
                <span>Assinatura</span>
              </button>
              <button 
                onClick={() => setActiveTab('cancel')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                  activeTab === 'cancel'
                    ? 'bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-white shadow-sm'
                    : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-900/40'
                )}
              >
                <XCircle className="w-4 h-4" />
                <span>Cancelamento</span>
              </button>
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
                    <div className="p-4 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 rounded-2xl flex flex-col items-center justify-between text-center min-h-[110px]">
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

                    <div className="p-4 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 rounded-2xl flex flex-col items-center justify-between text-center min-h-[110px]">
                      <span className="text-[9px] font-black uppercase text-neutral-400">Workspaces</span>
                      <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                        <Users className="w-4 h-4" />
                      </div>
                      <h4 className="text-lg font-black dark:text-white leading-none">1</h4>
                      <span className="text-[8px] text-neutral-400 font-bold leading-none">Ambiente criado</span>
                    </div>

                    <div className="p-4 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 rounded-2xl flex flex-col items-center justify-between text-center min-h-[110px]">
                      <span className="text-[9px] font-black uppercase text-neutral-400">Projetos</span>
                      <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                        <FileText className="w-4 h-4" />
                      </div>
                      <h4 className="text-lg font-black dark:text-white leading-none">1</h4>
                      <span className="text-[8px] text-neutral-400 font-bold leading-none">Em todos workspaces</span>
                    </div>

                    <div className="p-4 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 rounded-2xl flex flex-col items-center justify-between text-center min-h-[110px]">
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
                    <div className="p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 rounded-2xl space-y-3">
                      <h5 className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Projetos por Workspace</h5>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-neutral-700 dark:text-neutral-300">
                          <span>AGTech</span>
                          <span>1</span>
                        </div>
                        <div className="w-full h-2 bg-neutral-100 dark:bg-neutral-850 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500 w-full"></div>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 rounded-2xl space-y-3">
                      <h5 className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Casos de Uso por Projeto</h5>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-neutral-700 dark:text-neutral-300">
                          <span>Build Flow</span>
                          <span>3</span>
                        </div>
                        <div className="w-full h-2 bg-neutral-100 dark:bg-neutral-850 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 w-full"></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Donut Chart & Details Table */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Donut Chart */}
                    <div className="p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 rounded-2xl flex flex-col items-center justify-between min-h-[180px]">
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
                    <div className="sm:col-span-2 p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 rounded-2xl space-y-3">
                      <h5 className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Detalhamento por Workspace</h5>
                      
                      <div className="border border-neutral-100 dark:border-neutral-850 rounded-xl overflow-hidden bg-neutral-50/50 dark:bg-neutral-900/10">
                        <table className="w-full text-left border-collapse text-[10px]">
                          <thead>
                            <tr className="bg-neutral-100 dark:bg-neutral-900/60 border-b border-neutral-200 dark:border-neutral-800 text-[8px] font-black uppercase text-neutral-400 tracking-wider">
                              <th className="px-3 py-2">Workspace</th>
                              <th className="px-3 py-2 text-center">Projetos</th>
                              <th className="px-3 py-2 text-center">Casos</th>
                              <th className="px-3 py-2 text-center">Usuários</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-850 text-neutral-750 dark:text-neutral-350">
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

              {/* TAB 2: PRODUTIVIDADE & VAR */}
              {activeTab === 'productivity' && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-6 text-left relative"
                >
                  {/* Filters bar */}
                  <div className="p-3 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 rounded-2xl flex flex-wrap gap-3 items-center text-xs">
                    <span className="text-[9px] font-black uppercase text-neutral-450 tracking-wider">Filtros:</span>
                    <div className="flex gap-2">
                      <select 
                        value={selectedProject} 
                        onChange={(e) => setSelectedProject(e.target.value)}
                        className="px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-[10px] font-bold outline-none text-neutral-750 dark:text-neutral-300"
                      >
                        <option value="All">Todos os Projetos</option>
                      </select>
                      <select 
                        value={selectedDev} 
                        onChange={(e) => setSelectedDev(e.target.value)}
                        className="px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-[10px] font-bold outline-none text-neutral-750 dark:text-neutral-300"
                      >
                        <option value="All">Todos os Profissionais</option>
                      </select>
                      <select 
                        value={selectedPeriod} 
                        onChange={(e) => setSelectedPeriod(e.target.value)}
                        className="px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-[10px] font-bold outline-none text-neutral-750 dark:text-neutral-300"
                      >
                        <option value="All">Todo o Período</option>
                      </select>
                    </div>
                  </div>

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 rounded-2xl space-y-1">
                      <div className="flex items-center gap-1.5 text-neutral-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-[9px] font-black uppercase tracking-wider">Tempo Ativo Total</span>
                      </div>
                      <h4 className="text-xl font-black dark:text-white">1 min</h4>
                      <p className="text-[9px] text-neutral-400 font-bold">Tempo gasto construindo na plataforma</p>
                    </div>

                    <div className="p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 rounded-2xl space-y-1">
                      <div className="flex items-center gap-1.5 text-neutral-400">
                        <Activity className="w-3.5 h-3.5" />
                        <span className="text-[9px] font-black uppercase tracking-wider">Ações Realizadas</span>
                      </div>
                      <h4 className="text-xl font-black dark:text-white">13</h4>
                      <p className="text-[9px] text-neutral-400 font-bold">Interações auditadas com o Studio</p>
                    </div>
                  </div>

                  {/* Produtividade por profissional */}
                  <div className="p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 rounded-2xl space-y-3">
                    <h5 className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Produtividade por Profissional</h5>
                    
                    <div className="p-4 bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-100 dark:border-neutral-850 rounded-2xl max-w-xs space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[9px] font-black">A</div>
                        <span className="text-xs font-bold dark:text-white">AG Tech Tecnologia</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[10px] text-neutral-500">
                        <div>
                          <span className="text-[8px] font-black text-neutral-450 block uppercase">Tempo Ativo</span>
                          <span className="font-bold text-neutral-800 dark:text-neutral-300">1m</span>
                        </div>
                        <div>
                          <span className="text-[8px] font-black text-neutral-450 block uppercase">Ações</span>
                          <span className="font-bold text-neutral-800 dark:text-neutral-300">13</span>
                        </div>
                        <div>
                          <span className="text-[8px] font-black text-neutral-450 block uppercase">Sessões</span>
                          <span className="font-bold text-neutral-800 dark:text-neutral-300">2</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Audit logs table */}
                  <div className="p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 rounded-2xl space-y-3">
                    <h5 className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Logs de Atividade Detalhados</h5>
                    
                    <div className="border border-neutral-100 dark:border-neutral-850 rounded-xl overflow-hidden bg-neutral-50/50 dark:bg-neutral-900/10">
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
                        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-850 text-neutral-750 dark:text-neutral-350">
                          <tr className="hover:bg-neutral-100/50 dark:hover:bg-neutral-900/20">
                            <td className="px-3 py-2 font-bold">AG Tech Tecnologia</td>
                            <td className="px-3 py-2 hidden sm:table-cell font-mono text-[9px]">26/05/2026, 19:05:50</td>
                            <td className="px-3 py-2 font-bold font-mono">0m 8s</td>
                            <td className="px-3 py-2 text-center font-bold">1</td>
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
                          <tr className="hover:bg-neutral-100/50 dark:hover:bg-neutral-900/20">
                            <td className="px-3 py-2 font-bold">AG Tech Tecnologia</td>
                            <td className="px-3 py-2 hidden sm:table-cell font-mono text-[9px]">26/05/2026, 18:48:35</td>
                            <td className="px-3 py-2 font-bold font-mono">1m 13s</td>
                            <td className="px-3 py-2 text-center font-bold">12</td>
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
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Code-style Audit Log pop-up overlay simulator */}
                  <AnimatePresence>
                    {isDetailedLogOpen && (
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-30 rounded-2xl overflow-hidden flex items-center justify-center p-4">
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className={cn(
                            "w-full max-w-md rounded-2xl border flex flex-col justify-between shadow-2xl transition-colors duration-300",
                            detailedLogTheme === 'dark'
                              ? 'bg-neutral-950 border-neutral-800 text-neutral-300'
                              : 'bg-white border-neutral-200 text-neutral-700'
                          )}
                        >
                          {/* Audit header */}
                          <div className={cn(
                            "px-4 py-3 border-b flex items-center justify-between",
                            detailedLogTheme === 'dark' ? 'border-neutral-800 bg-neutral-900/60' : 'border-neutral-200 bg-neutral-55/60'
                          )}>
                            <div className="flex items-center gap-2">
                              <Terminal className="w-4 h-4 text-purple-500" />
                              <span className="text-[10px] font-black uppercase tracking-wider">
                                Auditoria: {mockDetailedLogs[activeDetailedLog].dev}
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
                                onClick={() => setIsDetailedLogOpen(false)}
                                className="text-xs font-black text-neutral-400 hover:text-neutral-250 ml-2"
                              >
                                Fechar
                              </button>
                            </div>
                          </div>

                          {/* Audit logs content code representation */}
                          <div className="p-4 flex-grow overflow-y-auto max-h-[220px] font-mono text-[10px] space-y-3">
                            <p className="text-neutral-500"># Início da Sessão: {mockDetailedLogs[activeDetailedLog].start}</p>
                            <p className="text-neutral-500"># Tempo de Atividade: {mockDetailedLogs[activeDetailedLog].activeTime}</p>
                            
                            <div className="space-y-1.5 pt-2 border-t border-dashed border-neutral-800">
                              {mockDetailedLogs[activeDetailedLog].actions.map((act, i) => (
                                <div key={i} className="flex gap-2 items-start leading-relaxed">
                                  <span className="text-purple-400 shrink-0">[{act.time}]</span>
                                  <span className={cn(
                                    act.action.includes('Removeu') ? 'text-rose-500' :
                                    act.action.includes('Adicionou') ? 'text-emerald-500' :
                                    act.action.includes('Finalizou') ? 'text-indigo-400 font-bold' : ''
                                  )}>
                                    {act.action}
                                  </span>
                                  <span className="text-neutral-550 italic">({act.stage})</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className={cn(
                            "px-4 py-3 border-t text-center text-[8px] font-black uppercase tracking-widest text-neutral-450",
                            detailedLogTheme === 'dark' ? 'border-neutral-800 bg-neutral-900/20' : 'border-neutral-200 bg-neutral-50'
                          )}>
                            Auditoria Ativa - Processado via WebSocket Local
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
                  className="space-y-6 text-left"
                >
                  <div className="p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 rounded-3xl space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-widest text-neutral-800 dark:text-white border-b border-neutral-100 dark:border-neutral-800 pb-2">
                      Resumo da Assinatura
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                      <div className="p-4 bg-indigo-600/5 dark:bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-left space-y-1">
                        <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">Plano Atual</span>
                        <h5 className="text-sm font-black text-indigo-600 dark:text-indigo-400">Professional</h5>
                        <p className="text-[9px] font-bold text-neutral-500">R$ 6.069,00 / semestral</p>
                      </div>
                      
                      <div className="p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850 rounded-xl text-left space-y-1">
                        <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">Ciclo</span>
                        <h5 className="text-sm font-bold text-neutral-800 dark:text-neutral-250">Semestral</h5>
                        <p className="text-[9px] text-neutral-400 font-bold">Renovação recorrente</p>
                      </div>

                      <div className="p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850 rounded-xl text-left space-y-1">
                        <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">Status</span>
                        <h5 className="text-sm font-bold text-emerald-500 flex items-center gap-1">✓ Ativo</h5>
                        <p className="text-[9px] text-neutral-400 font-bold">Operação normal</p>
                      </div>

                      <div className="p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850 rounded-xl text-left space-y-1">
                        <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">Próxima Renovação</span>
                        <h5 className="text-sm font-bold text-neutral-800 dark:text-neutral-250">23/11/2026</h5>
                        <p className="text-[9px] text-neutral-400 font-bold">Débito automático Pix</p>
                      </div>
                    </div>

                    <div className="pt-2 text-[10px] text-neutral-500 flex flex-wrap gap-x-6 gap-y-1 font-mono">
                      <span><strong>ÚLTIMO PAGAMENTO:</strong> R$ 5,00</span>
                      <span><strong>DATA:</strong> 23/05/2026</span>
                      <span><strong>FORMA DE PAGAMENTO:</strong> Pix</span>
                    </div>
                  </div>

                  {/* Invoice table */}
                  <div className="p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 rounded-3xl space-y-3">
                    <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-2">
                      <h4 className="text-xs font-black uppercase tracking-widest text-neutral-800 dark:text-white">
                        Histórico de Faturamento
                      </h4>
                      <span className="px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-900 text-[8px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                        1 transação
                      </span>
                    </div>

                    <div className="border border-neutral-100 dark:border-neutral-850 rounded-xl overflow-hidden bg-neutral-50/50 dark:bg-neutral-900/10">
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
                        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-850 text-neutral-750 dark:text-neutral-350">
                          <tr className="hover:bg-neutral-100/50 dark:hover:bg-neutral-900/20">
                            <td className="px-3 py-2.5 font-bold font-mono">23/05/2026</td>
                            <td className="px-3 py-2.5 font-bold">Semestral</td>
                            <td className="px-3 py-2.5 font-bold font-mono text-indigo-600 dark:text-indigo-400">R$ 5,00</td>
                            <td className="px-3 py-2.5 font-medium">Pix</td>
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
                </motion.div>
              )}

              {/* TAB 4: CANCELAMENTO */}
              {activeTab === 'cancel' && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-6 text-left max-w-xl mx-auto p-4 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 rounded-[2.5rem] shadow-sm"
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
                    className="space-y-5 pt-4 border-t border-neutral-100 dark:border-neutral-850"
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
                                "p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-colors text-[10px] font-bold text-neutral-750 dark:text-neutral-350",
                                checked 
                                  ? 'bg-neutral-50 dark:bg-neutral-900 border-indigo-500/30' 
                                  : 'bg-white dark:bg-neutral-950 border-neutral-150 dark:border-neutral-850 hover:bg-neutral-50 dark:hover:bg-neutral-900'
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

                    <div className="flex gap-3 pt-2 border-t border-neutral-100 dark:border-neutral-850">
                      <button 
                        type="button" 
                        onClick={() => {
                          setActiveTab('bi')
                          triggerToast('Obrigado por continuar conosco! ❤️')
                        }}
                        className="flex-grow py-2.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-850 text-neutral-600 dark:text-neutral-350 rounded-xl text-xs font-bold transition-colors"
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

            </div>

            {/* Mockup Footer banner */}
            <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 text-[10px] text-neutral-400 bg-white dark:bg-neutral-950 flex items-center justify-center gap-2">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
              <span>Central de Controle Whitelabel — Métricas Ativas em tempo real</span>
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
          <div className="p-8 rounded-[2rem] bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold dark:text-white">Tempo Ativo vs. Ocioso</h4>
            <p className="text-neutral-500 dark:text-neutral-400 text-xs leading-relaxed">
              O sistema calcula o tempo ativo real em que o DEV esteve editando propriedades, relacionamentos ou layouts de banco, separando do tempo ocioso com o navegador apenas aberto.
            </p>
          </div>

          <div className="p-8 rounded-[2rem] bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold dark:text-white">Taxa de Retrabalho (Rework)</h4>
            <p className="text-neutral-500 dark:text-neutral-400 text-xs leading-relaxed">
              Mapeie ações repetitivas, como a adição e remoção consecutiva de campos e botões. Uma taxa de retrabalho controlada previne ciclos longos e refações desnecessárias no projeto.
            </p>
          </div>

          <div className="p-8 rounded-[2rem] bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <Zap className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold dark:text-white">Métricas de Entrega (Lead Time)</h4>
            <p className="text-neutral-500 dark:text-neutral-400 text-xs leading-relaxed">
              Monitore a velocidade e volume de esforço da equipe do início da criação da lógica (geração de ovos) até a entrega final na Central de Controle. Perfeito para gerentes de tecnologia.
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

      {/* Bottom CTA Card */}
      <section className="p-12 rounded-[3.5rem] bg-neutral-100 dark:bg-neutral-900 border border-neutral-250 dark:border-neutral-800 text-center space-y-8">
        <div className="space-y-3">
          <h2 className="text-3xl font-black dark:text-white">Gerencie seu Ecossistema com Total Visibilidade</h2>
          <p className="text-neutral-500 dark:text-neutral-400 max-w-xl mx-auto text-sm leading-relaxed">
            Acesse a Central de Controle pelo seu menu de perfil e audite a produtividade de desenvolvimento agora mesmo.
          </p>
        </div>
        <Link 
          href="/auth/signup"
          className="inline-flex items-center gap-2 px-10 py-4.5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-indigo-500/10"
        >
          <span>Acessar Workspace</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

    </div>
  )
}
