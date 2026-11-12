'use client'

import { motion } from 'framer-motion'
import { ArrowLeft, Banknote, CalendarClock, CircleDollarSign, Handshake, LayoutDashboard, Link2, MessageCircle, RotateCcw, Share2, UserPlus, Wallet } from 'lucide-react'
import Link from 'next/link'
import { useI18n } from '@/i18n/I18nContext'
import { salesWhatsappUrl } from '@/lib/contact'

interface Props {
  /** as condições vigentes (ajustes do SuperAdmin) */
  terms: { percent: number; days: number; min: number }
}

/** Divulgação do programa de parceiros: como funciona, condições vigentes, o painel do parceiro, para quem é e perguntas frequentes. */
export default function PartnersLanding({ terms }: Props) {
  const { t } = useI18n()
  const k = (key: string) => t(`partners_page.${key}`)
  const fill = (key: string) => k(key).replace('{percent}', String(terms.percent)).replace('{days}', String(terms.days)).replace('{min}', String(terms.min))

  const steps = [
    { icon: <MessageCircle className="w-5 h-5" />, title: k('step1_title'), desc: k('step1_desc') },
    { icon: <Share2 className="w-5 h-5" />, title: k('step2_title'), desc: k('step2_desc') },
    { icon: <UserPlus className="w-5 h-5" />, title: k('step3_title'), desc: k('step3_desc') },
    { icon: <Banknote className="w-5 h-5" />, title: k('step4_title'), desc: k('step4_desc') },
  ]
  const termItems = [
    { icon: <CircleDollarSign className="w-4 h-4" />, text: fill('term_percent') },
    { icon: <CalendarClock className="w-4 h-4" />, text: fill('term_grace') },
    { icon: <Wallet className="w-4 h-4" />, text: fill('term_min') },
    { icon: <RotateCcw className="w-4 h-4" />, text: k('term_refund') },
    { icon: <Handshake className="w-4 h-4" />, text: k('term_custom') },
  ]
  const who = ['who_1', 'who_2', 'who_3', 'who_4'].map(w => k(w))
  const faqs = [1, 2, 3, 4].map(n => ({ q: k(`faq${n}_q`), a: k(`faq${n}_a`) }))
  const wa = salesWhatsappUrl(k('wa_message'))

  return (
    <div className="max-w-7xl mx-auto px-6 py-20 space-y-24">
      <Link href="/" className="inline-flex items-center gap-2 text-neutral-500 hover:text-indigo-600 transition-colors mb-8 group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        {t('common.back_to_home')}
      </Link>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div className="space-y-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-4 py-1.5 text-[11px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            <Handshake className="w-3.5 h-3.5" />{k('badge')}
          </span>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter dark:text-white leading-[1]">
            {k('hero_title')} <br />
            <span className="text-indigo-500">{k('hero_title_highlight')}</span>
          </h1>
          <p className="text-xl text-neutral-500 dark:text-neutral-400 leading-relaxed">{k('hero_desc')}</p>
          <div className="flex flex-wrap gap-3">
            <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-7 py-4 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-indigo-500/25 transition-all hover:bg-indigo-700">
              <MessageCircle className="w-4 h-4" />{k('cta_whatsapp')}
            </a>
            <Link href="/parceiro" className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 px-7 py-4 text-xs font-black uppercase tracking-widest text-neutral-700 transition-all hover:border-indigo-400 hover:text-indigo-600 dark:border-neutral-800 dark:text-neutral-300">
              <LayoutDashboard className="w-4 h-4" />{k('cta_panel')}
            </Link>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative p-10 rounded-[3rem] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xl space-y-6"
        >
          <h2 className="text-2xl font-black dark:text-white">{k('terms_title')}</h2>
          <ul className="space-y-4">
            {termItems.map(it => (
              <li key={it.text} className="flex items-start gap-3 text-sm text-neutral-600 dark:text-neutral-300">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">{it.icon}</span>
                <span className="leading-relaxed">{it.text}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </section>

      <section className="space-y-10">
        <h2 className="text-4xl md:text-5xl font-black tracking-tighter dark:text-white">{k('how_title')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="p-8 rounded-[2rem] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">{s.icon}</div>
                <span className="text-3xl font-black text-neutral-200 dark:text-neutral-800">{i + 1}</span>
              </div>
              <h3 className="text-lg font-black dark:text-white">{s.title}</h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="p-10 md:p-12 rounded-[3rem] bg-indigo-900/5 border border-indigo-500/20 space-y-4">
          <h2 className="flex items-center gap-3 text-3xl font-black tracking-tighter dark:text-white"><Link2 className="w-6 h-6 text-indigo-500" />{k('panel_title')}</h2>
          <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed">{k('panel_desc')}</p>
        </div>
        <div className="p-10 md:p-12 rounded-[3rem] border border-neutral-200 dark:border-neutral-800 space-y-4">
          <h2 className="text-3xl font-black tracking-tighter dark:text-white">{k('who_title')}</h2>
          <ul className="space-y-3">
            {who.map(w => <li key={w} className="flex items-start gap-3 text-neutral-600 dark:text-neutral-300"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" /><span>{w}</span></li>)}
          </ul>
        </div>
      </section>

      <section className="space-y-8">
        <h2 className="text-4xl font-black tracking-tighter dark:text-white">{k('faq_title')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {faqs.map(f => (
            <div key={f.q} className="p-7 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 space-y-2">
              <h3 className="text-base font-black dark:text-white">{f.q}</h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-10 text-center space-y-6">
        <h2 className="text-4xl md:text-5xl font-black tracking-tighter dark:text-white">{k('cta_title')}</h2>
        <p className="text-lg text-neutral-500 dark:text-neutral-400">{k('cta_desc')}</p>
        <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-8 py-4 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-indigo-500/25 transition-all hover:bg-indigo-700">
          <MessageCircle className="w-4 h-4" />{k('cta_whatsapp')}
        </a>
      </section>
    </div>
  )
}
