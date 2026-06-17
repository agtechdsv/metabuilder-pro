'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  LayoutDashboard,
  CreditCard,
  XCircle,
  Layout,
  Activity,
  Clock,
  Check,
  ArrowRight,
  TrendingUp,
  RotateCcw,
  Zap,
  Users,
  FileText,
  ExternalLink,
  Sliders,
  Compass,
  Copy,
  Download,
  Code,
  Loader2,
  Shield,
  Lightbulb,
  MessageCircle,
  ThumbsUp,
  Star
} from 'lucide-react'
import Link from 'next/link'
import { BottomCta } from '@/components/landing/BottomCta'
import { useI18n } from '@/i18n/I18nContext'
import { cn } from '@/lib/utils'
import { useControlCenterMockups } from './hooks/useControlCenterMockups'
import { ControlCenterRenderer } from './components/ControlCenterRenderer'

import CommunityHubView from '@/components/client/CommunityHubView'

type TabType = 'bi' | 'productivity' | 'iclub' | 'subscription' | 'cancel' | 'metavoice' | 'community'

export default function ControlCenterFeaturePage() {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<TabType>('bi')

    const mockupsState = useControlCenterMockups()
  const { toastMessage } = mockupsState

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
                <h3 className="font-bold text-base">{t('marketing_v2.control_center_page.tabs.bi')}</h3>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                {t('marketing_v2.control_center_page.descriptions.bi')}
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
                <h3 className="font-bold text-base">{t('marketing_v2.control_center_page.tabs.productivity')}</h3>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                {t('marketing_v2.control_center_page.descriptions.productivity')}
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
                <h3 className="font-bold text-base">{t('marketing_v2.control_center_page.tabs.subscription')}</h3>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                {t('marketing_v2.control_center_page.descriptions.subscription')}
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
                <h3 className="font-bold text-base">{t('marketing_v2.control_center_page.tabs.cancel')}</h3>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                {t('marketing_v2.control_center_page.descriptions.cancel')}
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
                <h3 className="font-bold text-base">{t('marketing_v2.control_center_page.tabs.community')}</h3>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                {t('marketing_v2.control_center_page.descriptions.community')}
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
                <h3 className="font-bold text-base">{t('marketing_v2.control_center_page.tabs.metavoice')}</h3>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                {t('marketing_v2.control_center_page.descriptions.metavoice')}
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
                <h3 className="font-bold text-base">{t('marketing_v2.control_center_page.tabs.iclub')}</h3>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                {t('marketing_v2.control_center_page.descriptions.iclub')}
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
                {t('marketing_v2.control_center_page.simulator.title')}
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
                  <h3 className="text-lg font-black text-neutral-800 dark:text-white leading-none">{t('marketing_v2.control_center_page.simulator.header_title')}</h3>
                  <span className="text-[10px] text-neutral-400 font-medium">{t('marketing_v2.control_center_page.simulator.header_desc')}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-[9px] font-extrabold tracking-wider uppercase self-start sm:self-auto">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                <span>{t('marketing_v2.control_center_page.simulator.active')}</span>
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
                  <span>{t('marketing_v2.control_center_page.tabs_short.bi')}</span>
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
                  <span>{t('marketing_v2.control_center_page.tabs_short.productivity')}</span>
                </button>
                <button
                  onClick={() => setActiveTab('subscription')}
                  className={cn(
                    "px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1",
                    activeTab === 'subscription'
                      ? 'bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-white shadow-sm'
                      : 'text-neutral-550 hover:bg-neutral-50 dark:hover:bg-neutral-900/40'
                  )}
                >
                  <CreditCard className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                  <span>{t('marketing_v2.control_center_page.tabs_short.subscription')}</span>
                </button>
                <button
                  onClick={() => setActiveTab('cancel')}
                  className={cn(
                    "px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1",
                    activeTab === 'cancel'
                      ? 'bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-white shadow-sm'
                      : 'text-neutral-550 hover:bg-neutral-50 dark:hover:bg-neutral-900/40'
                  )}
                >
                  <XCircle className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                  <span>{t('marketing_v2.control_center_page.tabs_short.cancel')}</span>
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
                  <span>{t('marketing_v2.control_center_page.tabs_short.community')}</span>
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
                  <span>{t('marketing_v2.control_center_page.tabs_short.metavoice')}</span>
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
                  <span>{t('marketing_v2.control_center_page.tabs_short.iclub')}</span>
                </button>
              </div>
            </div>

            <ControlCenterRenderer activeTab={activeTab} setActiveTab={setActiveTab} mockupsState={mockupsState} />

            {/* Mockup Footer banner */}
            <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 text-[10px] text-neutral-400 bg-white dark:bg-neutral-950 flex items-center justify-center gap-2">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
              <span>{t('marketing_v2.control_center_page.simulator.footer_banner')}</span>
            </div>

          </div>
        </div>

      </section>

      {/* Grid: Auditing Details — "VAR do Desenvolvimento" */}
      <section className="border-t border-neutral-100 dark:border-neutral-900 pt-16 space-y-12">
        <div className="max-w-3xl space-y-3">
          <h2 className="text-3xl font-black dark:text-white tracking-tight">
            {t('marketing_v2.control_center_page.auditing.section_title')}
          </h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm leading-relaxed">
            {t('marketing_v2.control_center_page.auditing.section_desc')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 rounded-[2rem] bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold dark:text-white">{t('marketing_v2.control_center_page.auditing.card1_title')}</h4>
            <p className="text-neutral-500 dark:text-neutral-400 text-xs leading-relaxed">
              {t('marketing_v2.control_center_page.auditing.card1_desc')}
            </p>
          </div>

          <div className="p-8 rounded-[2rem] bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold dark:text-white">{t('marketing_v2.control_center_page.auditing.card2_title')}</h4>
            <p className="text-neutral-500 dark:text-neutral-400 text-xs leading-relaxed">
              {t('marketing_v2.control_center_page.auditing.card2_desc')}
            </p>
          </div>

          <div className="p-8 rounded-[2rem] bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <Zap className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold dark:text-white">{t('marketing_v2.control_center_page.auditing.card3_title')}</h4>
            <p className="text-neutral-500 dark:text-neutral-400 text-xs leading-relaxed">
              {t('marketing_v2.control_center_page.auditing.card3_desc')}
            </p>
          </div>
        </div>
      </section>

      {/* Grid: Dashboard BI importance */}
      <section className="border-t border-neutral-100 dark:border-neutral-900 pt-16 space-y-8 text-left">
        <div className="max-w-3xl space-y-3">
          <h2 className="text-3xl font-black dark:text-white tracking-tight">
            {t('marketing_v2.control_center_page.strategic.title')}
          </h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm leading-relaxed">
            {t('marketing_v2.control_center_page.strategic.desc')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-8 bg-neutral-900 rounded-[2.5rem] text-white flex flex-col justify-between min-h-[220px]">
            <h4 className="text-xl font-bold">{t('marketing_v2.control_center_page.strategic.card1_title')}</h4>
            <p className="text-xs opacity-70 leading-relaxed mt-3">
              {t('marketing_v2.control_center_page.strategic.card1_desc')}
            </p>
            <div className="pt-6 flex items-center gap-1 text-xs text-indigo-400 font-bold uppercase tracking-wider">
              <span>{t('marketing_v2.control_center_page.strategic.card1_cta')}</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          <div className="p-8 bg-neutral-900 rounded-[2.5rem] text-white flex flex-col justify-between min-h-[220px]">
            <h4 className="text-xl font-bold">{t('marketing_v2.control_center_page.strategic.card2_title')}</h4>
            <p className="text-xs opacity-70 leading-relaxed mt-3">
              {t('marketing_v2.control_center_page.strategic.card2_desc')}
            </p>
            <div className="pt-6 flex items-center gap-1 text-xs text-emerald-400 font-bold uppercase tracking-wider">
              <span>{t('marketing_v2.control_center_page.strategic.card2_cta')}</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </section>

      {/* Grid: Detailed Control Center Features (Assinatura, Cancelamento, MetaVoice, iClub) */}
      <section className="border-t border-neutral-100 dark:border-neutral-900 pt-16 space-y-12 text-left">
        <div className="max-w-3xl space-y-3">
          <h2 className="text-3xl font-black dark:text-white tracking-tight">
            {t('marketing_v2.control_center_page.pillars.title')}
          </h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm leading-relaxed font-medium">
            {t('marketing_v2.control_center_page.pillars.desc')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Card 1: Assinatura & Faturamento */}
          <div className="p-8 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] space-y-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500">
              <CreditCard className="w-6 h-6" />
            </div>
            <h4 className="text-xl font-bold dark:text-white">{t('marketing_v2.control_center_page.pillars.card1_title')}</h4>
            <p className="text-neutral-500 dark:text-neutral-400 text-xs leading-relaxed">
              {t('marketing_v2.control_center_page.pillars.card1_desc')}
            </p>
          </div>

          {/* Card 2: Fluxo de Cancelamento Transparente */}
          <div className="p-8 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] space-y-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
              <XCircle className="w-6 h-6" />
            </div>
            <h4 className="text-xl font-bold dark:text-white">{t('marketing_v2.control_center_page.pillars.card2_title')}</h4>
            <p className="text-neutral-500 dark:text-neutral-400 text-xs leading-relaxed">
              {t('marketing_v2.control_center_page.pillars.card2_desc')}
            </p>
          </div>

          {/* Card 3: MetaVoice - Sugestões & Feedback */}
          <div className="p-8 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] space-y-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Lightbulb className="w-6 h-6" />
            </div>
            <h4 className="text-xl font-bold dark:text-white">{t('marketing_v2.control_center_page.pillars.card3_title')}</h4>
            <p className="text-neutral-500 dark:text-neutral-400 text-xs leading-relaxed">
              {t('marketing_v2.control_center_page.pillars.card3_desc')}
            </p>
          </div>

          {/* Card 4: MetaBuilders - Rede Exclusiva */}
          <div className="p-8 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] space-y-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
              <Users className="w-6 h-6" />
            </div>
            <h4 className="text-xl font-bold dark:text-white">{t('marketing_v2.control_center_page.pillars.card4_title')}</h4>
            <p className="text-neutral-500 dark:text-neutral-400 text-xs leading-relaxed">
              {t('marketing_v2.control_center_page.pillars.card4_desc')}
            </p>
          </div>

          {/* Card 5: iClub - Vantagens e Fidelidade */}
          <div className="p-8 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] space-y-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <Zap className="w-6 h-6" />
            </div>
            <h4 className="text-xl font-bold dark:text-white">{t('marketing_v2.control_center_page.pillars.card5_title')}</h4>
            <p className="text-neutral-500 dark:text-neutral-400 text-xs leading-relaxed">
              {t('marketing_v2.control_center_page.pillars.card5_desc')}
            </p>
          </div>
        </div>
      </section>

      {/* Bottom CTA Card */}
      <section className="p-12 rounded-[3.5rem] bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-center space-y-8">
        <div className="space-y-3">
          <h2 className="text-3xl font-black dark:text-white">{t('marketing_v2.control_center_page.bottom_cta.title')}</h2>
          <p className="text-neutral-500 dark:text-neutral-400 max-w-xl mx-auto text-sm leading-relaxed">
            {t('marketing_v2.control_center_page.bottom_cta.desc')}
          </p>
        </div>
        <BottomCta />
      </section>

    </div>
  )
}
