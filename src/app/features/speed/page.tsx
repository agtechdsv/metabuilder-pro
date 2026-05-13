'use client'

import { motion } from 'framer-motion'
import { Zap, Clock, Rocket, CheckCircle2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useI18n } from '@/i18n/I18nContext'

export default function SpeedFeaturePage() {
  const { t } = useI18n()

  return (
    <div className="max-w-7xl mx-auto px-6 py-20 space-y-24">
      <Link href="/" className="inline-flex items-center gap-2 text-neutral-500 hover:text-indigo-600 transition-colors mb-8 group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        {t('common.back_to_home')}
      </Link>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
        <div className="space-y-8">
          <div className="w-16 h-16 rounded-3xl bg-yellow-400/10 flex items-center justify-center text-yellow-500 border border-yellow-400/20">
            <Zap className="w-8 h-8 fill-current" />
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter dark:text-white leading-[1]">
            {t('marketing_v2.features.speed.title').split('.')[0]}. <br/>
            <span className="text-yellow-500">{t('marketing_v2.features.speed.title').split('.')[1]}</span>
          </h1>
          <p className="text-xl text-neutral-500 dark:text-neutral-400 leading-relaxed">
            {t('marketing_v2.features.speed.desc')}
          </p>
        </div>
        
        <div className="relative">
          <div className="absolute inset-0 bg-yellow-500/10 blur-3xl rounded-full"></div>
          <div className="relative p-8 rounded-[3rem] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-6">
             <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-4">
               <span className="font-bold text-sm dark:text-white">{t('marketing_v2.features.speed.stats_title')}</span>
               <span className="text-xs text-yellow-500 font-black uppercase">{t('marketing_v2.features.speed.vs_traditional')}</span>
             </div>
             <div className="space-y-4">
               <div className="space-y-2">
                 <div className="flex justify-between text-xs font-bold text-neutral-400">
                   <span>{t('marketing_v2.features.speed.stats_traditional')}</span>
                   <span>12 Horas</span>
                 </div>
                 <div className="w-full h-3 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <div className="w-full h-full bg-neutral-300 dark:bg-neutral-700"></div>
                 </div>
               </div>
               <div className="space-y-2">
                 <div className="flex justify-between text-xs font-bold text-yellow-500">
                   <span>{t('marketing_v2.features.speed.stats_metabuilder')}</span>
                   <span>15 Minutos</span>
                 </div>
                 <div className="w-full h-3 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: '5%' }}
                      transition={{ duration: 1, delay: 0.5 }}
                      className="h-full bg-yellow-500"
                    ></motion.div>
                 </div>
               </div>
             </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-12">
        <div className="space-y-4">
          <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          <h3 className="text-xl font-bold dark:text-white">{t('marketing_v2.features.speed.item1_title')}</h3>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm leading-relaxed">
            {t('marketing_v2.features.speed.item1_desc')}
          </p>
        </div>
        <div className="space-y-4">
          <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          <h3 className="text-xl font-bold dark:text-white">{t('marketing_v2.features.speed.item2_title')}</h3>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm leading-relaxed">
            {t('marketing_v2.features.speed.item2_desc')}
          </p>
        </div>
        <div className="space-y-4">
          <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          <h3 className="text-xl font-bold dark:text-white">{t('marketing_v2.features.speed.item3_title')}</h3>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm leading-relaxed">
            {t('marketing_v2.features.speed.item3_desc')}
          </p>
        </div>
      </section>
      
      <section className="p-12 rounded-[3rem] bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-center space-y-8">
         <h2 className="text-3xl font-black dark:text-white">{t('marketing_v2.features.speed.footer_title')}</h2>
         <p className="text-neutral-500 dark:text-neutral-400 max-w-xl mx-auto">
            {t('marketing_v2.hero.desc')}
         </p>
         <button className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-transform">
            {t('marketing_v2.features.speed.footer_cta')}
         </button>
      </section>
    </div>
  )
}
