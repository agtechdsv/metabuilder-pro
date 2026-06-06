'use client'

import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { ArrowRight, Workflow, Activity, Database, CheckCircle2, MonitorPlay, Zap } from 'lucide-react'
import Link from 'next/link'
import { useI18n } from '@/i18n/I18nContext'

interface BpmLandingClientProps {
  user: any
  profile: any
}

export function BpmLandingClient({ user, profile }: BpmLandingClientProps) {
  const { t } = useI18n()

  const features = [
    {
      icon: <MonitorPlay className="w-6 h-6 text-emerald-400" />,
      title: t('bpm_page.features.visual_editor_title'),
      desc: t('bpm_page.features.visual_editor_desc')
    },
    {
      icon: <Activity className="w-6 h-6 text-indigo-400" />,
      title: t('bpm_page.features.two_way_sync_title'),
      desc: t('bpm_page.features.two_way_sync_desc')
    },
    {
      icon: <Zap className="w-6 h-6 text-yellow-400" />,
      title: t('bpm_page.features.batch_actions_title'),
      desc: t('bpm_page.features.batch_actions_desc')
    },
    {
      icon: <Database className="w-6 h-6 text-blue-400" />,
      title: t('bpm_page.features.zero_trust_title'),
      desc: t('bpm_page.features.zero_trust_desc')
    }
  ]

  return (
    <div className="min-h-screen pt-16 flex flex-col bg-white dark:bg-black text-black dark:text-white transition-colors duration-500 relative overflow-hidden">
      <Navbar user={user} profile={profile} />

      <main className="flex-grow flex flex-col relative z-10">
        {/* Decorative background elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-[-1]">
          <div className="absolute top-[10%] left-[-10%] w-[60%] h-[40%] bg-emerald-500/10 rounded-full blur-[140px]"></div>
          <div className="absolute bottom-[20%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[140px]"></div>
        </div>

        {/* Hero Section */}
        <section className="relative pt-32 pb-20 px-6 max-w-7xl mx-auto w-full text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest mb-4">
            <Workflow className="w-3.5 h-3.5" />
            {t('bpm_page.badge')}
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter dark:text-white leading-[1.1] max-w-4xl mx-auto">
            {t('bpm_page.title_part1')} <br />
            {t('bpm_page.title_part2')} <span className="text-emerald-600">{t('bpm_page.title_part3')}</span>
          </h1>
          <p className="text-xl text-neutral-500 dark:text-neutral-400 max-w-2xl mx-auto font-medium leading-relaxed">
            {t('bpm_page.subtitle')}
          </p>
          <div className="flex justify-center gap-4 pt-6">
            <Link
              href="/#pricing"
              className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all hover:scale-105 shadow-xl shadow-emerald-500/20"
            >
              {t('bpm_page.cta_start')}
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-8 py-4 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-900 dark:text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all border border-neutral-200 dark:border-neutral-800"
            >
              {t('bpm_page.cta_interfaces')}
            </Link>
          </div>
        </section>

        {/* Big Visual Mockup */}
        <section className="max-w-6xl mx-auto w-full px-6 py-12">
          <div className="relative rounded-[2.5rem] bg-neutral-900 border border-neutral-800 shadow-2xl overflow-hidden aspect-[16/9] flex items-center justify-center p-8">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
            
            {/* Diagram Simulation */}
            <div className="relative z-10 w-full h-full flex flex-col items-center justify-center space-y-12">
              <div className="px-6 py-3 rounded-xl bg-white text-black font-bold text-sm shadow-xl flex items-center gap-2 border-b-4 border-emerald-500">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                {t('bpm_page.simulation_trigger')}
              </div>
              
              <div className="w-px h-12 bg-neutral-700 relative">
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-3 h-3 rotate-45 border-r-2 border-b-2 border-neutral-700"></div>
              </div>
              
              <div className="flex gap-16">
                <div className="px-6 py-4 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-xl border border-indigo-400">
                  <div className="text-[10px] uppercase text-indigo-200 tracking-widest mb-1">{t('bpm_page.deep_dive.bpm_panel').split(' ')[0]}</div>
                  {t('bpm_page.simulation_action')}
                </div>
                
                <div className="px-6 py-4 rounded-xl bg-amber-500 text-white font-bold text-sm shadow-xl border border-amber-300">
                  <div className="text-[10px] uppercase text-amber-100 tracking-widest mb-1">{t('bpm_page.features.zero_trust_title').split(' ')[0]}</div>
                  {t('bpm_page.simulation_integration')}
                </div>
              </div>
            </div>
            
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs font-mono text-neutral-500">
              <div className="flex gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500/50"></span>
                <span className="w-3 h-3 rounded-full bg-yellow-500/50"></span>
                <span className="w-3 h-3 rounded-full bg-green-500/50"></span>
              </div>
              <div>{t('bpm_page.simulation_title')}</div>
            </div>
          </div>
        </section>

        {/* Features Bento */}
        <section className="max-w-7xl mx-auto w-full px-6 py-24">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, i) => (
              <div key={i} className="p-8 rounded-[2.5rem] bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 hover:border-emerald-500/50 transition-all duration-300">
                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-neutral-950 flex items-center justify-center mb-6 shadow-inner border border-neutral-200 dark:border-neutral-800">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold dark:text-white mb-3">{feature.title}</h3>
                <p className="text-sm text-neutral-555 dark:text-neutral-400 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Two-way Sync Deep Dive */}
        <section className="max-w-7xl mx-auto w-full px-6 py-24 border-t border-neutral-100 dark:border-neutral-900">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <h2 className="text-3xl md:text-5xl font-black tracking-tight dark:text-white leading-[1.1]">
                {t('bpm_page.deep_dive.title_part1')} <br />
                <span className="text-indigo-600">{t('bpm_page.deep_dive.title_part2')}</span>
              </h2>
              <p className="text-lg text-neutral-555 dark:text-neutral-400 leading-relaxed">
                {t('bpm_page.deep_dive.desc')}
              </p>
              <ul className="space-y-4 pt-4">
                <li className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span className="text-neutral-600 dark:text-neutral-300 font-medium">{t('bpm_page.deep_dive.item1')}</span>
                </li>
                <li className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span className="text-neutral-600 dark:text-neutral-300 font-medium">{t('bpm_page.deep_dive.item2')}</span>
                </li>
                <li className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span className="text-neutral-600 dark:text-neutral-300 font-medium">{t('bpm_page.deep_dive.item3')}</span>
                </li>
              </ul>
            </div>
            
            <div className="p-8 rounded-[3rem] bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-500/20 shadow-2xl relative">
               <div className="grid grid-cols-2 gap-4 h-64">
                 <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 flex flex-col justify-between shadow-lg">
                    <span className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">{t('bpm_page.deep_dive.studio_panel')}</span>
                    <div className="w-full h-8 bg-emerald-500/20 border border-emerald-500 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-lg flex items-center justify-center">{t('bpm_page.deep_dive.checkbox_on')}</div>
                 </div>
                 <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 flex flex-col justify-between shadow-lg">
                    <span className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">{t('bpm_page.deep_dive.bpm_panel')}</span>
                    <div className="w-full h-8 bg-indigo-500/20 border border-indigo-500 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-lg flex items-center justify-center">{t('bpm_page.deep_dive.node_link_on')}</div>
                 </div>
               </div>
               
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-white dark:bg-black border-4 border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center shadow-2xl z-10">
                 <svg className="w-6 h-6 text-indigo-500 animate-spin-slow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
               </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
