'use client'

import { motion } from 'framer-motion'
import { ShieldCheck, Zap, Database, Palette, Layout, Globe, Search, ArrowRight, CheckCircle2 } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import Link from 'next/link'

export function MarketingSections() {
  const { t } = useI18n()

  const features = [
    {
      icon: <Zap className="w-6 h-6 text-yellow-400" />,
      title: t('marketing_v2.navbar.speed'),
      desc: t('marketing_v2.features.speed.desc'),
      href: "/features/speed"
    },
    {
      icon: <Database className="w-6 h-6 text-blue-400" />,
      title: t('marketing_v2.navbar.integration'),
      desc: t('marketing_v2.features.integration.desc'),
      href: "/features/integration"
    },
    {
      icon: <Palette className="w-6 h-6 text-purple-400" />,
      title: t('marketing_v2.navbar.branding'),
      desc: t('marketing_v2.features.branding.desc'),
      href: "/features/branding"
    },
    {
      icon: <ShieldCheck className="w-6 h-6 text-emerald-400" />,
      title: t('marketing_v2.navbar.zero_trust'),
      desc: t('marketing_v2.features.zero_trust.desc'),
      href: "/features/zero-trust"
    }
  ]

  return (
    <div className="w-full space-y-32 py-20 px-6">
      
      {/* Feature Bento Grid */}
      <section className="max-w-7xl mx-auto">
        <div className="max-w-4xl mx-auto text-center mb-20 space-y-4">
        <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-black dark:text-white leading-[1.1]">
          {t('marketing_v2.home.bento_title')} <br/>
          <span className="text-indigo-600">{t('marketing_v2.home.bento_highlight')}</span>
        </h2>
        <p className="text-xl text-neutral-500 dark:text-neutral-400 font-medium">
          {t('marketing_v2.home.bento_desc')}
        </p>
      </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => (
            <Link key={i} href={feature.href} className="group p-8 rounded-[2.5rem] bg-neutral-100/50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 hover:border-indigo-500/50 transition-all duration-500 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-neutral-950 flex items-center justify-center mb-6 shadow-inner border border-neutral-200 dark:border-neutral-800 group-hover:scale-110 transition-transform duration-500">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold dark:text-white mb-3">{feature.title}</h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">{feature.desc}</p>
              </div>
              <div className="mt-8 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                Saiba Mais <ArrowRight className="w-3 h-3" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Legacy Bridge Showcase */}
      <section className="bg-blue-600 rounded-[3rem] p-12 md:p-20 text-white relative overflow-hidden group">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
               <h2 className="text-4xl md:text-6xl font-black tracking-tighter leading-[1]">
                 {t('marketing_v2.home.bridge_title')} <br/>
                 <span className="text-blue-200">{t('marketing_v2.home.bridge_subtitle')}</span>
               </h2>
               <p className="text-xl text-blue-100 leading-relaxed font-medium">
                 {t('marketing_v2.home.bridge_desc')}
               </p>
               <div className="flex flex-wrap gap-4">
                  <button className="px-8 py-4 bg-white text-blue-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-transform shadow-xl">
                    {t('marketing_v2.home.bridge_cta_demo')}
                  </button>
                  <button className="px-8 py-4 bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest border border-blue-500 hover:bg-blue-800 transition-colors">
                    {t('marketing_v2.home.bridge_cta_docs')}
                  </button>
               </div>
            </div>
          
          <div className="relative h-[400px] lg:h-full flex items-center justify-center">
             <div className="w-full aspect-video bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 shadow-3xl p-4 transform lg:rotate-3 group-hover:rotate-0 transition-transform duration-700">
                {/* Simulated Terminal/Code */}
                <div className="flex gap-1.5 mb-4">
                  <div className="w-2 h-2 rounded-full bg-red-500/50"></div>
                  <div className="w-2 h-2 rounded-full bg-yellow-500/50"></div>
                  <div className="w-2 h-2 rounded-full bg-green-500/50"></div>
                </div>
                <div className="font-mono text-[10px] text-indigo-300 space-y-2 opacity-80">
                  <p>$ npx metabuilder-cli connect --host db.empresa.com</p>
                  <p className="text-emerald-400">✓ Connected to PostgreSQL 16.2</p>
                  <p>✨ Scanning 42 tables...</p>
                  <p>✨ Generating 156 UI components...</p>
                  <p className="text-indigo-400">🚀 Production Ready in /runtime</p>
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* Zero-Trust Bridge Architecture Detail */}
      <section className="max-w-7xl mx-auto py-20 border-y border-neutral-100 dark:border-neutral-900">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div className="relative">
             {/* Visual diagram of the architecture */}
             <div className="p-8 rounded-[3rem] bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 shadow-2xl relative">
                <div className="absolute -top-10 -left-10 w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl z-10">
                   <ShieldCheck className="w-10 h-10" />
                </div>
                
                <div className="space-y-12">
                   <div className="flex items-center gap-4 justify-between">
                      <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-500/20 text-center flex-1">
                         <Globe className="w-6 h-6 mx-auto mb-2 text-indigo-600" />
                         <span className="text-[10px] font-black uppercase dark:text-white">Cloud Runtime</span>
                      </div>
                      <div className="flex-1 flex items-center justify-center">
                         <div className="h-px bg-indigo-200 dark:bg-indigo-800 flex-1 relative">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white dark:bg-neutral-900 border border-indigo-500 flex items-center justify-center">
                               <Zap className="w-4 h-4 text-indigo-500 animate-pulse" />
                            </div>
                         </div>
                      </div>
                      <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-500/20 text-center flex-1">
                         <Database className="w-6 h-6 mx-auto mb-2 text-emerald-600" />
                         <span className="text-[10px] font-black uppercase dark:text-white">Seu Banco Local</span>
                      </div>
                   </div>

                   <div className="bg-neutral-50 dark:bg-neutral-900 p-6 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                      <h4 className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-4">{t('marketing_v2.features.zero_trust.it_summary')}</h4>
                      <ul className="space-y-3">
                         <li className="flex items-start gap-3 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-indigo-500 mt-0.5" />
                            <span className="text-neutral-600 dark:text-neutral-400">{t('marketing_v2.features.zero_trust.item1_title')}: {t('marketing_v2.features.zero_trust.item1_desc')}</span>
                         </li>
                         <li className="flex items-start gap-3 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-indigo-500 mt-0.5" />
                            <span className="text-neutral-600 dark:text-neutral-400">{t('marketing_v2.features.zero_trust.it_item1')}</span>
                         </li>
                         <li className="flex items-start gap-3 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-indigo-500 mt-0.5" />
                            <span className="text-neutral-600 dark:text-neutral-400">{t('marketing_v2.features.zero_trust.it_item3')}</span>
                         </li>
                      </ul>
                   </div>
                </div>
             </div>
          </div>

          <div className="space-y-8">
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter dark:text-white leading-[1]">
              {t('marketing_v2.home.zero_trust_title')} <br/>
              <span className="text-indigo-600">{t('marketing_v2.home.zero_trust_highlight')}</span>
            </h2>
            <p className="text-xl text-neutral-500 dark:text-neutral-400 leading-relaxed">
              {t('marketing_v2.home.zero_trust_desc')}
            </p>
            <div className="flex gap-4">
               <div className="flex-1 p-6 rounded-3xl bg-neutral-100 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800">
                  <h4 className="text-2xl font-black text-indigo-600 mb-2">100%</h4>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{t('marketing_v2.home.zero_trust_encrypted')}</p>
               </div>
               <div className="flex-1 p-6 rounded-3xl bg-neutral-100 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800">
                  <h4 className="text-2xl font-black text-emerald-600 mb-2">Zero</h4>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{t('marketing_v2.home.zero_trust_ports')}</p>
               </div>
            </div>
          </div>
        </div>
      </section>
      <section className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="p-12 rounded-[2.5rem] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl">
             <Layout className="w-7 h-7" />
          </div>
          <h3 className="text-3xl font-black dark:text-white tracking-tight">{t('marketing_v2.home.wizard_title')}</h3>
          <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed">
            {t('marketing_v2.home.wizard_desc')}
          </p>
        </div>
        
        <div className="p-12 rounded-[2.5rem] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-xl">
             <Globe className="w-7 h-7" />
          </div>
          <h3 className="text-3xl font-black dark:text-white tracking-tight">{t('marketing_v2.home.whitelabel_title')}</h3>
          <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed">
            {t('marketing_v2.home.whitelabel_desc')}
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-7xl mx-auto py-20 text-center space-y-10">
        <div className="space-y-4">
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter dark:text-white leading-[1.1]">
            {t('marketing_v2.home.cta_title')}
          </h2>
          <p className="text-xl text-neutral-500 dark:text-neutral-400 max-w-2xl mx-auto font-medium">
            {t('marketing_v2.home.cta_desc')}
          </p>
        </div>
        
        <div className="flex flex-wrap justify-center gap-6">
          <Link 
            href="/auth/signup"
            className="px-10 py-5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all hover:scale-105 shadow-2xl shadow-indigo-500/20"
          >
            {t('marketing_v2.home.cta_start')}
          </Link>
          <button 
            className="px-10 py-5 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white rounded-2xl font-black text-xs uppercase tracking-widest border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all"
          >
            {t('marketing_v2.home.cta_plans')}
          </button>
        </div>
      </section>

    </div>
  )
}
