'use client'

import { motion } from 'framer-motion'
import { FlaskConical, ShieldCheck, Database, Layers, Eye, FileText, ArrowLeft, Play, Users, Cpu, Smartphone, Globe, Gauge } from 'lucide-react'
import Link from 'next/link'
import { BottomCta } from '@/components/landing/BottomCta'
import { useI18n } from '@/i18n/I18nContext'

export default function TestingFeaturePage() {
  const { t } = useI18n()

  const types = [
    { icon: <Play className="w-5 h-5" />, title: t('marketing_v2.features.testing.type_functional_title'), desc: t('marketing_v2.features.testing.type_functional_desc') },
    { icon: <Database className="w-5 h-5" />, title: t('marketing_v2.features.testing.type_integration_title'), desc: t('marketing_v2.features.testing.type_integration_desc') },
    { icon: <Users className="w-5 h-5" />, title: t('marketing_v2.features.testing.type_security_title'), desc: t('marketing_v2.features.testing.type_security_desc') },
    { icon: <Smartphone className="w-5 h-5" />, title: t('marketing_v2.features.testing.type_responsive_title'), desc: t('marketing_v2.features.testing.type_responsive_desc') },
    { icon: <Globe className="w-5 h-5" />, title: t('marketing_v2.features.testing.type_compat_title'), desc: t('marketing_v2.features.testing.type_compat_desc') },
    { icon: <Gauge className="w-5 h-5" />, title: t('marketing_v2.features.testing.type_load_title'), desc: t('marketing_v2.features.testing.type_load_desc') },
  ]

  return (
    <div className="max-w-7xl mx-auto px-6 py-20 space-y-24">
      <Link href="/" className="inline-flex items-center gap-2 text-neutral-500 hover:text-indigo-600 transition-colors mb-8 group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        {t('common.back_to_home')}
      </Link>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
        <div className="space-y-8">
          <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 border border-indigo-400/20">
            <FlaskConical className="w-8 h-8" />
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter dark:text-white leading-[1]">
            {t('marketing_v2.features.testing.hero_title')} <br />
            <span className="text-indigo-500">{t('marketing_v2.features.testing.hero_title_highlight')}</span>
          </h1>
          <p className="text-xl text-neutral-500 dark:text-neutral-400 leading-relaxed">
            {t('marketing_v2.features.testing.hero_desc')}
          </p>
        </div>

        <div className="relative">
          <div className="absolute inset-0 bg-indigo-500/10 blur-[120px] rounded-full"></div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative p-12 rounded-[4rem] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-3xl text-center space-y-8"
          >
            <div className="inline-block p-6 rounded-full bg-indigo-500 text-white shadow-2xl shadow-indigo-500/20">
              <FlaskConical className="w-12 h-12" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black dark:text-white">{t('marketing_v2.features.testing.tech_title')}</h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('marketing_v2.features.testing.tech_desc')}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800 flex items-center gap-3">
                <Layers className="w-4 h-4 text-indigo-500" />
                <span className="text-[10px] font-black uppercase dark:text-white">{t('marketing_v2.features.testing.tag_nocode')}</span>
              </div>
              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800 flex items-center gap-3">
                <ShieldCheck className="w-4 h-4 text-indigo-500" />
                <span className="text-[10px] font-black uppercase dark:text-white">{t('marketing_v2.features.testing.tag_safe')}</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="space-y-10">
        <div className="max-w-3xl space-y-4">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight dark:text-white">{t('marketing_v2.features.testing.types_title')}</h2>
          <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed">{t('marketing_v2.features.testing.types_desc')}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {types.map(tp => (
            <div key={tp.title} className="p-8 rounded-[2.5rem] bg-neutral-100/50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">{tp.icon}</div>
              <h3 className="text-xl font-black dark:text-white tracking-tight">{tp.title}</h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">{tp.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="space-y-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-2xl font-black dark:text-white tracking-tight">{t('marketing_v2.features.testing.block1_title')}</h3>
          <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed">{t('marketing_v2.features.testing.block1_desc')}</p>
        </div>
        <div className="space-y-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
            <Cpu className="w-6 h-6" />
          </div>
          <h3 className="text-2xl font-black dark:text-white tracking-tight">{t('marketing_v2.features.testing.block2_title')}</h3>
          <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed">{t('marketing_v2.features.testing.block2_desc')}</p>
        </div>
        <div className="space-y-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
            <Eye className="w-6 h-6" />
          </div>
          <h3 className="text-2xl font-black dark:text-white tracking-tight">{t('marketing_v2.features.testing.block3_title')}</h3>
          <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed">{t('marketing_v2.features.testing.block3_desc')}</p>
        </div>
        <div className="space-y-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-2xl font-black dark:text-white tracking-tight">{t('marketing_v2.features.testing.block4_title')}</h3>
          <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed">{t('marketing_v2.features.testing.block4_desc')}</p>
        </div>
      </section>

      <div className="p-16 rounded-[3rem] bg-indigo-600 text-white relative overflow-hidden group">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
        <div className="relative z-10 text-center space-y-8">
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter">{t('marketing_v2.features.testing.footer_title')}</h2>
          <p className="text-indigo-100 max-w-2xl mx-auto text-lg leading-relaxed">{t('marketing_v2.features.testing.footer_desc')}</p>
          <BottomCta />
        </div>
      </div>
    </div>
  )
}
