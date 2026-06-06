'use client'

import { motion } from 'framer-motion'
import { Database, ShieldCheck, CheckCircle2, ArrowLeft, RefreshCw, Layers } from 'lucide-react'
import Link from 'next/link'
import { BottomCta } from '@/components/landing/BottomCta'
import { useI18n } from '@/i18n/I18nContext'

export default function SyncResolutionFeaturePage() {
  const { t } = useI18n()

  return (
    <div className="max-w-7xl mx-auto px-6 py-20 space-y-24">
      <Link href="/" className="inline-flex items-center gap-2 text-neutral-500 hover:text-cyan-600 transition-colors mb-8 group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        {t('common.back_to_home')}
      </Link>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
        <div className="space-y-8">
          <div className="w-16 h-16 rounded-3xl bg-cyan-400/10 flex items-center justify-center text-cyan-500 border border-cyan-400/20">
            <RefreshCw className="w-8 h-8" />
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter dark:text-white leading-[1]">
            {t('marketing_v2.features.sync_resolution.title_part1')} <br/>
            <span className="text-cyan-500">{t('marketing_v2.features.sync_resolution.title_part2')}</span>
          </h1>
          <p className="text-xl text-neutral-500 dark:text-neutral-400 leading-relaxed">
            {t('marketing_v2.features.sync_resolution.desc')}
          </p>
        </div>
        
        <div className="relative">
          <div className="absolute inset-0 bg-cyan-500/10 blur-3xl rounded-full"></div>
          <div className="relative p-2 rounded-[2.5rem] bg-gradient-to-br from-cyan-500/20 to-blue-500/10 dark:from-cyan-900/40 dark:to-blue-900/20 border border-cyan-500/20 shadow-2xl space-y-6 overflow-hidden">
             <img src="/sync-resolution-demo.png" alt="Demonstração do Sync Resolution" className="w-full h-auto rounded-[2rem] shadow-inner" />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-12">
        <div className="space-y-4">
          <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          <h3 className="text-xl font-bold dark:text-white">{t('marketing_v2.features.sync_resolution.item1_title')}</h3>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm leading-relaxed">
            {t('marketing_v2.features.sync_resolution.item1_desc')}
          </p>
        </div>
        <div className="space-y-4">
          <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          <h3 className="text-xl font-bold dark:text-white">{t('marketing_v2.features.sync_resolution.item2_title')}</h3>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm leading-relaxed">
            {t('marketing_v2.features.sync_resolution.item2_desc')}
          </p>
        </div>
        <div className="space-y-4">
          <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          <h3 className="text-xl font-bold dark:text-white">{t('marketing_v2.features.sync_resolution.item3_title')}</h3>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm leading-relaxed">
            {t('marketing_v2.features.sync_resolution.item3_desc')}
          </p>
        </div>
      </section>

      {/* Como funciona Step-by-Step */}
      <section className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[3rem] p-12 lg:p-20">
        <div className="max-w-3xl mx-auto text-center mb-16 space-y-4">
          <h2 className="text-3xl md:text-5xl font-black dark:text-white tracking-tight">
            {t('marketing_v2.features.sync_resolution.how_magic_happens').split(' ')[0]} {t('marketing_v2.features.sync_resolution.how_magic_happens').split(' ')[1]} <span className="text-cyan-500">{t('marketing_v2.features.sync_resolution.how_magic_happens').split(' ')[2]}</span> {t('marketing_v2.features.sync_resolution.how_magic_happens').split(' ')[3]}
          </h2>
          <p className="text-lg text-neutral-500 dark:text-neutral-400">
            {t('marketing_v2.features.sync_resolution.how_magic_happens_desc')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          <div className="hidden md:block absolute top-12 left-1/6 right-1/6 h-0.5 bg-gradient-to-r from-cyan-500/0 via-cyan-500/50 to-cyan-500/0 -z-0"></div>

          <div className="relative z-10 flex flex-col items-center text-center space-y-6">
            <div className="w-24 h-24 rounded-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 shadow-xl flex items-center justify-center text-2xl font-black text-cyan-500">
              1
            </div>
            <div>
              <h4 className="text-xl font-bold dark:text-white mb-2">{t('marketing_v2.features.sync_resolution.step1_title')}</h4>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                {t('marketing_v2.features.sync_resolution.step1_desc')}
              </p>
            </div>
          </div>

          <div className="relative z-10 flex flex-col items-center text-center space-y-6">
            <div className="w-24 h-24 rounded-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 shadow-xl flex items-center justify-center text-2xl font-black text-cyan-500">
              2
            </div>
            <div>
              <h4 className="text-xl font-bold dark:text-white mb-2">{t('marketing_v2.features.sync_resolution.step2_title')}</h4>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                {t('marketing_v2.features.sync_resolution.step2_desc')}
              </p>
            </div>
          </div>

          <div className="relative z-10 flex flex-col items-center text-center space-y-6">
            <div className="w-24 h-24 rounded-full bg-cyan-500 border border-cyan-400 shadow-xl shadow-cyan-500/20 flex items-center justify-center text-white">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h4 className="text-xl font-bold dark:text-white mb-2">{t('marketing_v2.features.sync_resolution.step3_title')}</h4>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                {t('marketing_v2.features.sync_resolution.step3_desc')}
              </p>
            </div>
          </div>
        </div>
      </section>
      
      <section className="p-12 rounded-[3rem] bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-center space-y-8">
         <h2 className="text-3xl font-black dark:text-white">{t('marketing_v2.features.sync_resolution.footer_title')}</h2>
         <p className="text-neutral-500 dark:text-neutral-400 max-w-xl mx-auto">
            {t('marketing_v2.hero.desc')}
         </p>
         <BottomCta />
      </section>
    </div>
  )
}
