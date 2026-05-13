'use client'

import { motion } from 'framer-motion'
import { Palette, ImageIcon, Type, Layout, ArrowLeft, MousePointer2 } from 'lucide-react'
import Link from 'next/link'
import { useI18n } from '@/i18n/I18nContext'

export default function BrandingFeaturePage() {
  const { t } = useI18n()

  return (
    <div className="max-w-7xl mx-auto px-6 py-20 space-y-24">
      <Link href="/" className="inline-flex items-center gap-2 text-neutral-500 hover:text-indigo-600 transition-colors mb-8 group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        {t('common.back_to_home')}
      </Link>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
        <div className="space-y-8">
          <div className="w-16 h-16 rounded-3xl bg-purple-500/10 flex items-center justify-center text-purple-500 border border-purple-400/20">
            <Palette className="w-8 h-8" />
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter dark:text-white leading-[1]">
            {t('marketing_v2.features.branding.title').split('.')[0]}. <br/>
            <span className="text-purple-500">{t('marketing_v2.features.branding.title').split('.')[1]}</span>
          </h1>
          <p className="text-xl text-neutral-500 dark:text-neutral-400 leading-relaxed">
            {t('marketing_v2.features.branding.desc')}
          </p>
        </div>
        
        <div className="relative">
          <div className="absolute -top-10 -right-10 w-64 h-64 bg-purple-500/10 blur-[100px] rounded-full"></div>
          <div className="relative space-y-6">
             {/* Dynamic Theme Preview Card */}
             <div className="p-8 rounded-[3rem] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6">
                   <div className="flex gap-2">
                      <div className="w-4 h-4 rounded-full bg-purple-500"></div>
                      <div className="w-4 h-4 rounded-full bg-indigo-500"></div>
                      <div className="w-4 h-4 rounded-full bg-emerald-500"></div>
                   </div>
                </div>
                
                <div className="space-y-6">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white">
                         <Palette className="w-5 h-5" />
                      </div>
                      <div>
                         <div className="h-4 w-32 bg-neutral-200 dark:bg-neutral-800 rounded-full mb-2"></div>
                         <div className="h-2 w-20 bg-neutral-100 dark:bg-neutral-800/50 rounded-full"></div>
                      </div>
                   </div>
                   <div className="space-y-3">
                      <div className="h-8 w-full bg-purple-500/10 rounded-xl border border-purple-500/20"></div>
                      <div className="h-8 w-full bg-neutral-50 dark:bg-neutral-800/30 rounded-xl border border-neutral-100 dark:border-neutral-800"></div>
                   </div>
                   <button className="w-full py-4 bg-purple-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-purple-500/20">
                      {t('marketing_v2.features.branding.primary_action')}
                   </button>
                </div>

                <div className="absolute bottom-6 right-6 flex items-center gap-2 px-3 py-1 bg-neutral-900 text-white rounded-full text-[9px] font-black uppercase tracking-tighter animate-bounce">
                   <MousePointer2 className="w-3 h-3" />
                   Customize Now
                </div>
             </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="p-10 rounded-[2.5rem] bg-neutral-100/50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 space-y-4">
           <ImageIcon className="w-6 h-6 text-purple-500" />
           <h3 className="font-bold dark:text-white">{t('marketing_v2.features.branding.item1_title')}</h3>
           <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
             {t('marketing_v2.features.branding.item1_desc')}
           </p>
        </div>
        <div className="p-10 rounded-[2.5rem] bg-neutral-100/50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 space-y-4">
           <Type className="w-6 h-6 text-purple-500" />
           <h3 className="font-bold dark:text-white">{t('marketing_v2.features.branding.item2_title')}</h3>
           <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
             {t('marketing_v2.features.branding.item2_desc')}
           </p>
        </div>
        <div className="p-10 rounded-[2.5rem] bg-neutral-100/50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 space-y-4">
           <Layout className="w-6 h-6 text-purple-500" />
           <h3 className="font-bold dark:text-white">{t('marketing_v2.features.branding.item3_title')}</h3>
           <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
             {t('marketing_v2.features.branding.item3_desc')}
           </p>
        </div>
      </section>

      <div className="text-center py-20 border-y border-neutral-100 dark:border-neutral-800">
         <h2 className="text-3xl md:text-5xl font-black dark:text-white tracking-tighter mb-6">
           {t('marketing_v2.features.branding.footer_title')} <br/>
           {t('marketing_v2.features.branding.footer_subtitle')}
         </h2>
         <p className="text-neutral-500 dark:text-neutral-400 max-w-2xl mx-auto text-lg mb-10">
            {t('marketing_v2.hero.desc')}
         </p>
         <button className="px-12 py-5 bg-purple-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-purple-700 transition-all shadow-2xl shadow-purple-500/20">
            {t('marketing_v2.features.branding.footer_cta')}
         </button>
      </div>
    </div>
  )
}
