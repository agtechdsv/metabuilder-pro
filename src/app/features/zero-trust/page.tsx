'use client'

import { motion } from 'framer-motion'
import { ShieldCheck, Zap, Database, Globe, ArrowLeft, Lock, Server, Cpu, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { useI18n } from '@/i18n/I18nContext'

export default function ZeroTrustFeaturePage() {
  const { t } = useI18n()

  return (
    <div className="max-w-7xl mx-auto px-6 py-20 space-y-24">
      <Link href="/" className="inline-flex items-center gap-2 text-neutral-500 hover:text-indigo-600 transition-colors mb-8 group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        {t('common.back_to_home')}
      </Link>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
        <div className="space-y-8">
          <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 border border-indigo-400/20">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter dark:text-white leading-[1]">
            {t('marketing_v2.features.zero_trust.title').split('.')[0]}. <br/>
            <span className="text-indigo-600">{t('marketing_v2.features.zero_trust.title').split('.')[1]}</span>
          </h1>
          <p className="text-xl text-neutral-500 dark:text-neutral-400 leading-relaxed">
            {t('marketing_v2.features.zero_trust.desc')}
          </p>
        </div>
        
        <div className="relative">
          <div className="absolute inset-0 bg-indigo-500/10 blur-[120px] rounded-full"></div>
          <div className="relative p-8 rounded-[3rem] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-3xl space-y-8">
             <div className="flex items-center justify-between gap-4">
                <div className="text-center space-y-2">
                   <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center mx-auto text-indigo-600">
                      <Globe className="w-6 h-6" />
                   </div>
                   <p className="text-[9px] font-black uppercase dark:text-white">{t('marketing_v2.features.zero_trust.cloud_app')}</p>
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-indigo-500 to-emerald-500 relative">
                   <Zap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500" />
                </div>
                <div className="text-center space-y-2">
                   <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mx-auto text-emerald-600 font-bold">
                      <Cpu className="w-6 h-6" />
                   </div>
                   <p className="text-[9px] font-black uppercase dark:text-white">{t('marketing_v2.features.zero_trust.tunnel_binary')}</p>
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-emerald-500 to-indigo-500 relative">
                   <Database className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                </div>
             </div>
             
             <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-black/50 border border-neutral-100 dark:white/5 font-mono text-[11px] text-indigo-400">
                <p className="text-neutral-500"># Túnel estabelecido via WebSocket Seguro</p>
                <p>tunnel_id: mtb_live_9823</p>
                <p>status: <span className="text-emerald-500">ENCRYPTED_AND_READY</span></p>
             </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        <div className="space-y-6">
           <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
              <Server className="w-6 h-6" />
           </div>
           <h3 className="text-2xl font-black dark:text-white tracking-tight">{t('marketing_v2.features.zero_trust.item1_title')}</h3>
           <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed">
             {t('marketing_v2.features.zero_trust.item1_desc')}
           </p>
        </div>
        <div className="space-y-6">
           <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
              <Lock className="w-6 h-6" />
           </div>
           <h3 className="text-2xl font-black dark:text-white tracking-tight">{t('marketing_v2.features.zero_trust.item2_title')}</h3>
           <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed">
             {t('marketing_v2.features.zero_trust.item2_desc')}
           </p>
        </div>
        <div className="space-y-6">
           <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
              <Zap className="w-6 h-6" />
           </div>
           <h3 className="text-2xl font-black dark:text-white tracking-tight">{t('marketing_v2.features.zero_trust.item3_title')}</h3>
           <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed">
             {t('marketing_v2.features.zero_trust.item3_desc')}
           </p>
        </div>
      </div>

      <section className="bg-neutral-900 rounded-[3rem] p-12 text-white">
         <div className="max-w-3xl space-y-8">
            <h2 className="text-3xl font-black">{t('marketing_v2.features.zero_trust.it_summary')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-4">
                  <div className="flex gap-3">
                     <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                     <p className="text-sm opacity-80">{t('marketing_v2.features.zero_trust.it_item1')}</p>
                  </div>
                  <div className="flex gap-3">
                     <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                     <p className="text-sm opacity-80">{t('marketing_v2.features.zero_trust.it_item2')}</p>
                  </div>
               </div>
               <div className="space-y-4">
                  <div className="flex gap-3">
                     <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                     <p className="text-sm opacity-80">{t('marketing_v2.features.zero_trust.it_item3')}</p>
                  </div>
                  <div className="flex gap-3">
                     <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                     <p className="text-sm opacity-80">{t('marketing_v2.features.zero_trust.it_item4')}</p>
                  </div>
               </div>
            </div>
         </div>
      </section>
      
      <div className="text-center py-10">
         <button className="px-12 py-5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-transform shadow-2xl shadow-indigo-500/20">
            {t('marketing_v2.features.zero_trust.cta')}
         </button>
      </div>
    </div>
  )
}
