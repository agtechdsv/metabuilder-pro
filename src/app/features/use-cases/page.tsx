'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ArrowLeft, 
  Search, 
  Plus, 
  Database, 
  Layout, 
  Kanban as KanbanIcon, 
  GitFork, 
  Terminal, 
  Layers, 
  Check, 
  Play, 
  ArrowRight,
  UserPlus,
  Trash2,
  FileText,
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  LayoutGrid,
  Image as ImageIcon,
  Download,
  ExternalLink,
  Eye,
  History,
  MapPin,
  GitBranch
} from 'lucide-react'
import Link from 'next/link'
import { BottomCta } from '@/components/landing/BottomCta'
import { useI18n } from '@/i18n/I18nContext'
import { cn } from '@/lib/utils'

type UseCaseType = 'cadastro' | 'pesquisa' | 'pesquisa_cadastro' | 'master_detail' | 'kanban' | 'mapa_mental' | 'dashboard' | 'agenda' | 'personalizado' | 'galeria' | 'timeline' | 'gantt' | 'blueprint' | 'map'

export default function UseCasesFeaturePage() {
  const { t } = useI18n()
  const [selectedType, setSelectedType] = useState<UseCaseType>('pesquisa_cadastro')

  // Stock gauge scroll interaction refs and state
  const estoqueGridRef = useRef<HTMLDivElement>(null)
  const [scrollPercent, setScrollPercent] = useState(0)

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget
    const maxScroll = target.scrollHeight - target.clientHeight
    if (maxScroll <= 0) return
    setScrollPercent(target.scrollTop / maxScroll)
  }

  const scrollUp = () => {
    estoqueGridRef.current?.scrollBy({ top: -140, behavior: 'smooth' })
  }

  const scrollDown = () => {
    estoqueGridRef.current?.scrollBy({ top: 140, behavior: 'smooth' })
  }

  // Mock states for interactive components
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOnlyQuery, setSearchOnlyQuery] = useState('')
  const [pesquisaCadastroRecords, setPesquisaCadastroRecords] = useState([
    { id: 1, name: 'Ana Souza', email: 'ana.souza@gmail.com', status: 'Ativo' },
    { id: 2, name: 'Bruno Lima', email: 'bruno.lima@yahoo.com', status: 'Inativo' },
    { id: 3, name: 'Carla Dias', email: 'carla.dias@outlook.com', status: 'Ativo' },
  ])
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [recordToDelete, setRecordToDelete] = useState<number | null>(null)
  const [newRecordName, setNewRecordName] = useState('')
  const [newRecordEmail, setNewRecordEmail] = useState('')
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  
  // Registration Only State
  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regSuccess, setRegSuccess] = useState(false)

  // Master Detail Tab State
  const [activeDetailTab, setActiveDetailTab] = useState<'items' | 'payments' | 'logs'>('items')

  // Kanban Tasks State
  const [kanbanTasks, setKanbanTasks] = useState([
    { id: 'k1', title: 'Integração de API', status: 'todo' },
    { id: 'k2', title: 'Revisão de Layout', status: 'inprogress' },
    { id: 'k3', title: 'Testes de RLS', status: 'done' },
  ])
  const [draggedOverColumn, setDraggedOverColumn] = useState<string | null>(null)

  // Dashboard simulation state
  const [dashboardPeriod, setDashboardPeriod] = useState<'7d' | '30d' | '12m'>('30d')

  // Calendar / Agenda simulation state
  const [selectedAgendaDay, setSelectedAgendaDay] = useState<number>(21)
  const [agendaEvents, setAgendaEvents] = useState([
    { id: 'ev1', day: 17, time: '14:00', title: 'Entrevista de Engenharia Core', type: 'entrevista' },
    { id: 'ev2', day: 18, time: '09:00', title: 'Reunião Diária (Daily Scrum)', type: 'reunião' },
    { id: 'ev3', day: 18, time: '11:00', title: 'Alinhamento Técnico do Schedu...', type: 'alinhamento' },
    { id: 'ev4', day: 19, time: '10:00', title: 'Revisão Trimestral de Metas (QBR)', type: 'reunião' },
    { id: 'ev5', day: 19, time: '14:30', title: 'Sessão de UI/UX feedback com...', type: 'design' },
    { id: 'ev6', day: 22, time: '16:00', title: 'Manutenção Preventiva de Banc...', type: 'infra' },
    { id: 'ev7', day: 23, time: '11:00', title: 'Brainstorming de Novos Recurs...', type: 'reunião' },
  ])

  // Custom SQL State
  const [sqlQuery, setSqlQuery] = useState('SELECT p.id, p.name, count(o.id) FROM products p...')
  const [isSqlRunning, setIsSqlRunning] = useState(false)
  const [sqlResults, setSqlResults] = useState<any[]>([])
  const [isMindMapExpanded, setIsMindMapExpanded] = useState(false)
  const [isFinanceExpanded, setIsFinanceExpanded] = useState(false)
  const [isSalesExpanded, setIsSalesExpanded] = useState(false)
  const [isHrExpanded, setIsHrExpanded] = useState(false)

  // Galeria simulation state
  const [galleryFilter, setGalleryFilter] = useState<'all' | 'image' | 'pdf'>('all')
  const [gallerySearchQuery, setGallerySearchQuery] = useState('')
  const [selectedAssetPreview, setSelectedAssetPreview] = useState<any | null>(null)
  const [galleryAssets, setGalleryAssets] = useState([
    {
      id: 1,
      title: 'Comprovante de Assinatura',
      fileName: 'comprovante_asaas_maio.pdf',
      type: 'pdf',
      size: '2.4 MB',
      updatedAt: '21/05/2026',
      url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&auto=format&fit=crop&q=60',
      downloadUrl: '#',
      externalUrl: 'https://www.asaas.com',
      category: 'pdf'
    },
    {
      id: 2,
      title: 'Logo da Empresa (Dark)',
      fileName: 'logo_corporativo_dark.png',
      type: 'image',
      size: '850 KB',
      updatedAt: '20/05/2026',
      url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop&q=60',
      downloadUrl: '#',
      externalUrl: 'https://github.com',
      category: 'image'
    },
    {
      id: 3,
      title: 'Contrato Social Registrado',
      fileName: 'contrato_social_agtech_consolidado.pdf',
      type: 'pdf',
      size: '4.1 MB',
      updatedAt: '18/05/2026',
      url: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=400&auto=format&fit=crop&q=60',
      downloadUrl: '#',
      externalUrl: 'https://google.com',
      category: 'pdf'
    },
    {
      id: 4,
      title: 'Mockup de UI Dashboard',
      fileName: 'dashboard_redesign_v3.jpg',
      type: 'image',
      size: '1.2 MB',
      updatedAt: '15/05/2026',
      url: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=400&auto=format&fit=crop&q=60',
      downloadUrl: '#',
      externalUrl: 'https://figma.com',
      category: 'image'
    }
  ])

  const filteredGalleryAssets = galleryAssets.filter(asset => {
    const matchesFilter = galleryFilter === 'all' || asset.type === galleryFilter
    const matchesSearch = asset.title.toLowerCase().includes(gallerySearchQuery.toLowerCase()) || 
                          asset.fileName.toLowerCase().includes(gallerySearchQuery.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const triggerToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const handleAddRecord = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRecordName || !newRecordEmail) return
    const newRec = {
      id: Date.now(),
      name: newRecordName,
      email: newRecordEmail,
      status: 'Ativo'
    }
    setPesquisaCadastroRecords([...pesquisaCadastroRecords, newRec])
    setNewRecordName('')
    setNewRecordEmail('')
    setIsDrawerOpen(false)
    triggerToast(t('runtime.create_success'))
  }

  const handleDeleteRecord = (id: number) => {
    setPesquisaCadastroRecords(pesquisaCadastroRecords.filter(r => r.id !== id))
    triggerToast(t('runtime.delete_success'))
  }

  const handleRegSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!regName || !regEmail) return
    setRegSuccess(true)
    setTimeout(() => {
      setRegSuccess(false)
      setRegName('')
      setRegEmail('')
    }, 4000)
  }

  const handleKanbanDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleKanbanDragOver = (e: React.DragEvent, status: string) => {
    e.preventDefault()
    setDraggedOverColumn(status)
  }

  const handleKanbanDragLeave = () => {
    setDraggedOverColumn(null)
  }

  const handleKanbanDrop = (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault()
    setDraggedOverColumn(null)
    const id = e.dataTransfer.getData('text/plain')
    if (!id) return
    setKanbanTasks(prev => prev.map(t => {
      if (t.id === id) {
        return { ...t, status: targetStatus }
      }
      return t
    }))
    triggerToast('Tarefa movida com sucesso!')
  }

  const runCustomQuery = () => {
    setIsSqlRunning(true)
    setTimeout(() => {
      setSqlResults([
        { id: 101, name: 'Licença Enterprise', count: 12 },
        { id: 102, name: 'Suporte Premium 24/7', count: 4 },
        { id: 103, name: 'Consultoria de Migração', count: 7 },
      ])
      setIsSqlRunning(false)
    }, 800)
  }

  // Filtered lists for simulation
  const filteredPesquisaCadastro = pesquisaCadastroRecords.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    r.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const searchOnlyRecords = [
    { code: 'MB-892', description: 'Servidor VPS Cloud', region: 'SP-East', usage: '84%' },
    { code: 'MB-412', description: 'Banco de Dados SSD', region: 'RJ-South', usage: '21%' },
    { code: 'MB-301', description: 'Load Balancer Edge', region: 'BH-Central', usage: '92%' },
    { code: 'MB-112', description: 'Firewall NGFW Local', region: 'PR-South', usage: '48%' },
  ]
  const filteredSearchOnly = searchOnlyRecords.filter(r => 
    r.description.toLowerCase().includes(searchOnlyQuery.toLowerCase()) ||
    r.code.toLowerCase().includes(searchOnlyQuery.toLowerCase())
  )

  const useCasesList: { id: UseCaseType; icon: React.ReactNode; color: string }[] = [
    // 1. Gestão de Dados e Cadastros
    { id: 'pesquisa', icon: <Search className="w-5 h-5" />, color: 'from-cyan-500 to-cyan-600' },
    { id: 'cadastro', icon: <UserPlus className="w-5 h-5" />, color: 'from-emerald-500 to-emerald-600' },
    { id: 'pesquisa_cadastro', icon: <Layers className="w-5 h-5" />, color: 'from-indigo-500 to-indigo-600' },
    { id: 'master_detail', icon: <Layout className="w-5 h-5" />, color: 'from-purple-500 to-purple-600' },
    
    // 2. Projetos, Prazos e Cronogramas
    { id: 'kanban', icon: <KanbanIcon className="w-5 h-5" />, color: 'from-orange-500 to-orange-600' },
    { id: 'timeline', icon: <History className="w-5 h-5" />, color: 'from-violet-500 to-violet-600' },
    { id: 'gantt', icon: <Calendar className="w-5 h-5" />, color: 'from-sky-500 to-sky-600' },
    { id: 'agenda', icon: <Calendar className="w-5 h-5" />, color: 'from-teal-500 to-teal-600' },
    
    // 3. Mapeamento, Fluxos e Espacial
    { id: 'blueprint', icon: <GitBranch className="w-5 h-5" />, color: 'from-purple-500 to-indigo-600' },
    { id: 'mapa_mental', icon: <GitFork className="w-5 h-5" />, color: 'from-pink-500 to-pink-600' },
    { id: 'map', icon: <MapPin className="w-5 h-5" />, color: 'from-blue-500 to-cyan-600' },
    
    // 4. Inteligência, Mídia e Outros
    { id: 'dashboard', icon: <BarChart3 className="w-5 h-5" />, color: 'from-blue-500 to-blue-600' },
    { id: 'galeria', icon: <LayoutGrid className="w-5 h-5" />, color: 'from-rose-500 to-pink-600' },
    { id: 'personalizado', icon: <Terminal className="w-5 h-5" />, color: 'from-amber-500 to-amber-600' },
  ]

  return (
    <div className="max-w-7xl mx-auto px-6 py-20 space-y-16">
      
      {/* Toast Notification for Mockups */}
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
          {t('marketing_v2.use_cases_page.badge')}
        </span>
      </div>

      {/* Hero Section */}
      <section className="space-y-6 max-w-4xl">
        <h1 className="text-5xl md:text-7xl font-black tracking-tighter dark:text-white leading-[1]">
          {t('marketing_v2.use_cases_page.title')} <br/>
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">
            {t('marketing_v2.use_cases_page.title_highlight')}
          </span>
        </h1>
        <p className="text-xl text-neutral-500 dark:text-neutral-400 leading-relaxed font-medium">
          {t('marketing_v2.use_cases_page.desc')}
        </p>
      </section>

      {/* Main Grid: Selectors & Live Mockup */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Side: selectors list */}
        <div className="lg:col-span-5 space-y-4">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-neutral-800 dark:text-neutral-200">
              {t('marketing_v2.use_cases_page.interactive_title')}
            </h2>
            <p className="text-xs text-neutral-400">
              {t('marketing_v2.use_cases_page.interactive_desc')}
            </p>
          </div>

          <div className="space-y-3">
            {useCasesList.map((useCase) => {
              const active = selectedType === useCase.id
              const translationKey = `marketing_v2.use_cases_page.items.${useCase.id}.title`
              const descKey = `marketing_v2.use_cases_page.items.${useCase.id}.desc`
              
              return (
                <button
                  key={useCase.id}
                  id={`btn-use-case-${useCase.id}`}
                  onClick={() => setSelectedType(useCase.id)}
                  className={`w-full text-left p-5 rounded-3xl border transition-all duration-300 flex items-start gap-4 ${
                    active 
                      ? 'bg-indigo-500/10 border-indigo-500/30 shadow-lg shadow-indigo-500/5' 
                      : 'bg-white dark:bg-neutral-900/40 border-neutral-200 dark:border-neutral-800/80 hover:border-neutral-300 dark:hover:border-neutral-700/80 hover:bg-neutral-50 dark:hover:bg-neutral-900/60'
                  }`}
                >
                  <div className={`p-3 rounded-2xl bg-gradient-to-br ${useCase.color} text-white shrink-0`}>
                    {useCase.icon}
                  </div>
                  <div className="space-y-1">
                    <h3 className={`font-bold text-base transition-colors ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-neutral-800 dark:text-neutral-200'}`}>
                      {t(translationKey)}
                    </h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-normal">
                      {t(descKey)}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Right Side: Interactive Mockup Container */}
        <div className="lg:col-span-7 sticky top-24">
          <div className="relative rounded-[2.5rem] bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-2xl min-h-[500px] flex flex-col">
            
            {/* Mockup Header */}
            <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
              </div>
              <span className="text-[10px] font-black tracking-widest text-neutral-400 uppercase">
                {t(`marketing_v2.use_cases_page.items.${selectedType}.title`)} - SIMULADOR RUNTIME
              </span>
              <div className="w-6"></div>
            </div>

            {/* Mockup Interactive Content Area */}
            <div className={`flex-grow flex flex-col justify-between ${selectedType === 'agenda' ? 'p-4 sm:p-5' : 'p-8'}`}>
              <div className="w-full flex-grow">
                
                {/* 1. PESQUISA + CADASTRO MOCKUP */}
                {selectedType === 'pesquisa_cadastro' && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-6"
                  >
                    <div className="flex flex-col sm:flex-row gap-3 justify-between">
                      <div className="relative flex-grow">
                        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input 
                          type="text" 
                          placeholder={t('marketing_v2.use_cases_page.mockups.search')}
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-xs font-medium focus:outline-none focus:border-indigo-500 text-neutral-800 dark:text-neutral-200"
                        />
                      </div>
                      <button 
                        onClick={() => setIsDrawerOpen(true)}
                        className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors flex items-center gap-1.5 shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{t('marketing_v2.use_cases_page.mockups.add_btn')}</span>
                      </button>
                    </div>

                    <div className="border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden bg-white dark:bg-neutral-950 shadow-sm">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-[10px] font-black uppercase text-neutral-400 tracking-wider">
                            <th className="px-4 py-3">{t('marketing_v2.use_cases_page.mockups.name')}</th>
                            <th className="px-4 py-3 hidden sm:table-cell">{t('marketing_v2.use_cases_page.mockups.email')}</th>
                            <th className="px-4 py-3">{t('marketing_v2.use_cases_page.mockups.status')}</th>
                            <th className="px-4 py-3 text-right">{t('marketing_v2.use_cases_page.mockups.actions')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
                          {filteredPesquisaCadastro.length > 0 ? (
                            filteredPesquisaCadastro.map((rec) => (
                              <tr key={rec.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 transition-colors">
                                <td className="px-4 py-3.5 font-bold text-neutral-800 dark:text-neutral-200">{rec.name}</td>
                                <td className="px-4 py-3.5 text-neutral-500 dark:text-neutral-400 hidden sm:table-cell">{rec.email}</td>
                                <td className="px-4 py-3.5">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${rec.status === 'Ativo' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-neutral-500/10 text-neutral-400'}`}>
                                    {rec.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3.5 text-right">
                                  <button 
                                    onClick={() => setRecordToDelete(rec.id)}
                                    className="text-red-400 hover:text-red-600 hover:bg-red-500/10 p-1.5 rounded-lg transition-colors inline-block"
                                    title="Excluir"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={4} className="px-4 py-8 text-center text-neutral-400 italic">
                                {t('runtime.no_results')}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Dynamic Drawer Overlay Simulator */}
                    <AnimatePresence>
                      {isDrawerOpen && (
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-30 rounded-[2.5rem] overflow-hidden flex justify-end">
                          <motion.div 
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="w-full sm:w-[320px] bg-white dark:bg-neutral-950 border-l border-neutral-200 dark:border-neutral-800 h-full p-6 flex flex-col justify-between"
                          >
                            <div className="space-y-6">
                              <h4 className="text-sm font-black uppercase tracking-widest text-neutral-800 dark:text-white">
                                {t('marketing_v2.use_cases_page.mockups.add_btn')}
                              </h4>
                              <form onSubmit={handleAddRecord} className="space-y-4">
                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-black uppercase text-neutral-400">{t('marketing_v2.use_cases_page.mockups.name')}</label>
                                  <input 
                                    type="text" 
                                    required
                                    value={newRecordName}
                                    onChange={(e) => setNewRecordName(e.target.value)}
                                    className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-indigo-500"
                                    placeholder="Ex: David Silva"
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-black uppercase text-neutral-400">{t('marketing_v2.use_cases_page.mockups.email')}</label>
                                  <input 
                                    type="email" 
                                    required
                                    value={newRecordEmail}
                                    onChange={(e) => setNewRecordEmail(e.target.value)}
                                    className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-indigo-500"
                                    placeholder="Ex: david@empresa.com"
                                  />
                                </div>
                                <div className="pt-4 flex gap-2">
                                  <button 
                                    type="submit" 
                                    className="flex-grow py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors"
                                  >
                                    {t('marketing_v2.use_cases_page.mockups.save')}
                                  </button>
                                  <button 
                                    type="button" 
                                    onClick={() => setIsDrawerOpen(false)}
                                    className="px-3 py-2 border border-neutral-200 dark:border-neutral-800 text-neutral-500 rounded-lg text-xs hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
                                  >
                                    {t('marketing_v2.use_cases_page.mockups.cancel')}
                                  </button>
                                </div>
                              </form>
                            </div>
                          </motion.div>
                        </div>
                      )}
                    </AnimatePresence>

                    {/* Delete Confirmation Overlay Simulator */}
                    <AnimatePresence>
                      {recordToDelete !== null && (
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-30 rounded-[2.5rem] overflow-hidden flex items-center justify-center p-6">
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="w-full max-w-sm bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-5"
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-2xl bg-red-500/10 dark:bg-red-500/20 text-red-500 dark:text-red-400 flex items-center justify-center shrink-0">
                                <Trash2 className="w-5 h-5" />
                              </div>
                              <div className="space-y-1 text-left">
                                <h4 className="text-sm font-bold text-neutral-800 dark:text-white leading-tight">
                                  {t('marketing_v2.use_cases_page.mockups.delete_confirm_title')}
                                </h4>
                                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                                  {t('marketing_v2.use_cases_page.mockups.delete_confirm_desc')}
                                </p>
                              </div>
                            </div>

                            <div className="pt-2 flex gap-2">
                              <button 
                                onClick={() => {
                                  if (recordToDelete !== null) {
                                    handleDeleteRecord(recordToDelete)
                                    setRecordToDelete(null)
                                  }
                                }}
                                className="flex-grow py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors"
                              >
                                {t('marketing_v2.use_cases_page.mockups.delete_confirm_yes')}
                              </button>
                              <button 
                                type="button" 
                                onClick={() => setRecordToDelete(null)}
                                className="px-4 py-2.5 border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 rounded-xl text-xs font-bold hover:bg-neutral-50 dark:hover:bg-neutral-905 transition-colors"
                              >
                                {t('marketing_v2.use_cases_page.mockups.delete_confirm_no')}
                              </button>
                            </div>
                          </motion.div>
                        </div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                {/* 2. CADASTRO APENAS MOCKUP */}
                {selectedType === 'cadastro' && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-md mx-auto bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm space-y-6"
                  >
                    <div className="border-b border-neutral-100 dark:border-neutral-800 pb-4">
                      <h4 className="text-sm font-black uppercase tracking-widest text-neutral-800 dark:text-white">
                        {t('marketing_v2.use_cases_page.items.cadastro.title')}
                      </h4>
                      <p className="text-[10px] text-neutral-400 mt-1">
                        Instanciação pura e isolada de inputs para gravação direta no banco.
                      </p>
                    </div>

                    <AnimatePresence mode="wait">
                      {regSuccess ? (
                        <motion.div 
                          key="success-form"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="py-10 text-center space-y-4"
                        >
                          <div className="w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center mx-auto text-xl font-bold">
                            ✓
                          </div>
                          <div className="space-y-1">
                            <h5 className="font-bold text-emerald-500 text-sm">Registro Salvo!</h5>
                            <p className="text-[11px] text-neutral-400">Dados persistidos com sucesso via Túnel do MetaBuilder.</p>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.form 
                          key="active-form"
                          onSubmit={handleRegSubmit} 
                          className="space-y-4 text-left"
                        >
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase text-neutral-400">{t('marketing_v2.use_cases_page.mockups.name')}</label>
                            <input 
                              type="text" 
                              required
                              value={regName}
                              onChange={(e) => setRegName(e.target.value)}
                              className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-indigo-500"
                              placeholder="Nome completo..."
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase text-neutral-400">{t('marketing_v2.use_cases_page.mockups.email')}</label>
                            <input 
                              type="email" 
                              required
                              value={regEmail}
                              onChange={(e) => setRegEmail(e.target.value)}
                              className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-indigo-500"
                              placeholder="e-mail de contato..."
                            />
                          </div>
                          <button 
                            type="submit" 
                            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all hover:scale-[1.02] shadow-lg shadow-emerald-500/10"
                          >
                            {t('marketing_v2.use_cases_page.mockups.save')}
                          </button>
                        </motion.form>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                {/* 3. PESQUISA APENAS MOCKUP */}
                {selectedType === 'pesquisa' && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-6"
                  >
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                      <input 
                        type="text" 
                        placeholder="Pesquisar por descrição ou código (Ex: Servidor, Edge)..."
                        value={searchOnlyQuery}
                        onChange={(e) => setSearchOnlyQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-xs font-medium focus:outline-none focus:border-indigo-500 text-neutral-800 dark:text-neutral-200"
                      />
                    </div>

                    <div className="border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden bg-white dark:bg-neutral-950 shadow-sm">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-[10px] font-black uppercase text-neutral-400 tracking-wider">
                            <th className="px-4 py-3">Código</th>
                            <th className="px-4 py-3">Descrição</th>
                            <th className="px-4 py-3">Região</th>
                            <th className="px-4 py-3 text-right">Uso de CPU</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
                          {filteredSearchOnly.length > 0 ? (
                            filteredSearchOnly.map((rec, idx) => (
                              <tr key={idx} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 transition-colors">
                                <td className="px-4 py-3.5 font-mono text-[10px] font-bold text-neutral-800 dark:text-neutral-200">{rec.code}</td>
                                <td className="px-4 py-3.5 text-neutral-600 dark:text-neutral-400">{rec.description}</td>
                                <td className="px-4 py-3.5 text-neutral-500">{rec.region}</td>
                                <td className="px-4 py-3.5 text-right font-bold text-neutral-800 dark:text-neutral-200">
                                  <div className="flex items-center justify-end gap-2">
                                    <span>{rec.usage}</span>
                                    <div className="w-12 h-1.5 bg-neutral-100 dark:bg-neutral-850 rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-cyan-500" 
                                        style={{ width: rec.usage }}
                                      ></div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={4} className="px-4 py-8 text-center text-neutral-400 italic">
                                {t('runtime.no_results')}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}

                {/* 4. MESTRE-DETALHE MOCKUP */}
                {selectedType === 'master_detail' && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-6"
                  >
                    {/* Master Record Panel */}
                    <div className="p-5 rounded-2xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                      <div className="space-y-1">
                        <span className="text-[9px] font-black uppercase text-neutral-400">{t('runtime.master_details.main_data')}</span>
                        <h4 className="text-sm font-extrabold text-neutral-800 dark:text-white">Alexandre Silva</h4>
                        <p className="text-[10px] text-neutral-500">ID: #349202</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] font-black uppercase text-neutral-400">Plano</span>
                        <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200">Pro Enterprise</p>
                      </div>
                      <div className="space-y-1 sm:text-right">
                        <span className="text-[9px] font-black uppercase text-neutral-400">Total Faturado</span>
                        <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">R$ 14.820,00</p>
                      </div>
                    </div>

                    {/* Details Relational Tabs */}
                    <div className="space-y-3">
                      <div className="flex border-b border-neutral-200 dark:border-neutral-800">
                        <button 
                          onClick={() => setActiveDetailTab('items')}
                          className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${activeDetailTab === 'items' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'}`}
                        >
                          {t('marketing_v2.use_cases_page.mockups.tab_items')} (2)
                        </button>
                        <button 
                          onClick={() => setActiveDetailTab('payments')}
                          className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${activeDetailTab === 'payments' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'}`}
                        >
                          {t('marketing_v2.use_cases_page.mockups.tab_payments')} (3)
                        </button>
                        <button 
                          onClick={() => setActiveDetailTab('logs')}
                          className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${activeDetailTab === 'logs' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'}`}
                        >
                          {t('marketing_v2.use_cases_page.mockups.tab_logs')}
                        </button>
                      </div>

                      <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden p-4 min-h-[160px]">
                        <AnimatePresence mode="wait">
                          {activeDetailTab === 'items' && (
                            <motion.div 
                              key="items-detail"
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              className="space-y-3"
                            >
                              <div className="grid grid-cols-3 text-[9px] font-black uppercase text-neutral-400 tracking-wider border-b border-neutral-100 dark:border-neutral-800 pb-2">
                                <span>{t('marketing_v2.use_cases_page.mockups.item_name')}</span>
                                <span className="text-center">{t('marketing_v2.use_cases_page.mockups.qty')}</span>
                                <span className="text-right">{t('marketing_v2.use_cases_page.mockups.price')}</span>
                              </div>
                              <div className="grid grid-cols-3 text-xs">
                                <span className="font-bold text-neutral-800 dark:text-neutral-300">Database Connector Cloud</span>
                                <span className="text-center">1</span>
                                <span className="text-right text-neutral-600 dark:text-neutral-400">R$ 9.600,00</span>
                              </div>
                              <div className="grid grid-cols-3 text-xs">
                                <span className="font-bold text-neutral-800 dark:text-neutral-300">Suporte Dedicado 24h</span>
                                <span className="text-center">12</span>
                                <span className="text-right text-neutral-600 dark:text-neutral-400">R$ 435,00/mês</span>
                              </div>
                            </motion.div>
                          )}

                          {activeDetailTab === 'payments' && (
                            <motion.div 
                              key="payments-detail"
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              className="space-y-3"
                            >
                              <div className="grid grid-cols-3 text-[9px] font-black uppercase text-neutral-400 border-b border-neutral-100 dark:border-neutral-800 pb-2">
                                <span>ID Transação</span>
                                <span>Data</span>
                                <span className="text-right">Status</span>
                              </div>
                              <div className="grid grid-cols-3 text-xs">
                                <span className="font-mono text-[10px]">TX-98231</span>
                                <span className="text-neutral-500">21/05/2026</span>
                                <span className="text-right text-emerald-500 font-bold">Pago</span>
                              </div>
                              <div className="grid grid-cols-3 text-xs">
                                <span className="font-mono text-[10px]">TX-97210</span>
                                <span className="text-neutral-500">21/04/2026</span>
                                <span className="text-right text-emerald-500 font-bold">Pago</span>
                              </div>
                              <div className="grid grid-cols-3 text-xs">
                                <span className="font-mono text-[10px]">TX-96102</span>
                                <span className="text-neutral-500">21/03/2026</span>
                                <span className="text-right text-amber-500 font-bold">Pendente</span>
                              </div>
                            </motion.div>
                          )}

                          {activeDetailTab === 'logs' && (
                            <motion.div 
                              key="logs-detail"
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              className="text-xs text-neutral-500 space-y-2 font-mono"
                            >
                              <p>[2026-05-21 15:30] ✓ Conectado com sucesso via Túnel Seguro.</p>
                              <p>[2026-05-21 14:12] 📝 Registro alterado por administrador@empresa.com</p>
                              <p>[2026-05-20 09:41] 🚀 Mapeamento semântico de relacionamentos (FK) atualizado.</p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* 5. KANBAN MOCKUP */}
                {selectedType === 'kanban' && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-4"
                  >
                    <div className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-2xl p-4 text-xs font-bold text-center">
                      💡 Arraste os cartões entre as colunas para simular a atualização do DB!
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      
                      {/* TODO COLUMN */}
                      <div 
                        onDragOver={(e) => handleKanbanDragOver(e, 'todo')}
                        onDragLeave={handleKanbanDragLeave}
                        onDrop={(e) => handleKanbanDrop(e, 'todo')}
                        className={`p-3 rounded-2xl border transition-all duration-200 space-y-3 min-h-[220px] ${
                          draggedOverColumn === 'todo'
                            ? 'bg-indigo-500/5 dark:bg-indigo-500/10 border-indigo-500 border-dashed scale-[1.01]'
                            : 'bg-neutral-100 dark:bg-neutral-950/60 border-neutral-200 dark:border-neutral-850'
                        }`}
                      >
                        <h5 className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">
                          {t('marketing_v2.use_cases_page.mockups.to_do')}
                        </h5>
                        <div className="space-y-2">
                          {kanbanTasks.filter(t => t.status === 'todo').map(task => (
                            <div
                              key={task.id}
                              draggable
                              onDragStart={(e) => handleKanbanDragStart(e, task.id)}
                              className="w-full text-left p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm text-xs font-bold hover:scale-[1.03] transition-all text-neutral-800 dark:text-neutral-200 cursor-grab active:cursor-grabbing hover:shadow-md"
                            >
                              {task.title}
                              <div className="mt-3 flex justify-between items-center text-[8px] font-extrabold text-indigo-500 uppercase tracking-widest">
                                <span>ID: {task.id}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* IN PROGRESS COLUMN */}
                      <div 
                        onDragOver={(e) => handleKanbanDragOver(e, 'inprogress')}
                        onDragLeave={handleKanbanDragLeave}
                        onDrop={(e) => handleKanbanDrop(e, 'inprogress')}
                        className={`p-3 rounded-2xl border transition-all duration-200 space-y-3 min-h-[220px] ${
                          draggedOverColumn === 'inprogress'
                            ? 'bg-indigo-500/5 dark:bg-indigo-500/10 border-indigo-500 border-dashed scale-[1.01]'
                            : 'bg-neutral-100 dark:bg-neutral-950/60 border-neutral-200 dark:border-neutral-850'
                        }`}
                      >
                        <h5 className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">
                          {t('marketing_v2.use_cases_page.mockups.in_progress')}
                        </h5>
                        <div className="space-y-2">
                          {kanbanTasks.filter(t => t.status === 'inprogress').map(task => (
                            <div
                              key={task.id}
                              draggable
                              onDragStart={(e) => handleKanbanDragStart(e, task.id)}
                              className="w-full text-left p-3 bg-white dark:bg-neutral-900 border border-indigo-500/25 dark:border-indigo-500/20 rounded-xl shadow-sm text-xs font-bold hover:scale-[1.03] transition-all text-neutral-800 dark:text-neutral-200 cursor-grab active:cursor-grabbing hover:shadow-md"
                            >
                              {task.title}
                              <div className="mt-3 flex justify-between items-center text-[8px] font-extrabold text-amber-500 uppercase tracking-widest">
                                <span>ID: {task.id}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* DONE COLUMN */}
                      <div 
                        onDragOver={(e) => handleKanbanDragOver(e, 'done')}
                        onDragLeave={handleKanbanDragLeave}
                        onDrop={(e) => handleKanbanDrop(e, 'done')}
                        className={`p-3 rounded-2xl border transition-all duration-200 space-y-3 min-h-[220px] ${
                          draggedOverColumn === 'done'
                            ? 'bg-indigo-500/5 dark:bg-indigo-500/10 border-indigo-500 border-dashed scale-[1.01]'
                            : 'bg-neutral-100 dark:bg-neutral-950/60 border-neutral-200 dark:border-neutral-850'
                        }`}
                      >
                        <h5 className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">
                          {t('marketing_v2.use_cases_page.mockups.done')}
                        </h5>
                        <div className="space-y-2">
                          {kanbanTasks.filter(t => t.status === 'done').map(task => (
                            <div
                              key={task.id}
                              draggable
                              onDragStart={(e) => handleKanbanDragStart(e, task.id)}
                              className="w-full text-left p-3 bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-850 text-neutral-400 dark:text-neutral-500 rounded-xl text-xs line-through hover:scale-[1.03] transition-all cursor-grab active:cursor-grabbing hover:shadow-md"
                            >
                              {task.title}
                              <div className="mt-3 flex justify-between items-center text-[8px] font-extrabold text-emerald-500 uppercase tracking-widest">
                                <span>ID: {task.id}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  </motion.div>
                )}

                {/* 6. MAPA MENTAL MOCKUP */}
                {selectedType === 'mapa_mental' && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-6 flex flex-col items-center"
                  >
                    {/* SVG Mind Map Simulator */}
                    <div className="w-full max-w-lg aspect-[4/3] bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 relative overflow-hidden flex items-center justify-center">
                      
                      <svg className="w-full h-full absolute inset-0 pointer-events-none" viewBox="0 0 400 300">
                        <AnimatePresence>
                          {isMindMapExpanded && (
                            <motion.line 
                              key="line-finance"
                              initial={{ pathLength: 0, opacity: 0 }}
                              animate={{ pathLength: 1, opacity: 1 }}
                              exit={{ pathLength: 0, opacity: 0 }}
                              transition={{ duration: 0.4 }}
                              x1="200" y1="150" x2="80" y2="80" 
                              stroke="#6366f1" strokeWidth="2" strokeDasharray="3 3" 
                            />
                          )}
                          {isMindMapExpanded && (
                            <motion.line 
                              key="line-sales"
                              initial={{ pathLength: 0, opacity: 0 }}
                              animate={{ pathLength: 1, opacity: 1 }}
                              exit={{ pathLength: 0, opacity: 0 }}
                              transition={{ duration: 0.4 }}
                              x1="200" y1="150" x2="320" y2="80" 
                              stroke="#6366f1" strokeWidth="2" strokeDasharray="3 3" 
                            />
                          )}
                          {isMindMapExpanded && (
                            <motion.line 
                              key="line-hr"
                              initial={{ pathLength: 0, opacity: 0 }}
                              animate={{ pathLength: 1, opacity: 1 }}
                              exit={{ pathLength: 0, opacity: 0 }}
                              transition={{ duration: 0.4 }}
                              x1="200" y1="150" x2="200" y2="230" 
                              stroke="#6366f1" strokeWidth="2" strokeDasharray="3 3" 
                            />
                          )}
                          
                          {/* Sub-connections for Financeiro */}
                          {isMindMapExpanded && isFinanceExpanded && (
                            <motion.line 
                              key="line-billing"
                              initial={{ pathLength: 0, opacity: 0 }}
                              animate={{ pathLength: 1, opacity: 1 }}
                              exit={{ pathLength: 0, opacity: 0 }}
                              transition={{ duration: 0.3 }}
                              x1="80" y1="80" x2="35" y2="35" 
                              stroke="#a855f7" strokeWidth="1.5" 
                            />
                          )}
                          {isMindMapExpanded && isFinanceExpanded && (
                            <motion.line 
                              key="line-treasury"
                              initial={{ pathLength: 0, opacity: 0 }}
                              animate={{ pathLength: 1, opacity: 1 }}
                              exit={{ pathLength: 0, opacity: 0 }}
                              transition={{ duration: 0.3 }}
                              x1="80" y1="80" x2="30" y2="115" 
                              stroke="#a855f7" strokeWidth="1.5" 
                            />
                          )}

                          {/* Sub-connections for Vendas */}
                          {isMindMapExpanded && isSalesExpanded && (
                            <motion.line 
                              key="line-crm"
                              initial={{ pathLength: 0, opacity: 0 }}
                              animate={{ pathLength: 1, opacity: 1 }}
                              exit={{ pathLength: 0, opacity: 0 }}
                              transition={{ duration: 0.3 }}
                              x1="320" y1="80" x2="365" y2="35" 
                              stroke="#ec4899" strokeWidth="1.5" 
                            />
                          )}
                          {isMindMapExpanded && isSalesExpanded && (
                            <motion.line 
                              key="line-pipeline"
                              initial={{ pathLength: 0, opacity: 0 }}
                              animate={{ pathLength: 1, opacity: 1 }}
                              exit={{ pathLength: 0, opacity: 0 }}
                              transition={{ duration: 0.3 }}
                              x1="320" y1="80" x2="370" y2="115" 
                              stroke="#ec4899" strokeWidth="1.5" 
                            />
                          )}

                          {/* Sub-connections for RH */}
                          {isMindMapExpanded && isHrExpanded && (
                            <motion.line 
                              key="line-recruitment"
                              initial={{ pathLength: 0, opacity: 0 }}
                              animate={{ pathLength: 1, opacity: 1 }}
                              exit={{ pathLength: 0, opacity: 0 }}
                              transition={{ duration: 0.3 }}
                              x1="200" y1="230" x2="105" y2="260" 
                              stroke="#6366f1" strokeWidth="1.5" 
                            />
                          )}
                          {isMindMapExpanded && isHrExpanded && (
                            <motion.line 
                              key="line-payroll"
                              initial={{ pathLength: 0, opacity: 0 }}
                              animate={{ pathLength: 1, opacity: 1 }}
                              exit={{ pathLength: 0, opacity: 0 }}
                              transition={{ duration: 0.3 }}
                              x1="200" y1="230" x2="295" y2="260" 
                              stroke="#6366f1" strokeWidth="1.5" 
                            />
                          )}
                        </AnimatePresence>
                      </svg>

                      {/* Mind Map Nodes */}
                      <div className="relative w-full h-full flex items-center justify-center">
                        
                        {/* Central Node */}
                        <div 
                          onClick={() => {
                            const nextState = !isMindMapExpanded
                            setIsMindMapExpanded(nextState)
                            if (!nextState) {
                              setIsFinanceExpanded(false)
                              setIsSalesExpanded(false)
                              setIsHrExpanded(false)
                            }
                            triggerToast(nextState ? 'Mapa expandido!' : 'Mapa recolhido!')
                          }}
                          className="absolute w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-center p-3 text-[10px] font-black uppercase tracking-wider shadow-xl cursor-pointer hover:scale-110 active:scale-95 transition-all z-10"
                        >
                          {t('marketing_v2.use_cases_page.mockups.central_node')}
                        </div>

                        <AnimatePresence>
                          {isMindMapExpanded && (
                            <motion.div 
                              key="node-finance"
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{ type: 'spring', stiffness: 180, damping: 15 }}
                              onClick={() => {
                                const nextState = !isFinanceExpanded
                                setIsFinanceExpanded(nextState)
                                triggerToast(nextState ? 'Financeiro expandido!' : 'Financeiro recolhido!')
                              }}
                              className="absolute left-[30px] top-[40px] px-4 py-2.5 rounded-2xl bg-white dark:bg-neutral-900 border border-purple-500/40 text-neutral-800 dark:text-neutral-200 text-xs font-bold shadow-md cursor-pointer hover:scale-105 transition-transform z-10"
                            >
                              💵 {t('marketing_v2.use_cases_page.mockups.node_finance')}
                            </motion.div>
                          )}

                          {/* Node 1.1: Billing (Faturamento) */}
                          {isMindMapExpanded && isFinanceExpanded && (
                            <motion.div 
                              key="node-billing"
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{ type: 'spring', stiffness: 180, damping: 15 }}
                              onClick={() => triggerToast(t('marketing_v2.use_cases_page.mockups.node_billing'))}
                              className="absolute left-[5px] top-[5px] px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-purple-500/30 text-purple-600 dark:text-purple-400 text-[10px] font-bold shadow-sm cursor-pointer hover:scale-105 transition-transform z-10"
                            >
                              {t('marketing_v2.use_cases_page.mockups.node_billing')}
                            </motion.div>
                          )}

                          {/* Node 1.2: Treasury (Tesouraria) */}
                          {isMindMapExpanded && isFinanceExpanded && (
                            <motion.div 
                              key="node-treasury"
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{ type: 'spring', stiffness: 180, damping: 15 }}
                              onClick={() => triggerToast(t('marketing_v2.use_cases_page.mockups.node_treasury'))}
                              className="absolute left-[2px] top-[110px] px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-purple-500/30 text-purple-600 dark:text-purple-400 text-[10px] font-bold shadow-sm cursor-pointer hover:scale-105 transition-transform z-10"
                            >
                              {t('marketing_v2.use_cases_page.mockups.node_treasury')}
                            </motion.div>
                          )}

                          {/* Node 2: Sales */}
                          {isMindMapExpanded && (
                            <motion.div 
                              key="node-sales"
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{ type: 'spring', stiffness: 180, damping: 15 }}
                              onClick={() => {
                                const nextState = !isSalesExpanded
                                setIsSalesExpanded(nextState)
                                triggerToast(nextState ? 'Vendas expandido!' : 'Vendas recolhido!')
                              }}
                              className="absolute right-[30px] top-[40px] px-4 py-2.5 rounded-2xl bg-white dark:bg-neutral-900 border border-pink-500/40 text-neutral-800 dark:text-neutral-200 text-xs font-bold shadow-md cursor-pointer hover:scale-105 transition-transform z-10"
                            >
                              📈 {t('marketing_v2.use_cases_page.mockups.node_sales')}
                            </motion.div>
                          )}

                          {/* Node 2.1: CRM (CRM Vendas) */}
                          {isMindMapExpanded && isSalesExpanded && (
                            <motion.div 
                              key="node-crm"
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{ type: 'spring', stiffness: 180, damping: 15 }}
                              onClick={() => triggerToast(t('marketing_v2.use_cases_page.mockups.node_crm'))}
                              className="absolute right-[5px] top-[5px] px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-pink-500/30 text-pink-600 dark:text-pink-400 text-[10px] font-bold shadow-sm cursor-pointer hover:scale-105 transition-transform z-10"
                            >
                              {t('marketing_v2.use_cases_page.mockups.node_crm')}
                            </motion.div>
                          )}

                          {/* Node 2.2: Pipeline (Funil Vendas) */}
                          {isMindMapExpanded && isSalesExpanded && (
                            <motion.div 
                              key="node-pipeline"
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{ type: 'spring', stiffness: 180, damping: 15 }}
                              onClick={() => triggerToast(t('marketing_v2.use_cases_page.mockups.node_pipeline'))}
                              className="absolute right-[2px] top-[110px] px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-pink-500/30 text-pink-600 dark:text-pink-400 text-[10px] font-bold shadow-sm cursor-pointer hover:scale-105 transition-transform z-10"
                            >
                              {t('marketing_v2.use_cases_page.mockups.node_pipeline')}
                            </motion.div>
                          )}

                          {/* Node 3: HR */}
                          {isMindMapExpanded && (
                            <motion.div 
                              key="node-hr"
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{ type: 'spring', stiffness: 180, damping: 15 }}
                              onClick={() => {
                                const nextState = !isHrExpanded
                                setIsHrExpanded(nextState)
                                triggerToast(nextState ? 'RH expandido!' : 'RH recolhido!')
                              }}
                              className="absolute bottom-[25px] px-4 py-2.5 rounded-2xl bg-white dark:bg-neutral-900 border border-indigo-500/40 text-neutral-800 dark:text-neutral-200 text-xs font-bold shadow-md cursor-pointer hover:scale-105 transition-transform z-10"
                            >
                              👥 {t('marketing_v2.use_cases_page.mockups.node_hr')}
                            </motion.div>
                          )}

                          {/* Node 3.1: Recruitment (Recrutamento) */}
                          {isMindMapExpanded && isHrExpanded && (
                            <motion.div 
                              key="node-recruitment"
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{ type: 'spring', stiffness: 180, damping: 15 }}
                              onClick={() => triggerToast(t('marketing_v2.use_cases_page.mockups.node_recruitment'))}
                              className="absolute left-[75px] bottom-[10px] px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold shadow-sm cursor-pointer hover:scale-105 transition-transform z-10"
                            >
                              {t('marketing_v2.use_cases_page.mockups.node_recruitment')}
                            </motion.div>
                          )}

                          {/* Node 3.2: Payroll (Folha de Pagto) */}
                          {isMindMapExpanded && isHrExpanded && (
                            <motion.div 
                              key="node-payroll"
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{ type: 'spring', stiffness: 180, damping: 15 }}
                              onClick={() => triggerToast(t('marketing_v2.use_cases_page.mockups.node_payroll'))}
                              className="absolute right-[75px] bottom-[10px] px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold shadow-sm cursor-pointer hover:scale-105 transition-transform z-10"
                            >
                              {t('marketing_v2.use_cases_page.mockups.node_payroll')}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* 7. DASHBOARD MOCKUP */}
                {selectedType === 'dashboard' && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-6"
                  >
                    {/* Period Selector Tabs */}
                    <div className="flex justify-between items-center bg-white dark:bg-neutral-950 p-2.5 rounded-2xl border border-neutral-250 dark:border-neutral-800 shadow-sm">
                      <span className="text-[10px] font-black uppercase text-neutral-450 tracking-wider pl-2">
                        Painel de Performance (BI)
                      </span>
                      <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-900 p-1 rounded-xl">
                        {(['7d', '30d', '12m'] as const).map((period) => (
                          <button
                            key={period}
                            onClick={() => setDashboardPeriod(period)}
                            className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-colors ${
                              dashboardPeriod === period
                                ? 'bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'
                            }`}
                          >
                            {period === '7d' ? '7 Dias' : period === '30d' ? '30 Dias' : '12 Meses'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Metric Cards Grid */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-4 bg-white dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-1">
                        <span className="text-[9px] font-black uppercase text-neutral-400">Faturamento</span>
                        <h4 className="text-sm font-black text-neutral-850 dark:text-white">
                          {dashboardPeriod === '7d' ? 'R$ 143,2 mil' : dashboardPeriod === '30d' ? 'R$ 589,4 mil' : 'R$ 6,84 mi'}
                        </h4>
                        <span className="text-[9px] font-bold text-emerald-500 block">
                          +{dashboardPeriod === '7d' ? '12%' : dashboardPeriod === '30d' ? '18%' : '32%'} vs ant.
                        </span>
                      </div>
                      <div className="p-4 bg-white dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-1">
                        <span className="text-[9px] font-black uppercase text-neutral-400">Assinaturas</span>
                        <h4 className="text-sm font-black text-neutral-850 dark:text-white">
                          {dashboardPeriod === '7d' ? '1.240' : dashboardPeriod === '30d' ? '1.380' : '2.450'}
                        </h4>
                        <span className="text-[9px] font-bold text-emerald-500 block">
                          +{dashboardPeriod === '7d' ? '5%' : dashboardPeriod === '30d' ? '8%' : '24%'} vs ant.
                        </span>
                      </div>
                      <div className="p-4 bg-white dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-1">
                        <span className="text-[9px] font-black uppercase text-neutral-400">Ticket Médio</span>
                        <h4 className="text-sm font-black text-neutral-850 dark:text-white">
                          {dashboardPeriod === '7d' ? 'R$ 115' : dashboardPeriod === '30d' ? 'R$ 427' : 'R$ 2.791'}
                        </h4>
                        <span className="text-[9px] font-bold text-indigo-500 block">Estável</span>
                      </div>
                    </div>

                    {/* Animated Bar Chart SVG representation */}
                    <div className="p-5 bg-white dark:bg-neutral-950 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
                      <span className="text-[10px] font-black uppercase text-neutral-450 tracking-wider">
                        Gráfico de Tendência de Receita
                      </span>
                      <div className="h-32 flex items-end justify-between gap-2 px-2 pt-4 relative">
                        {/* Helper grid lines */}
                        <div className="absolute inset-x-0 top-0 border-t border-dashed border-neutral-100 dark:border-neutral-800"></div>
                        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-dashed border-neutral-100 dark:border-neutral-800"></div>
                        
                        {/* Dynamic bar charts rendering */}
                        {(dashboardPeriod === '7d' 
                          ? [30, 45, 60, 20, 80, 50, 90] 
                          : dashboardPeriod === '30d' 
                          ? [40, 70, 55, 85, 60, 95] 
                          : [20, 30, 25, 45, 60, 55, 75, 80, 70, 90, 85, 100]
                        ).map((height, i) => (
                          <div key={i} className="flex-grow flex flex-col items-center gap-1 group">
                            {/* Fixed-height container for the bar to resolve percentage height calculation */}
                            <div className="w-full h-24 flex items-end justify-center relative">
                              <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: `${height}%` }}
                                transition={{ type: 'spring', damping: 15, stiffness: 100 }}
                                className="w-full max-w-[16px] sm:max-w-[20px] bg-gradient-to-t from-indigo-500 to-purple-500 rounded-t-lg group-hover:from-indigo-400 group-hover:to-purple-400 transition-colors relative"
                              >
                                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-neutral-900 text-white text-[9px] font-black px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-md z-10">
                                  {height}%
                                </div>
                              </motion.div>
                            </div>
                            <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest mt-1">
                              {dashboardPeriod === '7d' 
                                ? ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'][i] 
                                : dashboardPeriod === '30d' 
                                ? ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'][i] 
                                : ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][i]
                              }
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Stock Gauge Grid Component from Image */}
                    <div className="p-6 bg-white dark:bg-neutral-950 rounded-[2.5rem] border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-[#eaeefd] dark:bg-indigo-950/50 flex items-center justify-center text-[#5c72e7] dark:text-indigo-400 shrink-0">
                            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9C8.8 1 15.2 1 19.1 4.9C23 8.8 23 15.2 19.1 19.1" />
                              <path d="m12 12-4-4" />
                              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                            </svg>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <h4 className="text-base font-black uppercase text-black dark:text-white tracking-wider leading-none">ESTOQUE</h4>
                            <span className="text-[9px] font-bold text-[#94a3b8] dark:text-neutral-500 uppercase tracking-widest block">SUM (TODA TABELA)</span>
                          </div>
                        </div>
                        <button 
                          onClick={() => triggerToast('Pesquisa de estoque simulada!')}
                          className="p-2 text-[#94a3b8] hover:text-neutral-600 dark:hover:text-neutral-250 transition-colors"
                        >
                          <Search className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="flex gap-4 relative">
                        {/* Scrollable grid container */}
                        <div 
                          ref={estoqueGridRef}
                          onScroll={handleScroll}
                          className="flex-grow grid grid-cols-1 sm:grid-cols-3 gap-4 max-h-[350px] overflow-y-auto pr-2 scrollbar-none [&::-webkit-scrollbar]:hidden"
                          style={{
                            scrollbarWidth: 'none',
                            msOverflowStyle: 'none'
                          }}
                        >
                          {[
                            { name: 'NOTEBOOK NEO 15', value: 532, percent: 0.532, color: '#00b074' },
                            { name: 'CÂMERA DSLR HYPER 18', value: 35, percent: 0.175, color: '#ff9f00' },
                            { name: 'FONE DE OUVIDO APEX 21', value: 492, percent: 0.615, color: '#00b074' },
                            { name: 'SMARTWATCH PRIME 24', value: 10, percent: 0.033, color: '#ff3b30' },
                            { name: 'TECLADO MECÂNICO VORTEX 27', value: 1029, percent: 0.686, color: '#00b074' },
                            { name: 'MOUSE GAMER LEGEND 30', value: 1161, percent: 0.774, color: '#00b074' },
                            { name: 'MONITOR 4K ULTRA 33', value: 98, percent: 0.196, color: '#ff9f00' },
                            { name: 'IMPRESSORA 3D PRO MAX 36', value: 15, percent: 0.15, color: '#ff3b30' },
                            { name: 'CARREGADOR SEM FIO ELITE 39', value: 850, percent: 0.85, color: '#00b074' },
                          ].map((item, idx) => (
                            <div 
                              key={idx} 
                              onClick={() => triggerToast(`Estoque de ${item.name}: ${item.value} unidades`)}
                              className="bg-[#f8f9fa] dark:bg-neutral-900/40 p-5 rounded-[2.5rem] flex flex-col items-center justify-between text-center relative group hover:scale-[1.02] active:scale-95 transition-all duration-300 cursor-pointer"
                            >
                              <span className="text-[10px] font-bold text-[#8e9aa8] dark:text-neutral-400 tracking-wider mb-3 block uppercase">
                                {item.name}
                              </span>
                              
                              <div className="relative w-28 h-16 flex items-center justify-center">
                                <svg className="w-full h-full" viewBox="0 0 120 70">
                                  {/* Track Arc */}
                                  <path 
                                    d="M 15,60 A 45,45 0 0,1 105,60" 
                                    fill="none" 
                                    stroke="#e5e7eb" 
                                    strokeWidth="10" 
                                    strokeLinecap="round" 
                                    className="dark:stroke-neutral-800"
                                  />
                                  {/* Value Arc */}
                                  <path 
                                    d="M 15,60 A 45,45 0 0,1 105,60" 
                                    fill="none" 
                                    stroke={item.color} 
                                    strokeWidth="10" 
                                    strokeLinecap="round" 
                                    strokeDasharray="141" 
                                    strokeDashoffset={141 * (1 - item.percent)}
                                    className="transition-all duration-1000 ease-out"
                                  />
                                  {/* Pivot Center */}
                                  <circle cx="60" cy="60" r="3.5" fill="#171717" className="dark:fill-neutral-200" />
                                  {/* Needle */}
                                  <line 
                                    x1="60" 
                                    y1="60" 
                                    x2="25" 
                                    y2="60" 
                                    stroke="#171717" 
                                    strokeWidth="2.5" 
                                    strokeLinecap="round" 
                                    className="dark:stroke-neutral-200"
                                    style={{ 
                                      transform: `rotate(${item.percent * 180}deg)`, 
                                      transformOrigin: '60px 60px',
                                      transition: 'transform 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)' 
                                    }} 
                                  />
                                </svg>
                                
                                <div className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-lg font-black text-[#171717] dark:text-neutral-100 tracking-tight leading-none">
                                  {item.value.toLocaleString('pt-BR')}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Custom Scrollbar Column mimicking the image */}
                        <div className="w-6 flex flex-col items-center justify-between py-1 shrink-0 select-none border-l border-neutral-100 dark:border-neutral-800/80 pl-2">
                          {/* Up Arrow */}
                          <button 
                            onClick={scrollUp}
                            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors p-1"
                          >
                            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                              <path d="M12 6l-6 6h12z" />
                            </svg>
                          </button>

                          {/* Track */}
                          <div className="w-1.5 flex-grow bg-neutral-100 dark:bg-neutral-800 rounded-full my-2 relative">
                            {/* Thumb */}
                            <div 
                              className="absolute w-full bg-[#8e9aa8] dark:bg-neutral-600 rounded-full cursor-pointer hover:bg-neutral-500 transition-all duration-100"
                              style={{ 
                                height: '40px',
                                top: `calc(${scrollPercent} * (100% - 40px))`
                              }}
                            />
                          </div>

                          {/* Down Arrow */}
                          <button 
                            onClick={scrollDown}
                            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors p-1"
                          >
                            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                              <path d="M12 18l-6-6h12z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* 8. AGENDA / CALENDARIO MOCKUP */}
                {selectedType === 'agenda' && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-6 w-full"
                  >
                    <div className="bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 rounded-2xl p-4 text-xs font-bold text-center">
                      💡 Arraste os compromissos entre os dias para reagendá-los no calendário!
                    </div>

                    {/* Calendar Month Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-neutral-950 p-6 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 shadow-sm gap-4">
                      
                      {/* Left: Icon & Title & Sparkles badge */}
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-[1.25rem] bg-[#eaeefd] dark:bg-indigo-950/50 flex items-center justify-center text-[#5c72e7] dark:text-indigo-400 shrink-0 border border-[#c5cff9]/30 dark:border-indigo-800/20">
                          <Calendar className="w-6 h-6" />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <h4 className="text-xl font-black text-black dark:text-white leading-tight">Maio de 2026</h4>
                          <span className="text-[10px] font-black text-amber-500 flex items-center gap-1 uppercase tracking-widest leading-none">
                            <Sparkles className="w-3 h-3 fill-current" /> MONTH VIEW MODE
                          </span>
                        </div>
                      </div>

                      {/* Right: Controls & Navigation */}
                      <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
                        {/* Navigation pill */}
                        <div className="flex items-center bg-neutral-100 dark:bg-neutral-900 p-1.5 rounded-full border border-neutral-200 dark:border-neutral-800 shrink-0">
                          <button 
                            onClick={() => {
                              setSelectedAgendaDay(prev => prev > 1 ? prev - 1 : 31)
                            }}
                            className="p-1 px-2.5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-250 transition-colors"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedAgendaDay(21)
                            }}
                            className="px-3 text-[10px] font-black uppercase tracking-widest text-neutral-600 dark:text-neutral-450 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors"
                          >
                            HOJE
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedAgendaDay(prev => prev < 31 ? prev + 1 : 1)
                            }}
                            className="p-1 px-2.5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-250 transition-colors"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Mode toggle pill */}
                        <div className="flex items-center bg-neutral-100 dark:bg-neutral-900 p-1.5 rounded-full border border-neutral-200 dark:border-neutral-800 shrink-0">
                          <button
                            onClick={() => triggerToast('Visualização Mensal ativa')}
                            className="px-4 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-full bg-white dark:bg-neutral-800 text-[#5c72e7] dark:text-indigo-400 shadow-sm transition-colors"
                          >
                            Mês
                          </button>
                          <button
                            onClick={() => triggerToast('Visualização de Semana em desenvolvimento')}
                            className="px-4 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-full text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-250 transition-colors"
                          >
                            Semana
                          </button>
                          <button
                            onClick={() => triggerToast('Visualização Diária em desenvolvimento')}
                            className="px-4 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-full text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-250 transition-colors"
                          >
                            Dia
                          </button>
                        </div>

                        {/* Novo Agendamento Button */}
                        <button 
                          onClick={() => {
                            const newId = `ev${Date.now()}`
                            const newEv = { 
                              id: newId, 
                              day: selectedAgendaDay, 
                              time: '12:00', 
                              title: 'Novo Compromisso', 
                              type: 'reunião' 
                            }
                            setAgendaEvents(prev => [...prev, newEv])
                            triggerToast(`Compromisso agendado no dia ${selectedAgendaDay}!`)
                          }}
                          className="px-4 py-2 bg-[#5c72e7] hover:bg-[#4a5fc1] text-white rounded-full text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-lg shadow-indigo-500/10 active:scale-95 animate-fade-in"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Novo Compromisso</span>
                        </button>
                      </div>

                    </div>

                    {/* Weekday columns header */}
                    <div className="grid grid-cols-7 text-center gap-2 px-1 text-[10px] font-black text-[#94a3b8] dark:text-neutral-500 uppercase tracking-widest border-b border-neutral-100 dark:border-neutral-800 pb-3">
                      <span>Dom</span>
                      <span>Seg</span>
                      <span>Ter</span>
                      <span>Qua</span>
                      <span>Qui</span>
                      <span>Sex</span>
                      <span>Sáb</span>
                    </div>

                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7 gap-2">
                      {[
                        // Row 1
                        { dayNumber: 26, monthOffset: -1 },
                        { dayNumber: 27, monthOffset: -1 },
                        { dayNumber: 28, monthOffset: -1 },
                        { dayNumber: 29, monthOffset: -1 },
                        { dayNumber: 30, monthOffset: -1 },
                        { dayNumber: 1, monthOffset: 0 },
                        { dayNumber: 2, monthOffset: 0 },
                        // Row 2
                        { dayNumber: 3, monthOffset: 0 },
                        { dayNumber: 4, monthOffset: 0 },
                        { dayNumber: 5, monthOffset: 0 },
                        { dayNumber: 6, monthOffset: 0 },
                        { dayNumber: 7, monthOffset: 0 },
                        { dayNumber: 8, monthOffset: 0 },
                        { dayNumber: 9, monthOffset: 0 },
                        // Row 3
                        { dayNumber: 10, monthOffset: 0 },
                        { dayNumber: 11, monthOffset: 0 },
                        { dayNumber: 12, monthOffset: 0 },
                        { dayNumber: 13, monthOffset: 0 },
                        { dayNumber: 14, monthOffset: 0 },
                        { dayNumber: 15, monthOffset: 0 },
                        { dayNumber: 16, monthOffset: 0 },
                        // Row 4
                        { dayNumber: 17, monthOffset: 0 },
                        { dayNumber: 18, monthOffset: 0 },
                        { dayNumber: 19, monthOffset: 0 },
                        { dayNumber: 20, monthOffset: 0 },
                        { dayNumber: 21, monthOffset: 0 },
                        { dayNumber: 22, monthOffset: 0 },
                        { dayNumber: 23, monthOffset: 0 },
                        // Row 5
                        { dayNumber: 24, monthOffset: 0 },
                        { dayNumber: 25, monthOffset: 0 },
                        { dayNumber: 26, monthOffset: 0 },
                        { dayNumber: 27, monthOffset: 0 },
                        { dayNumber: 28, monthOffset: 0 },
                        { dayNumber: 29, monthOffset: 0 },
                        { dayNumber: 30, monthOffset: 0 },
                        // Row 6
                        { dayNumber: 31, monthOffset: 0 },
                        { dayNumber: 1, monthOffset: 1 },
                        { dayNumber: 2, monthOffset: 1 },
                        { dayNumber: 3, monthOffset: 1 },
                        { dayNumber: 4, monthOffset: 1 },
                        { dayNumber: 5, monthOffset: 1 },
                        { dayNumber: 6, monthOffset: 1 },
                      ].map((cell, idx) => {
                        const isCurrentMonth = cell.monthOffset === 0
                        const isSelected = selectedAgendaDay === cell.dayNumber && isCurrentMonth
                        const dayEvents = isCurrentMonth ? agendaEvents.filter(ev => ev.day === cell.dayNumber) : []

                        const handleDragStart = (e: React.DragEvent, id: string) => {
                          e.dataTransfer.setData('text/plain', id)
                          e.dataTransfer.effectAllowed = 'move'
                        }

                        const handleDragOver = (e: React.DragEvent) => {
                          e.preventDefault()
                        }

                        const handleDrop = (e: React.DragEvent, targetDay: number) => {
                          e.preventDefault()
                          const eventId = e.dataTransfer.getData('text/plain')
                          if (!eventId) return

                          setAgendaEvents(prev => prev.map(ev => {
                            if (ev.id === eventId) {
                              return { ...ev, day: targetDay }
                            }
                            return ev
                          }))
                          triggerToast(`Compromisso reagendado para o dia ${targetDay}!`)
                        }

                        return (
                          <div
                            key={idx}
                            onDragOver={isCurrentMonth ? handleDragOver : undefined}
                            onDrop={isCurrentMonth ? (e) => handleDrop(e, cell.dayNumber) : undefined}
                            onClick={() => isCurrentMonth && setSelectedAgendaDay(cell.dayNumber)}
                            className={`min-h-[85px] p-2.5 rounded-2xl border transition-all flex flex-col justify-between select-none relative group ${
                              !isCurrentMonth
                                ? 'bg-neutral-50/20 dark:bg-neutral-900/10 border-neutral-100/40 dark:border-neutral-800/20 opacity-30 cursor-not-allowed'
                                : isSelected
                                ? 'bg-white dark:bg-neutral-950 border-[#5c72e7] dark:border-indigo-500 shadow-md shadow-indigo-500/5 ring-1 ring-[#5c72e7]/30 dark:ring-indigo-500/30'
                                : 'bg-white dark:bg-neutral-950 border-neutral-250 dark:border-neutral-800/80 hover:border-neutral-350 dark:hover:border-neutral-700 cursor-pointer'
                            }`}
                          >
                            {/* Day Number */}
                            <div className="flex items-center justify-between">
                              {isSelected ? (
                                <span className="w-5 h-5 rounded-full bg-[#5c72e7] text-white flex items-center justify-center font-bold text-[10px]">
                                  {cell.dayNumber}
                                </span>
                              ) : (
                                <span className={`text-[11px] font-bold ${isCurrentMonth ? 'text-neutral-750 dark:text-neutral-350' : 'text-neutral-400'}`}>
                                  {cell.dayNumber}
                                </span>
                              )}
                            </div>

                            {/* Events list inside cell */}
                            <div className="mt-2 space-y-1 flex-grow overflow-hidden flex flex-col justify-end">
                              {dayEvents.map(ev => (
                                <div
                                  key={ev.id}
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, ev.id)}
                                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#eaeefd] dark:bg-indigo-950/40 text-[#4a5fc1] dark:text-indigo-300 text-[9px] font-bold cursor-grab active:cursor-grabbing hover:bg-[#c5cff9]/40 transition-colors truncate"
                                  title={`${ev.time} - ${ev.title}`}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#5c72e7] shrink-0"></span>
                                  <span className="truncate">{ev.title}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </motion.div>
                )}

                {/* 7. PERSONALIZADO MOCKUP */}
                {selectedType === 'personalizado' && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-6 text-left"
                  >
                    <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-5 shadow-sm space-y-4">
                      
                      {/* Custom SQL Editor Header */}
                      <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
                        <div className="flex items-center gap-2">
                          <Terminal className="w-4 h-4 text-amber-500" />
                          <span className="text-xs font-black uppercase text-neutral-800 dark:text-white">
                            {t('marketing_v2.use_cases_page.mockups.sql_editor_title')}
                          </span>
                        </div>
                        <button 
                          onClick={runCustomQuery}
                          disabled={isSqlRunning}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/60 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors flex items-center gap-1"
                        >
                          {isSqlRunning ? (
                            <span>...</span>
                          ) : (
                            <>
                              <Play className="w-3 h-3 fill-current" />
                              <span>{t('marketing_v2.use_cases_page.mockups.run_query')}</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Mockup SQL TextArea */}
                      <div className="font-mono text-xs text-neutral-700 dark:text-neutral-300 p-4 bg-neutral-50 dark:bg-neutral-900 rounded-2xl border border-neutral-100 dark:border-neutral-850">
                        <p className="text-purple-500 dark:text-purple-400">SELECT</p>
                        <p className="pl-4 text-neutral-600 dark:text-neutral-300">
                          p.id, p.name, <span className="text-emerald-500">count</span>(o.id) <span className="text-purple-500">as</span> orders_count
                        </p>
                        <p className="text-purple-500 dark:text-purple-400">FROM</p>
                        <p className="pl-4">products p</p>
                        <p className="text-purple-500 dark:text-purple-400">LEFT JOIN</p>
                        <p className="pl-4">orders o ON p.id = o.product_id</p>
                        <p className="text-purple-500 dark:text-purple-400">GROUP BY</p>
                        <p className="pl-4">p.id</p>
                      </div>
                    </div>

                    {/* Query Result Grid simulation */}
                    <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-5 shadow-sm space-y-3 min-h-[160px] flex flex-col justify-center">
                      <h5 className="text-[10px] font-black uppercase text-neutral-400 border-b border-neutral-100 dark:border-neutral-800 pb-2">
                        {t('marketing_v2.use_cases_page.mockups.query_result')}
                      </h5>

                      <AnimatePresence mode="wait">
                        {isSqlRunning ? (
                          <motion.div 
                            key="sql-loader"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="text-center py-8 text-neutral-400 italic text-xs"
                          >
                            Executing Raw SQL query through CLI Bridge tunnel...
                          </motion.div>
                        ) : sqlResults.length > 0 ? (
                          <motion.div 
                            key="sql-table"
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-3"
                          >
                            <div className="grid grid-cols-3 text-[9px] font-black uppercase text-neutral-400 border-b border-neutral-100 dark:border-neutral-850 pb-2">
                              <span>ID</span>
                              <span>Produto</span>
                              <span className="text-right">Pedidos Feitos</span>
                            </div>
                            {sqlResults.map(item => (
                              <div key={item.id} className="grid grid-cols-3 text-xs font-mono">
                                <span>#{item.id}</span>
                                <span className="font-bold font-sans text-neutral-800 dark:text-neutral-300">{item.name}</span>
                                <span className="text-right font-black text-amber-500">{item.count}</span>
                              </div>
                            ))}
                          </motion.div>
                        ) : (
                          <motion.div 
                            key="sql-empty"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center py-8 text-neutral-400 text-xs italic"
                          >
                            Nenhuma consulta executada ainda. Clique em "EXECUTAR QUERY" para testar.
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                  </motion.div>
                )}

                {/* 9. GALERIA / ASSETS MOCKUP */}
                {selectedType === 'galeria' && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-6 text-left"
                  >
                    {/* Header Controls */}
                    <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-white dark:bg-neutral-950 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
                      <div className="relative w-full sm:w-auto flex-grow max-w-xs">
                        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input 
                          type="text" 
                          placeholder="Buscar arquivos..."
                          value={gallerySearchQuery}
                          onChange={(e) => setGallerySearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-xs font-medium focus:outline-none focus:border-indigo-500 text-neutral-800 dark:text-neutral-200"
                        />
                      </div>
                      
                      {/* Filter tabs */}
                      <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-900 p-1 rounded-xl w-full sm:w-auto justify-center sm:justify-start">
                        {(['all', 'image', 'pdf'] as const).map((filter) => (
                          <button
                            key={filter}
                            type="button"
                            onClick={() => setGalleryFilter(filter)}
                            className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-colors capitalize ${
                              galleryFilter === filter
                                ? 'bg-white dark:bg-neutral-800 text-rose-600 dark:text-rose-450 shadow-sm'
                                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'
                            }`}
                          >
                            {filter === 'all' ? 'Todos' : filter === 'image' ? 'Imagens' : 'Documentos'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Gallery Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {filteredGalleryAssets.length > 0 ? (
                        filteredGalleryAssets.map((asset) => (
                          <div 
                            key={asset.id} 
                            className="group relative bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col"
                          >
                            {/* Visual Preview Area */}
                            <div className="aspect-video w-full relative overflow-hidden bg-neutral-100 dark:bg-neutral-900 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-center">
                              {asset.type === 'image' ? (
                                <img 
                                  src={asset.url} 
                                  alt={asset.title} 
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                                />
                              ) : (
                                <div className="flex flex-col items-center gap-2 p-4 text-center">
                                  <FileText className="w-10 h-10 text-rose-500" />
                                  <span className="text-[10px] font-mono font-black uppercase text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded">PDF</span>
                                </div>
                              )}
                              
                              {/* Hover actions overlay */}
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <button 
                                  type="button"
                                  onClick={() => setSelectedAssetPreview(asset)}
                                  className="p-2.5 bg-white text-neutral-850 rounded-xl hover:bg-neutral-100 active:scale-95 transition-all shadow-lg flex items-center gap-1.5 text-xs font-bold"
                                >
                                  <Eye className="w-4 h-4" />
                                  <span>Visualizar</span>
                                </button>
                              </div>
                            </div>

                            {/* Card Body */}
                            <div className="p-4 flex-grow flex flex-col justify-between gap-3">
                              <div className="space-y-1">
                                <h4 className="text-xs font-black text-neutral-800 dark:text-white leading-snug">
                                  {asset.title}
                                </h4>
                                <p className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 font-mono truncate">
                                  {asset.fileName}
                                </p>
                              </div>

                              <div className="flex items-center justify-between border-t border-neutral-100 dark:border-neutral-800/80 pt-3">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[8px] font-bold text-neutral-450 uppercase tracking-wider">Tamanho</span>
                                  <span className="text-[10px] font-bold text-neutral-700 dark:text-neutral-300">{asset.size}</span>
                                </div>
                                <div className="flex gap-1">
                                  <button 
                                    type="button"
                                    onClick={() => triggerToast(`Iniciando download de ${asset.fileName}...`)}
                                    className="p-2 hover:bg-rose-500/10 hover:text-rose-500 text-neutral-400 rounded-xl transition-colors"
                                    title="Baixar arquivo"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => triggerToast(`Redirecionando para ${asset.externalUrl}...`)}
                                    className="p-2 hover:bg-rose-500/10 hover:text-rose-500 text-neutral-400 rounded-xl transition-colors"
                                    title="Acessar link externo"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-2 py-12 text-center text-neutral-400 italic text-xs">
                          Nenhum arquivo correspondente aos filtros.
                        </div>
                      )}
                    </div>

                    {/* Lightbox / Preview Modal Simulation */}
                    <AnimatePresence>
                      {selectedAssetPreview && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-30 rounded-[2.5rem] overflow-hidden flex items-center justify-center p-6">
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-sm bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
                          >
                            <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                              <span className="text-[10px] font-black uppercase text-neutral-450 tracking-wider">
                                Pré-visualização do Asset
                              </span>
                              <button 
                                type="button"
                                onClick={() => setSelectedAssetPreview(null)}
                                className="text-xs font-black text-neutral-405 hover:text-neutral-600 dark:hover:text-neutral-200"
                              >
                                Fechar
                              </button>
                            </div>
                            
                            <div className="p-6 space-y-4">
                              <div className="aspect-video w-full rounded-2xl overflow-hidden bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850 flex items-center justify-center">
                                {selectedAssetPreview.type === 'image' ? (
                                  <img src={selectedAssetPreview.url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <FileText className="w-12 h-12 text-rose-500" />
                                )}
                              </div>
                              
                              <div className="space-y-2">
                                <h5 className="font-extrabold text-sm text-neutral-800 dark:text-white">
                                  {selectedAssetPreview.title}
                                </h5>
                                <div className="grid grid-cols-2 gap-3 text-[11px] bg-neutral-50 dark:bg-neutral-900/60 p-3 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                                  <div>
                                    <span className="text-neutral-450 block text-[9px] font-bold uppercase">Formato</span>
                                    <span className="font-bold text-neutral-700 dark:text-neutral-300 uppercase">{selectedAssetPreview.type}</span>
                                  </div>
                                  <div>
                                    <span className="text-neutral-450 block text-[9px] font-bold uppercase">Tamanho</span>
                                    <span className="font-bold text-neutral-700 dark:text-neutral-300">{selectedAssetPreview.size}</span>
                                  </div>
                                  <div className="col-span-2">
                                    <span className="text-neutral-450 block text-[9px] font-bold uppercase">Atualizado em</span>
                                    <span className="font-bold text-neutral-700 dark:text-neutral-300">{selectedAssetPreview.updatedAt}</span>
                                  </div>
                                </div>
                              </div>
                              
                              <button 
                                type="button"
                                onClick={() => {
                                  triggerToast(`Efetuando download de ${selectedAssetPreview.fileName}...`)
                                  setSelectedAssetPreview(null)
                                }}
                                className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                              >
                                <Download className="w-4 h-4" />
                                <span>Baixar Arquivo</span>
                              </button>
                            </div>
                          </motion.div>
                        </div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                {/* 10. TIMELINE / FEED MOCKUP */}
                {selectedType === 'timeline' && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-6"
                  >
                    <div className="flex items-center justify-between bg-white dark:bg-neutral-950 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
                      <span className="text-xs font-bold text-neutral-800 dark:text-white">
                        Histórico de Auditoria
                      </span>
                      <span className="px-2.5 py-1 bg-violet-500/10 text-violet-500 text-[10px] font-black rounded-full uppercase tracking-wider">
                        Real-time Feed
                      </span>
                    </div>

                    <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-neutral-200 dark:before:bg-neutral-850">
                      {[
                        { time: 'Hoje, 18:30', title: 'Caso de Uso Publicado', desc: 'O desenvolvedor João entregou a tela "Gestão de Contratos".', type: 'success' },
                        { time: 'Hoje, 15:45', title: 'Integração Estabelecida', desc: 'Conexão via Túnel Seguro estabelecida com o banco Postgres de produção.', type: 'info' },
                        { time: 'Ontem, 10:15', title: 'Alteração de Permissões', desc: 'Permissões do usuário Maria Santos alteradas para Administrador.', type: 'warning' },
                        { time: '24 Mai, 14:00', title: 'Novo Integrador Adicionado', desc: 'Webhook configurado para disparar eventos para o Asaas.', type: 'default' }
                      ].map((item, idx) => (
                        <div key={idx} className="relative group">
                          {/* Timeline node dot */}
                          <div className={cn(
                            "absolute -left-[22px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-neutral-950 transition-transform group-hover:scale-125",
                            item.type === 'success' ? 'bg-emerald-500' :
                            item.type === 'info' ? 'bg-blue-500' :
                            item.type === 'warning' ? 'bg-amber-500' : 'bg-neutral-450'
                          )} />
                          
                          <div 
                            onClick={() => triggerToast(`Visualizando: ${item.title}`)}
                            className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer text-left space-y-1"
                          >
                            <span className="text-[10px] font-bold text-neutral-400 font-mono">{item.time}</span>
                            <h5 className="text-xs font-bold text-neutral-850 dark:text-white">{item.title}</h5>
                            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-normal">{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* 11. GANTT CHART MOCKUP */}
                {selectedType === 'gantt' && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-6"
                  >
                    <div className="flex items-center justify-between bg-white dark:bg-neutral-950 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
                      <span className="text-xs font-bold text-neutral-800 dark:text-white">
                        Cronograma de Implementação
                      </span>
                      <span className="px-2.5 py-1 bg-sky-500/10 text-sky-500 text-[10px] font-black rounded-full uppercase tracking-wider">
                        Gantt Chart
                      </span>
                    </div>

                    <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm p-4 space-y-4">
                      {/* Gantt Header timeline */}
                      <div className="grid grid-cols-12 text-center text-[9px] font-black text-neutral-400 uppercase tracking-widest border-b border-neutral-100 dark:border-neutral-800/80 pb-2">
                        <span className="col-span-4 text-left">Tarefa</span>
                        <span className="col-span-2">S1</span>
                        <span className="col-span-2">S2</span>
                        <span className="col-span-2">S3</span>
                        <span className="col-span-2">S4</span>
                      </div>

                      {/* Gantt Rows */}
                      <div className="space-y-3.5">
                        {[
                          { task: 'Mapeamento SQL', start: 0, width: 3, progress: '100%', color: 'from-sky-500 to-sky-600' },
                          { task: 'Configuração RLS', start: 2, width: 4, progress: '80%', color: 'from-indigo-500 to-indigo-600' },
                          { task: 'Integração de APIs', start: 5, width: 5, progress: '40%', color: 'from-purple-500 to-purple-600' },
                          { task: 'Homologação final', start: 9, width: 3, progress: '0%', color: 'from-neutral-450 to-neutral-500' }
                        ].map((row, idx) => (
                          <div 
                            key={idx} 
                            onClick={() => triggerToast(`Progresso de ${row.task}: ${row.progress}`)}
                            className="grid grid-cols-12 items-center text-xs group cursor-pointer"
                          >
                            <span className="col-span-4 font-bold text-neutral-800 dark:text-neutral-200 truncate pr-2">{row.task}</span>
                            
                            {/* Gantt Bar Lane */}
                            <div className="col-span-8 grid grid-cols-8 gap-0 h-7 bg-neutral-50 dark:bg-neutral-900/60 rounded-xl relative overflow-hidden border border-neutral-150 dark:border-neutral-850">
                              <div 
                                className={cn(
                                  "h-full rounded-lg bg-gradient-to-r relative flex items-center pl-2 group-hover:brightness-105 transition-all shadow-sm",
                                  row.color
                                )}
                                style={{
                                  gridColumnStart: row.start + 1,
                                  gridColumnEnd: row.start + row.width + 1
                                }}
                              >
                                <span className="text-[8px] font-black text-white uppercase tracking-widest">{row.progress}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* 12. FLUXOGRAMA (BLUEPRINT) MOCKUP */}
                {selectedType === 'blueprint' && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-6"
                  >
                    <div className="flex items-center justify-between bg-white dark:bg-neutral-950 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
                      <span className="text-xs font-bold text-neutral-800 dark:text-white">
                        Fluxo de Aprovação de Proposta
                      </span>
                      <span className="px-2.5 py-1 bg-indigo-500/10 text-indigo-500 text-[10px] font-black rounded-full uppercase tracking-wider">
                        Workflow Canvas
                      </span>
                    </div>

                    <div className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl aspect-[4/3] relative overflow-hidden p-6 flex flex-col items-center justify-between">
                      {/* Connection arrows using SVG */}
                      <svg className="w-full h-full absolute inset-0 pointer-events-none" viewBox="0 0 400 300">
                        {/* Node 1 to Node 2 */}
                        <line x1="200" y1="65" x2="200" y2="120" stroke="#818cf8" strokeWidth="2.5" />
                        {/* Arrowhead Node 1 to 2 */}
                        <polygon points="200,123 196,115 204,115" fill="#818cf8" />
                        
                        {/* Node 2 to Node 3 (Aprovado) */}
                        <path d="M 150 145 L 85 145 L 85 200" fill="none" stroke="#10b981" strokeWidth="2.5" />
                        <polygon points="85,203 81,195 89,195" fill="#10b981" />

                        {/* Node 2 to Node 4 (Rejeitado) */}
                        <path d="M 250 145 L 315 145 L 315 200" fill="none" stroke="#f43f5e" strokeWidth="2.5" />
                        <polygon points="315,203 311,195 319,195" fill="#f43f5e" />
                      </svg>

                      {/* Nodes */}
                      <div className="relative w-full h-full">
                        {/* Node 1: Start */}
                        <div 
                          onClick={() => triggerToast('Nó: Criação de Proposta')}
                          className="absolute left-1/2 -translate-x-1/2 top-4 px-4 py-2.5 bg-indigo-505 text-white rounded-2xl shadow-md cursor-pointer hover:scale-105 transition-transform text-xs font-bold text-center z-10"
                        >
                          📝 1. Proposta Criada
                        </div>

                        {/* Node 2: Decision */}
                        <div 
                          onClick={() => triggerToast('Nó de Decisão: Revisão do Gestor')}
                          className="absolute left-1/2 -translate-x-1/2 top-28 px-5 py-3 bg-white dark:bg-neutral-900 border-2 border-indigo-500 text-neutral-800 dark:text-neutral-200 rounded-2xl shadow-lg cursor-pointer hover:scale-105 transition-transform text-xs font-black text-center z-10"
                        >
                          ⚖️ 2. Revisão do Gestor
                        </div>

                        {/* Node 3: Approved */}
                        <div 
                          onClick={() => triggerToast('Ação: Proposta Aprovada')}
                          className="absolute left-6 bottom-8 px-4 py-2.5 bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500 text-emerald-600 dark:text-emerald-400 rounded-2xl shadow-sm cursor-pointer hover:scale-105 transition-transform text-xs font-bold text-center z-10"
                        >
                          ✅ 3. Aprovada e Enviada
                        </div>

                        {/* Node 4: Rejected */}
                        <div 
                          onClick={() => triggerToast('Ação: Proposta Rejeitada')}
                          className="absolute right-6 bottom-8 px-4 py-2.5 bg-rose-500/10 dark:bg-rose-500/20 border border-rose-500 text-rose-600 dark:text-rose-450 rounded-2xl shadow-sm cursor-pointer hover:scale-105 transition-transform text-xs font-bold text-center z-10"
                        >
                          ❌ 4. Devolvida para Ajustes
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* 13. VISÃO DE MAPA MOCKUP */}
                {selectedType === 'map' && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-6"
                  >
                    <div className="flex items-center justify-between bg-white dark:bg-neutral-950 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
                      <span className="text-xs font-bold text-neutral-800 dark:text-white">
                        Geolocalização de Operadores
                      </span>
                      <span className="px-2.5 py-1 bg-blue-500/10 text-blue-500 text-[10px] font-black rounded-full uppercase tracking-wider">
                        Map View (Leaflet)
                      </span>
                    </div>

                    <div className="w-full bg-[#e8ecef] dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] aspect-[4/3] relative overflow-hidden shadow-inner flex items-center justify-center">
                      {/* Map Background Image */}
                      <img 
                        src="/map_background.png" 
                        alt="Map Background" 
                        className="absolute inset-0 w-full h-full object-cover opacity-60 dark:opacity-30 mix-blend-multiply dark:mix-blend-normal pointer-events-none"
                      />
                      {/* Map Background grid grid layout to simulate streets */}
                      <div className="absolute inset-0 opacity-15 bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
                      
                      {/* Map Pins */}
                      <div className="relative w-full h-full">
                        {[
                          { name: 'Filial São Paulo (Matriz)', operators: 12, top: '25%', left: '40%' },
                          { name: 'Filial Rio de Janeiro', operators: 8, top: '60%', left: '75%' },
                          { name: 'CD Campinas', operators: 4, top: '45%', left: '20%' }
                        ].map((pin, idx) => (
                          <div 
                            key={idx}
                            style={{ top: pin.top, left: pin.left }}
                            className="absolute group z-10"
                          >
                            {/* Animated Pin dot */}
                            <div 
                              onClick={() => triggerToast(`${pin.name}: ${pin.operators} operadores`)}
                              className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg cursor-pointer hover:scale-125 transition-transform relative border-2 border-white dark:border-neutral-950"
                            >
                              <MapPin className="w-4 h-4" />
                              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 text-[8px] font-black rounded-full flex items-center justify-center text-white ring-1 ring-white">
                                {pin.operators}
                              </span>
                            </div>
                            
                            {/* Hover info tooltip */}
                            <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-neutral-900 text-white text-[9px] font-black px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-md pointer-events-none whitespace-nowrap">
                              {pin.name}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

              </div>
              
              {/* Interactive Help Hint */}
              <div className="mt-8 pt-4 border-t border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-400 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping"></span>
                <span>{t('marketing_v2.use_cases_page.interactive_hint')}</span>
              </div>

            </div>

          </div>

          {/* Details Card */}
          <motion.div 
            key={`details-${selectedType}`}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-6 p-6 sm:p-8 rounded-[2.5rem] bg-white dark:bg-neutral-950/40 border border-neutral-200 dark:border-neutral-850 shadow-lg space-y-6"
          >
            <div className="border-b border-neutral-100 dark:border-neutral-800/85 pb-4">
              <h4 className="text-sm font-black uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
                Especificações Técnicas
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left">
              
              {/* O que é */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-wider">
                    {t('marketing_v2.use_cases_page.what_is')}
                  </span>
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-350 leading-relaxed font-medium">
                  {t(`marketing_v2.use_cases_page.items.${selectedType}.what_is`)}
                </p>
              </div>

              {/* Comportamento da Engine */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                  <Terminal className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-wider">
                    {t('marketing_v2.use_cases_page.engine_behavior')}
                  </span>
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-350 leading-relaxed font-medium">
                  {t(`marketing_v2.use_cases_page.items.${selectedType}.behavior`)}
                </p>
              </div>

              {/* Exemplo Prático */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <Play className="w-4 h-4 fill-current" />
                  <span className="text-[10px] font-black uppercase tracking-wider">
                    {t('marketing_v2.use_cases_page.practical_example')}
                  </span>
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-350 leading-relaxed font-medium">
                  {t(`marketing_v2.use_cases_page.items.${selectedType}.example`)}
                </p>
              </div>

              {/* Componentes Gerados */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-pink-600 dark:text-pink-400">
                  <Layout className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-wider">
                    {t('marketing_v2.use_cases_page.mapped_components')}
                  </span>
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-350 leading-relaxed font-medium">
                  {t(`marketing_v2.use_cases_page.items.${selectedType}.components`)}
                </p>
              </div>

            </div>
          </motion.div>
        </div>

      </section>

      {/* Grid: Deep Dive Technical Details */}
      <section className="border-t border-neutral-100 dark:border-neutral-900 pt-16 space-y-12">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-black dark:text-white tracking-tight">
            Como o Motor de Metadados Processa as Lógicas?
          </h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm leading-relaxed mt-2">
            Cada caso de uso é modelado em formato de metadados declarativos JSON. O Runtime lê a lógica selecionada e reconstrói o estado comportamental no frontend do cliente.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 rounded-[2rem] bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500">
              <Database className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold dark:text-white">1. Mapeamento Semântico</h4>
            <p className="text-neutral-500 dark:text-neutral-400 text-xs leading-relaxed">
              O assistente analisa as Chaves Primárias (PK) e Estrangeiras (FK) para estruturar os formulários, ligar as tabelas do Mestre-Detalhe e sugerir relacionamentos automaticamente.
            </p>
          </div>

          <div className="p-8 rounded-[2rem] bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <Terminal className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold dark:text-white">2. Transações pelo Túnel</h4>
            <p className="text-neutral-500 dark:text-neutral-400 text-xs leading-relaxed">
              Os comandos CRUD e queries SQL não batem em servidores externos. O runtime envia instruções criptografadas TLS 1.3 processadas localmente pelo CLI Agent.
            </p>
          </div>

          <div className="p-8 rounded-[2rem] bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500">
              <Layout className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold dark:text-white">3. Runtime Whitelabel</h4>
            <p className="text-neutral-500 dark:text-neutral-400 text-xs leading-relaxed">
              A estrutura da tela se adapta instantaneamente ao tema (Light/Dark), logotipos, tipografia e regras de segurança definidas no painel de branding de cada workspace.
            </p>
          </div>
        </div>
      </section>

      {/* Bottom CTA Card */}
      <section className="p-12 rounded-[3.5rem] bg-neutral-100 dark:bg-neutral-900 border border-neutral-250 dark:border-neutral-800 text-center space-y-8">
        <div className="space-y-3">
          <h2 className="text-3xl font-black dark:text-white">Pronto para criar seus Casos de Uso?</h2>
          <p className="text-neutral-500 dark:text-neutral-400 max-w-xl mx-auto text-sm leading-relaxed">
            Abra o painel Studio de um dos seus projetos e use o Use Case Builder para construir qualquer um dos modelos em minutos.
          </p>
        </div>
        <BottomCta />
      </section>

    </div>
  )
}
