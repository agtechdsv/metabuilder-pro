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
import { useUseCaseMockups } from './hooks/useUseCaseMockups'
import { MockupRenderer } from './components/MockupRenderer'


type UseCaseType = 'cadastro' | 'pesquisa' | 'pesquisa_cadastro' | 'master_detail' | 'kanban' | 'mapa_mental' | 'dashboard' | 'agenda' | 'personalizado' | 'galeria' | 'timeline' | 'gantt' | 'blueprint' | 'map'

export default function UseCasesFeaturePage() {
  const { t } = useI18n()
  const [selectedType, setSelectedType] = useState<UseCaseType>('pesquisa_cadastro')

    const mockupsState = useUseCaseMockups()
  const { toastMessage } = mockupsState

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
    
    // 5. Avançado e Híbrido
    { id: 'personalizado', icon: <Layers className="w-5 h-5" />, color: 'from-amber-500 to-amber-600' },
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
              <MockupRenderer selectedType={selectedType} mockupsState={mockupsState} />
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
                {t('marketing_v2.use_cases_page.technical_specifications')}
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
            {t('marketing_v2.use_cases_page.how_engine_works_title')}
          </h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm leading-relaxed mt-2">
            {t('marketing_v2.use_cases_page.how_engine_works_desc')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 rounded-[2rem] bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500">
              <Database className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold dark:text-white">{t('marketing_v2.use_cases_page.semantic_mapping_title')}</h4>
            <p className="text-neutral-500 dark:text-neutral-400 text-xs leading-relaxed">
              {t('marketing_v2.use_cases_page.semantic_mapping_desc')}
            </p>
          </div>

          <div className="p-8 rounded-[2rem] bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <Terminal className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold dark:text-white">{t('marketing_v2.use_cases_page.tunnel_transactions_title')}</h4>
            <p className="text-neutral-500 dark:text-neutral-400 text-xs leading-relaxed">
              {t('marketing_v2.use_cases_page.tunnel_transactions_desc')}
            </p>
          </div>

          <div className="p-8 rounded-[2rem] bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500">
              <Layout className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold dark:text-white">{t('marketing_v2.use_cases_page.whitelabel_runtime_title')}</h4>
            <p className="text-neutral-500 dark:text-neutral-400 text-xs leading-relaxed">
              {t('marketing_v2.use_cases_page.whitelabel_runtime_desc')}
            </p>
          </div>
        </div>
      </section>

      {/* Bottom CTA Card */}
      <section className="p-12 rounded-[3.5rem] bg-neutral-100 dark:bg-neutral-900 border border-neutral-250 dark:border-neutral-800 text-center space-y-8">
        <div className="space-y-3">
          <h2 className="text-3xl font-black dark:text-white">{t('marketing_v2.use_cases_page.bottom_cta_title')}</h2>
          <p className="text-neutral-500 dark:text-neutral-400 max-w-xl mx-auto text-sm leading-relaxed">
            {t('marketing_v2.use_cases_page.bottom_cta_desc')}
          </p>
        </div>
        <BottomCta />
      </section>

    </div>
  )
}
