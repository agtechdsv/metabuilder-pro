'use client'

import { motion } from 'framer-motion'
import { ArrowLeft, Compass, Languages, LayoutList, MousePointerClick, Route, ShieldCheck, UserCog } from 'lucide-react'
import Link from 'next/link'
import { BottomCta } from '@/components/landing/BottomCta'
import { useI18n } from '@/i18n/I18nContext'

/** Página de divulgação do Tour guiado de quem constrói (Studio, portal e IDE Local). Complementa a página da ajuda ao usuário final (/features/help). */
export default function TourFeaturePage() {
  const { t } = useI18n()
  const k = (key: string) => t(`marketing_v2.features.tour.${key}`)

  const items = [
    { icon: <Compass className="w-5 h-5" />, title: k('item_areas_title'), desc: k('item_areas_desc') },
    { icon: <MousePointerClick className="w-5 h-5" />, title: k('item_click_title'), desc: k('item_click_desc') },
    { icon: <ShieldCheck className="w-5 h-5" />, title: k('item_safe_title'), desc: k('item_safe_desc') },
    { icon: <Route className="w-5 h-5" />, title: k('item_practice_title'), desc: k('item_practice_desc') },
    { icon: <LayoutList className="w-5 h-5" />, title: k('item_menu_title'), desc: k('item_menu_desc') },
    { icon: <UserCog className="w-5 h-5" />, title: k('item_roles_title'), desc: k('item_roles_desc') },
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
            <Compass className="w-8 h-8" />
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter dark:text-white leading-[1]">
            {k('hero_title')} <br />
            <span className="text-indigo-500">{k('hero_title_highlight')}</span>
          </h1>
          <p className="text-xl text-neutral-500 dark:text-neutral-400 leading-relaxed">{k('hero_desc')}</p>
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
              <Compass className="w-12 h-12" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black dark:text-white">{k('demo_title')}</h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">{k('demo_desc')}</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(['studio', 'portal', 'ide'] as const).map(a => (
                <div key={a} className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800 text-[10px] font-black uppercase dark:text-white">{k(`badge_${a}`)}</div>
              ))}
            </div>
            <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800 flex items-center justify-center gap-3">
              <Languages className="w-4 h-4 text-indigo-500" />
              <span className="text-[10px] font-black uppercase dark:text-white">{k('languages')}</span>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="space-y-12">
        <div className="max-w-3xl space-y-4">
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter dark:text-white">{k('items_title')}</h2>
          <p className="text-lg text-neutral-500 dark:text-neutral-400">{k('items_desc')}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map(it => (
            <motion.div
              key={it.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="p-8 rounded-[2rem] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-4"
            >
              <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">{it.icon}</div>
              <h3 className="text-lg font-black dark:text-white">{it.title}</h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">{it.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="p-10 md:p-14 rounded-[3rem] bg-indigo-900/5 border border-indigo-500/20 space-y-4">
        <h2 className="text-3xl font-black tracking-tighter dark:text-white">{k('types_title')}</h2>
        <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed">{k('types_desc')}</p>
        <Link href="/features/help" className="inline-block text-sm font-black text-indigo-600 hover:underline">{t('marketing_v2.navbar.help')} →</Link>
      </section>

      <BottomCta />
    </div>
  )
}
