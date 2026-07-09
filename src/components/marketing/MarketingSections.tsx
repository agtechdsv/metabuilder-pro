'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ShieldCheck, Zap, Database, Palette, Layout, Globe, Search, ArrowRight, CheckCircle2, Layers, Loader2, Activity, BarChart3, CreditCard, Users, Lightbulb, Trophy, Fingerprint, FileCode2, ScrollText, Network } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { BottomCta } from '@/components/landing/BottomCta'

export function MarketingSections() {
  const { t } = useI18n()
  const [rules, setRules] = useState<any>(null)
  const [licenses, setLicenses] = useState(1)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'quarterly' | 'semiannual' | 'yearly'>('monthly')

  useEffect(() => {
    const fetchRules = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('pricing_rules')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        if (data) {
          setRules(data)
        }
      } catch (err) {
        console.error('Error fetching pricing rules:', err)
      } finally {
        setLoading(false)
      }
    }

    const supabase = createClient()
    fetchRules()

    // Get initial session/user
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

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
      icon: <Layers className="w-6 h-6 text-pink-400" />,
      title: t('marketing_v2.navbar.use_cases'),
      desc: t('marketing_v2.features.use_cases.desc'),
      href: "/features/use-cases"
    },
    {
      icon: <ShieldCheck className="w-6 h-6 text-emerald-400" />,
      title: t('marketing_v2.navbar.zero_trust'),
      desc: t('marketing_v2.features.zero_trust.desc'),
      href: "/features/zero-trust"
    },
    {
      icon: <Activity className="w-6 h-6 text-indigo-400" />,
      title: t('marketing_v2.navbar.control_center'),
      desc: t('marketing_v2.home.control_center_desc'),
      href: "/features/control-center"
    },
    {
      icon: <Network className="w-6 h-6 text-indigo-400" />,
      title: t('marketing_v2.navbar.ide'),
      desc: t('ide_landing.hero.subtitle'),
      href: "/features/ide"
    }
  ]

  const subCards = [
    {
      icon: <BarChart3 className="w-4 h-4 text-indigo-500" />,
      title: t('marketing_v2.home.control_center_sub_bi_title'),
      desc: t('marketing_v2.home.control_center_sub_bi_desc')
    },
    {
      icon: <CreditCard className="w-4 h-4 text-emerald-500" />,
      title: t('marketing_v2.home.control_center_sub_billing_title'),
      desc: t('marketing_v2.home.control_center_sub_billing_desc')
    },
    {
      icon: <Users className="w-4 h-4 text-blue-500" />,
      title: t('marketing_v2.home.control_center_sub_community_title'),
      desc: t('marketing_v2.home.control_center_sub_community_desc')
    },
    {
      icon: <Lightbulb className="w-4 h-4 text-amber-500" />,
      title: t('marketing_v2.home.control_center_sub_metavoice_title'),
      desc: t('marketing_v2.home.control_center_sub_metavoice_desc')
    },
    {
      icon: <Trophy className="w-4 h-4 text-purple-500" />,
      title: t('marketing_v2.home.control_center_sub_iclub_title'),
      desc: t('marketing_v2.home.control_center_sub_iclub_desc')
    }
  ]

  const renderEquivalentMonthly = (value: number) => {
    const [prefix, suffix] = t('marketing_v2.home.pricing_equivalent_monthly').split('{val}')
    return (
      <>
        {prefix}
        <span className="text-indigo-650 dark:text-indigo-400">
          R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        {suffix}
      </>
    )
  }

  const renderEquivalentLicense = (value: number) => {
    const [prefix, suffix] = t('marketing_v2.home.pricing_equivalent_license').split('{val}')
    return (
      <>
        {prefix}
        <span className="text-indigo-650 dark:text-indigo-400">
          R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        {suffix}
      </>
    )
  }

  return (
    <div className="w-full space-y-32 py-20 px-6">

      {/* Feature Bento Grid */}
      <section className="max-w-7xl mx-auto">
        <div className="max-w-4xl mx-auto text-center mb-20 space-y-4">
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-black dark:text-white leading-[1.1]">
            {t('marketing_v2.home.bento_title')} <br />
            <span className="text-indigo-600">{t('marketing_v2.home.bento_highlight')}</span>
          </h2>
          <p className="text-xl text-neutral-500 dark:text-neutral-400 font-medium">
            {t('marketing_v2.home.bento_desc')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {features.slice(0, 5).map((feature, i) => (
            <Link key={i} href={feature.href} className="group p-8 rounded-[2.5rem] bg-neutral-100/50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 hover:border-indigo-500/50 transition-all duration-500 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-neutral-950 flex items-center justify-center mb-6 shadow-inner border border-neutral-200 dark:border-neutral-800 group-hover:scale-110 transition-transform duration-500">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold dark:text-white mb-3">{feature.title}</h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">{feature.desc}</p>
              </div>
              <div className="mt-8 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                {t('marketing_v2.home.learn_more')} <ArrowRight className="w-3 h-3" />
              </div>
            </Link>
          ))}

          {/* Stretched Control Center Card */}
          <div className="col-span-1 md:col-span-2 lg:col-span-5 group p-8 rounded-[2.5rem] bg-neutral-100/50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 hover:border-indigo-500/50 transition-all duration-500">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-neutral-200/50 dark:border-neutral-800/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-neutral-950 flex items-center justify-center shadow-inner border border-neutral-200 dark:border-neutral-800 group-hover:scale-110 transition-transform duration-500">
                  {features[5].icon}
                </div>
                <div>
                  <h3 className="text-xl font-bold dark:text-white">{features[5].title}</h3>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-3xl leading-relaxed mt-1">{features[5].desc}</p>
                </div>
              </div>
              <Link href={features[5].href} className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all hover:scale-102 shadow-md shadow-indigo-600/20 dark:shadow-indigo-500/10 shrink-0 self-start lg:self-center">
                {t('marketing_v2.home.control_center_cta_sim')} <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* 5 Sub-cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-6">
              {subCards.map((card, i) => (
                <div key={i} className="p-5 rounded-2xl bg-white/40 dark:bg-neutral-950/30 border border-neutral-200/50 dark:border-neutral-800/40 hover:bg-white/80 dark:hover:bg-neutral-950/60 transition-all duration-300 flex flex-col justify-between group/sub shadow-sm hover:shadow-md">
                  <div>
                    <div className="w-8 h-8 rounded-xl bg-white dark:bg-neutral-900 flex items-center justify-center mb-4 border border-neutral-100 dark:border-neutral-800 group-hover/sub:scale-110 transition-transform duration-300 shadow-inner">
                      {card.icon}
                    </div>
                    <h4 className="text-sm font-bold dark:text-white mb-2">{card.title}</h4>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">{card.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* New IDE Native Card */}
          <div className="col-span-1 md:col-span-2 lg:col-span-5 group p-8 rounded-[2.5rem] bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-200/50 dark:border-indigo-800/50 hover:border-indigo-500/50 transition-all duration-500 mt-2">
             <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                   <div className="w-14 h-14 rounded-2xl bg-white dark:bg-neutral-950 flex items-center justify-center shadow-inner border border-indigo-200 dark:border-indigo-800 group-hover:scale-110 transition-transform duration-500">
                      <Network className="w-7 h-7 text-indigo-500" />
                   </div>
                   <div>
                      <h3 className="text-2xl font-black dark:text-white mb-1">{t('marketing_v2.navbar.ide')}</h3>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-3xl leading-relaxed">
                         {t('ide_landing.hero.subtitle')}
                      </p>
                   </div>
                </div>
                <Link href="/features/ide" className="inline-flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all hover:scale-102 shadow-lg shadow-indigo-600/20 shrink-0 self-start lg:self-center">
                   {t('marketing_v2.home.learn_more')} <ArrowRight className="w-4 h-4" />
                </Link>
             </div>
          </div>

          {/* New MFA/Passkey, Source Code and Logs Cards */}
          <div className="col-span-1 md:col-span-2 lg:col-span-5 grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">
             <Link href="/features/security" className="group p-8 rounded-[2.5rem] bg-neutral-100/50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 hover:border-indigo-500/50 transition-all duration-500 flex flex-col md:flex-row items-start gap-6">
                <div className="w-14 h-14 rounded-2xl bg-white dark:bg-neutral-950 flex items-center justify-center shrink-0 shadow-inner border border-neutral-200 dark:border-neutral-800 group-hover:scale-110 transition-transform duration-500">
                   <Fingerprint className="w-7 h-7 text-indigo-500" />
                </div>
                <div>
                   <h3 className="text-xl font-bold dark:text-white mb-2">{t('marketing_v2.navbar.security')}</h3>
                   <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed mb-4">
                      {t('marketing_v2.features.security.next_gen_desc')}
                   </p>
                   <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      {t('marketing_v2.home.learn_more')} <ArrowRight className="w-3 h-3" />
                   </div>
                </div>
             </Link>
             
             <Link href="/features/source-code" className="group p-8 rounded-[2.5rem] bg-neutral-100/50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 hover:border-blue-500/50 transition-all duration-500 flex flex-col md:flex-row items-start gap-6">
                <div className="w-14 h-14 rounded-2xl bg-white dark:bg-neutral-950 flex items-center justify-center shrink-0 shadow-inner border border-neutral-200 dark:border-neutral-800 group-hover:scale-110 transition-transform duration-500">
                   <FileCode2 className="w-7 h-7 text-blue-500" />
                </div>
                <div>
                   <h3 className="text-xl font-bold dark:text-white mb-2">{t('marketing_v2.navbar.source_code')}</h3>
                   <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed mb-4">
                      {t('marketing_v2.features.source_code.hero_desc')}
                   </p>
                   <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      {t('marketing_v2.home.learn_more')} <ArrowRight className="w-3 h-3" />
                   </div>
                </div>
             </Link>

             <Link href="/features/logs" className="group p-8 rounded-[2.5rem] bg-neutral-100/50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 hover:border-emerald-500/50 transition-all duration-500 flex flex-col md:flex-row items-start gap-6">
                <div className="w-14 h-14 rounded-2xl bg-white dark:bg-neutral-950 flex items-center justify-center shrink-0 shadow-inner border border-neutral-200 dark:border-neutral-800 group-hover:scale-110 transition-transform duration-500">
                   <ScrollText className="w-7 h-7 text-emerald-500" />
                </div>
                <div>
                   <h3 className="text-xl font-bold dark:text-white mb-2">{t('marketing_v2.navbar.logs') || 'Auditoria & Logs'}</h3>
                   <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed mb-4">
                      {t('marketing_v2.features.logs.hero_desc') || 'Monitore o tráfego do túnel local em tempo real, execuções de processos BPM e mutações SQL de forma ultra rápida.'}
                   </p>
                   <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      {t('marketing_v2.home.learn_more')} <ArrowRight className="w-3 h-3" />
                   </div>
                </div>
             </Link>
          </div>
        </div>
      </section>

      {/* Legacy Bridge Showcase */}
      <section className="bg-blue-600 rounded-[3rem] p-12 md:p-20 text-white relative overflow-hidden group">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter leading-[1]">
              {t('marketing_v2.home.bridge_title')} <br />
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
              {t('marketing_v2.home.zero_trust_title')} <br />
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
      {/* Central de Controle Showcase */}
      <section className="max-w-7xl mx-auto py-20 border-y border-neutral-100 dark:border-neutral-900">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div className="space-y-8 order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest">
              <Activity className="w-3.5 h-3.5" />
              {t('marketing_v2.home.control_center_badge')}
            </div>
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter dark:text-white leading-[1]">
              {t('marketing_v2.home.control_center_title')} <br />
              <span className="text-indigo-600">{t('marketing_v2.home.control_center_highlight')}</span>
            </h2>
            <p className="text-xl text-neutral-500 dark:text-neutral-400 leading-relaxed">
              {t('marketing_v2.home.control_center_desc_long')}
            </p>
            <div className="flex gap-4">
              <div className="flex-1 p-6 rounded-3xl bg-neutral-100 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800">
                <h4 className="text-2xl font-black text-indigo-600 mb-2">4</h4>
                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{t('marketing_v2.home.control_center_stat1')}</p>
              </div>
              <div className="flex-1 p-6 rounded-3xl bg-neutral-100 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800">
                <h4 className="text-2xl font-black text-emerald-600 mb-2">100%</h4>
                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{t('marketing_v2.home.control_center_stat2')}</p>
              </div>
            </div>
            <Link
              href="/features/control-center"
              className="inline-flex items-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all hover:scale-105 shadow-xl shadow-indigo-500/20"
            >
              {t('marketing_v2.home.control_center_cta')}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Mini mockup panel */}
          <div className="order-1 lg:order-2 relative">
            <div className="p-6 rounded-[3rem] bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 shadow-2xl relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl z-10">
                <Activity className="w-10 h-10" />
              </div>

              {/* Window chrome */}
              <div className="flex gap-1.5 mb-4">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-green-400"></div>
              </div>

              {/* Tabs strip */}
              <div className="flex gap-1 mb-5 p-1 bg-neutral-100 dark:bg-neutral-900 rounded-xl text-[9px] font-black uppercase tracking-wider overflow-x-auto">
                {[
                  { key: 'Dashboard BI', label: t('marketing_v2.home.control_center_tab_bi') },
                  { key: 'Produtividade', label: t('marketing_v2.home.control_center_tab_prod') },
                  { key: 'Assinatura', label: t('marketing_v2.home.control_center_tab_sub') },
                  { key: 'Cancelamento', label: t('marketing_v2.home.control_center_tab_cancel') },
                  { key: 'iClub', label: t('marketing_v2.home.control_center_tab_iclub') }
                ].map((tab, i) => (
                  <span
                    key={tab.key}
                    className={`px-3 py-1.5 rounded-lg transition-all ${i === 0
                      ? 'bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-neutral-400'
                      }`}
                  >
                    {tab.label}
                  </span>
                ))}
              </div>

              {/* Metric cards */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: t('marketing_v2.home.control_center_metric_licenses'), value: '2 / 3', color: 'text-emerald-500' },
                  { label: t('marketing_v2.home.control_center_metric_workspaces'), value: '1', color: 'text-indigo-500' },
                  { label: t('marketing_v2.home.control_center_metric_projects'), value: '1', color: 'text-amber-500' },
                  { label: t('marketing_v2.home.control_center_metric_use_cases'), value: '3', color: 'text-purple-500' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="p-3 bg-neutral-50 dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-neutral-800 text-center">
                    <p className={`text-lg font-black leading-none ${color}`}>{value}</p>
                    <p className="text-[8px] font-bold text-neutral-400 mt-1 uppercase tracking-wider">{label}</p>
                  </div>
                ))}
              </div>

              {/* Mini bar chart */}
              <div className="p-3 bg-neutral-50 dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-neutral-800">
                <p className="text-[8px] font-black uppercase text-neutral-400 tracking-wider mb-2">{t('marketing_v2.home.control_center_chart_title')}</p>
                <div className="flex items-end gap-1 h-10">
                  {[40, 65, 30, 80, 55, 90, 45].map((h, i) => (
                    <div
                      key={i}
                      style={{ height: `${h}%` }}
                      className={`flex-1 rounded-t-sm ${i === 5 ? 'bg-indigo-500' : 'bg-indigo-200 dark:bg-indigo-900'
                        }`}
                    />
                  ))}
                </div>
              </div>

              {/* Footer status */}
              <div className="mt-4 flex items-center justify-center gap-2 text-[9px] text-neutral-400 font-bold">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                {t('marketing_v2.home.control_center_footer_status')}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sync Resolution Showcase */}
      <section className="max-w-7xl mx-auto py-20 border-t border-neutral-100 dark:border-neutral-900">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div className="space-y-8 order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-[10px] font-black uppercase tracking-widest">
              <Database className="w-3.5 h-3.5" />
              {t('marketing_v2.home.sync_resolution_badge')}
            </div>
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter dark:text-white leading-[1]">
              {t('marketing_v2.home.sync_title')} <br />
              <span className="text-cyan-600">{t('marketing_v2.home.sync_highlight')}</span>
            </h2>
            <p className="text-xl text-neutral-500 dark:text-neutral-400 leading-relaxed">
              {t('marketing_v2.home.sync_desc')}
            </p>
            <div className="flex gap-4">
              <div className="flex-1 p-6 rounded-3xl bg-neutral-100 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800">
                <h4 className="text-2xl font-black text-cyan-600 mb-2">100%</h4>
                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{t('marketing_v2.home.sync_stat_failproof')}</p>
              </div>
              <div className="flex-1 p-6 rounded-3xl bg-neutral-100 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800">
                <h4 className="text-2xl font-black text-indigo-600 mb-2">0</h4>
                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{t('marketing_v2.home.sync_stat_refactoring')}</p>
              </div>
            </div>
            <Link
              href="/features/sync-resolution"
              className="inline-flex items-center gap-2 px-8 py-4 bg-cyan-600 hover:bg-cyan-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all hover:scale-105 shadow-xl shadow-cyan-500/20"
            >
              {t('marketing_v2.home.sync_cta')}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="relative order-1 lg:order-2">
            <div className="p-2 rounded-[2rem] bg-gradient-to-br from-cyan-500/20 to-blue-500/10 dark:from-cyan-900/40 dark:to-blue-900/20 shadow-2xl relative overflow-hidden">
                <img src="/sync-resolution-demo.png" alt={t('marketing_v2.home.sync_resolution_badge')} className="w-full h-auto rounded-[1.5rem] border border-cyan-500/20 shadow-inner" />
            </div>
          </div>
        </div>
      </section>

      {/* BPM & Automations Showcase */}
      <section className="max-w-7xl mx-auto py-20 border-b border-neutral-100 dark:border-neutral-900">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          
          <div className="relative order-1 lg:order-1">
            <div className="p-8 rounded-[3rem] bg-gradient-to-br from-emerald-500/10 to-teal-500/5 dark:from-emerald-900/20 dark:to-teal-900/10 border border-emerald-500/20 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-20">
                <svg className="w-32 h-32 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>

              <div className="space-y-6 relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-xl shadow-emerald-500/30">
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                </div>
                
                <div className="space-y-3">
                  <div className="h-2 w-1/3 bg-emerald-500/20 rounded-full"></div>
                  <div className="h-2 w-2/3 bg-neutral-200 dark:bg-neutral-800 rounded-full"></div>
                  <div className="h-2 w-1/2 bg-neutral-200 dark:bg-neutral-800 rounded-full"></div>
                </div>

                <div className="pt-6 border-t border-emerald-500/20">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white shadow-lg z-10">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
                    </div>
                    <div className="flex-1 h-px bg-gradient-to-r from-emerald-500/50 to-transparent"></div>
                    <div className="px-4 py-2 bg-white dark:bg-neutral-900 rounded-xl text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-sm">
                      Two-Way Sync
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8 order-2 lg:order-2">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              {t('marketing_v2.home.bpm_badge')}
            </div>
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter dark:text-white leading-[1]">
              {t('marketing_v2.home.bpm_title')} <br />
              <span className="text-emerald-600">{t('marketing_v2.home.bpm_highlight')}</span>
            </h2>
            <p className="text-xl text-neutral-500 dark:text-neutral-400 leading-relaxed">
              {t('marketing_v2.home.bpm_desc')}
            </p>
            <div className="flex gap-4">
              <div className="flex-1 p-6 rounded-3xl bg-neutral-100 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800">
                <h4 className="text-2xl font-black text-emerald-600 mb-2">100%</h4>
                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{t('marketing_v2.home.bpm_stat_visual')}</p>
              </div>
              <div className="flex-1 p-6 rounded-3xl bg-neutral-100 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800">
                <h4 className="text-2xl font-black text-indigo-600 mb-2">API</h4>
                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{t('marketing_v2.home.bpm_stat_events')}</p>
              </div>
            </div>
            <Link
              href="/features/bpm"
              className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all hover:scale-105 shadow-xl shadow-emerald-500/20"
            >
              {t('marketing_v2.home.bpm_cta')}
              <ArrowRight className="w-4 h-4" />
            </Link>
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

        <div className="group relative p-12 rounded-[2.5rem] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-6 overflow-hidden hover:border-indigo-500/50 transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1">
          {/* Subtle animated background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
          
          <div className="relative z-10 flex items-start justify-between">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-xl shadow-indigo-500/30 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
              <Globe className="w-7 h-7" />
            </div>
            <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[9px] font-black uppercase tracking-widest rounded-full shadow-sm animate-pulse">
              Novo Recurso Premium
            </span>
          </div>
          
          <div className="relative z-10 space-y-4">
            <h3 className="text-3xl font-black dark:text-white tracking-tight">{t('marketing_v2.home.whitelabel_title')}</h3>
            
            {/* Mockup URL Bar */}
            <div className="inline-flex items-center gap-2 px-3 py-2 bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs font-mono text-neutral-500 dark:text-neutral-400 shadow-inner group-hover:border-indigo-500/30 transition-colors">
              <Globe className="w-3.5 h-3.5 text-neutral-400" />
              <span>https://app.</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-bold -mx-1">suaempresa</span>
              <span>.com</span>
            </div>
          </div>

          <p className="relative z-10 text-neutral-500 dark:text-neutral-400 leading-relaxed pt-2">
            {t('marketing_v2.home.whitelabel_desc')}
          </p>
        </div>
      </section>

      {/* Dynamic Pricing Section */}
      <section id="pricing" className="max-w-7xl mx-auto py-12 scroll-mt-24">
        <div className="max-w-4xl mx-auto text-center mb-10 space-y-4">
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-black dark:text-white leading-[1.1]">
            {t('marketing_v2.home.pricing_title')} <br />
            <span className="text-indigo-600">{t('marketing_v2.home.pricing_highlight')}</span>
          </h2>
          <p className="text-xl text-neutral-500 dark:text-neutral-400 font-medium">
            {t('marketing_v2.home.pricing_subtitle')}
          </p>
        </div>

        {/* Billing Cycle Selector */}
        <div className="flex justify-center mb-12">
          <div className="bg-neutral-100/80 dark:bg-neutral-900/60 backdrop-blur-md border border-neutral-200/50 dark:border-neutral-800/40 p-1.5 rounded-2xl flex items-center gap-1.5 w-full max-w-lg relative z-20 shadow-inner">
            {(['monthly', 'quarterly', 'semiannual', 'yearly'] as const).map((c) => {
              const isSelected = billingCycle === c
              const labels = {
                monthly: t('marketing_v2.home.pricing_cycle_monthly'),
                quarterly: t('marketing_v2.home.pricing_cycle_quarterly'),
                semiannual: t('marketing_v2.home.pricing_cycle_semiannual'),
                yearly: t('marketing_v2.home.pricing_cycle_yearly')
              }
              const discountPercentage = {
                monthly: rules?.cycle_discounts?.monthly ? `-${rules.cycle_discounts.monthly}%` : '',
                quarterly: rules?.cycle_discounts?.quarterly ? `-${rules.cycle_discounts.quarterly}%` : '',
                semiannual: rules?.cycle_discounts?.semiannual ? `-${rules.cycle_discounts.semiannual}%` : '',
                yearly: rules?.cycle_discounts?.yearly ? `-${rules.cycle_discounts.yearly}%` : ''
              }

              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setBillingCycle(c)}
                  className="relative flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider flex flex-col items-center justify-center transition-all select-none z-10 outline-none"
                >
                  {isSelected && (
                    <motion.div
                      layoutId="activeMarketingCycleBg"
                      className="absolute inset-0 bg-white dark:bg-neutral-950 rounded-xl shadow-md border border-neutral-250/20 dark:border-neutral-800/30 z-0"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className={`relative z-10 font-extrabold transition-colors ${isSelected
                    ? 'text-indigo-650 dark:text-indigo-400'
                    : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white'
                    }`}>
                    {labels[c]}
                  </span>
                  {discountPercentage[c] && (
                    <span className="relative z-10 text-[8px] font-bold text-emerald-500 mt-0.5">
                      {discountPercentage[c]}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          </div>
        ) : !rules ? (
          <div className="text-center py-12 text-neutral-500">
            {t('marketing_v2.home.pricing_loading')}
          </div>
        ) : (
          <div className="max-w-4xl mx-auto bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] p-8 md:p-12 shadow-2xl flex flex-col md:flex-row gap-12">
            
            {/* Left side: Calculator */}
            <div className="flex-1 space-y-8">
              <div>
                <h3 className="text-2xl font-black text-neutral-900 dark:text-white mb-2">{t('marketing_v2.home.pricing_calc_title')}</h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('marketing_v2.home.pricing_calc_subtitle')}</p>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-neutral-700 dark:text-neutral-300">{t('marketing_v2.home.pricing_licenses')}</span>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setLicenses(Math.max(1, licenses - 1))}
                      className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200"
                    >
                      -
                    </button>
                    <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 w-12 text-center">{licenses}</span>
                    <button 
                      onClick={() => setLicenses(licenses + 1)}
                      className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200"
                    >
                      +
                    </button>
                  </div>
                </div>

                <input
                  type="range"
                  min="1"
                  max="100"
                  value={licenses}
                  onChange={(e) => setLicenses(Number(e.target.value))}
                  className="w-full h-2 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                
                {/* Volume Tiers Helper */}
                <div className="flex gap-2 flex-wrap mt-4">
                  {rules.volume_tiers?.sort((a: any, b: any) => a.min_licenses - b.min_licenses).map((tier: any, i: number) => {
                    const isActive = licenses >= tier.min_licenses;
                    return (
                      <div key={i} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-wider transition-colors ${
                        isActive 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                          : 'bg-neutral-100 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400'
                      }`}>
                        <span>≥ {tier.min_licenses}</span>
                        <span className={`px-1.5 py-0.5 rounded-md ${isActive ? 'bg-emerald-500/20' : 'bg-neutral-200 dark:bg-neutral-800'}`}>-{tier.discount_percent}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="pt-6 border-t border-neutral-100 dark:border-neutral-800">
                <ul className="space-y-3">
                  <li className="flex items-start gap-3 text-sm text-neutral-600 dark:text-neutral-400">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{t('marketing_v2.home.pricing_feat_pro')}</span>
                  </li>
                  <li className="flex items-start gap-3 text-sm text-neutral-600 dark:text-neutral-400">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{t('marketing_v2.home.pricing_feat_unlimited')}</span>
                  </li>
                  <li className="flex items-start gap-3 text-sm text-neutral-600 dark:text-neutral-400">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{t('marketing_v2.home.pricing_feat_support')}</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Right side: Summary */}
            <div className="flex-1 bg-neutral-50 dark:bg-neutral-950 p-8 rounded-3xl border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between">
              {(() => {
                const base = Number(rules.base_price) || 450
                let volDiscount = 0
                if (rules.volume_tiers && rules.volume_tiers.length > 0) {
                  const sorted = [...rules.volume_tiers].sort((a, b) => b.min_licenses - a.min_licenses)
                  const tier = sorted.find(t => licenses >= t.min_licenses)
                  if (tier) volDiscount = tier.discount_percent
                }
                
                const unitPrice = base * (1 - volDiscount / 100)
                
                let months = 1
                if (billingCycle === 'quarterly') months = 3
                if (billingCycle === 'semiannual') months = 6
                if (billingCycle === 'yearly') months = 12

                let cycleDiscount = 0
                if (rules.cycle_discounts) {
                  cycleDiscount = rules.cycle_discounts[billingCycle] || 0
                }

                const totalValue = (unitPrice * licenses * months) * (1 - cycleDiscount / 100)
                const monthlyEq = totalValue / months

                return (
                  <>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-sm font-bold text-neutral-500">
                        <span>{t('marketing_v2.home.pricing_base_price')}</span>
                        <span>R$ {base.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      
                      {volDiscount > 0 && (
                        <div className="flex justify-between items-center text-sm font-bold text-emerald-500">
                          <span>{t('marketing_v2.home.pricing_volume_discount')}</span>
                          <span>-{volDiscount}%</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between items-center text-sm font-bold text-neutral-500">
                        <span>{t('marketing_v2.home.pricing_final_price')}</span>
                        <span>R$ {unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>

                      {cycleDiscount > 0 && (
                        <div className="flex justify-between items-center text-sm font-bold text-emerald-500">
                          <span>{t('marketing_v2.home.pricing_cycle_discount').replace('{count}', String(months))}</span>
                          <span>-{cycleDiscount}%</span>
                        </div>
                      )}
                      
                      <div className="border-t border-neutral-200 dark:border-neutral-800 pt-4 mt-4">
                        <span className="block text-[10px] font-black uppercase text-neutral-400 mb-1">{t('marketing_v2.home.pricing_total')}</span>
                        {licenses >= 100 ? (
                          <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
                            {t('marketing_v2.home.pricing_custom')}
                          </div>
                        ) : (
                          <>
                            <div className="flex items-baseline gap-1">
                              <span className="text-4xl font-black text-indigo-600 dark:text-indigo-400">
                                R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              <span className="text-xs font-bold text-neutral-400">
                                {billingCycle === 'monthly'
                                  ? t('marketing_v2.home.pricing_per_month')
                                  : t('marketing_v2.home.pricing_per_months').replace('{count}', String(months))}
                              </span>
                            </div>
                            
                            {billingCycle !== 'monthly' ? (
                              <div className="text-[11px] font-bold text-neutral-500 mt-2 flex flex-col gap-0.5">
                                <span>{renderEquivalentMonthly(monthlyEq)}</span>
                                <span>{renderEquivalentLicense(monthlyEq / licenses)}</span>
                              </div>
                            ) : (
                              licenses > 1 && (
                                <div className="text-[11px] font-bold text-neutral-550 mt-2">
                                  {renderEquivalentLicense(totalValue / licenses)}
                                </div>
                              )
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {licenses >= 100 ? (
                      <Link
                        href="https://wa.me/5511999999999?text=Ol%C3%A1%2C%20tenho%20interesse%20em%20um%20plano%20Enterprise%20do%20MetaBuilder%20Pro"
                        target="_blank"
                        className="mt-8 w-full block py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-center font-black text-xs uppercase tracking-widest transition-all hover:scale-102 shadow-xl shadow-indigo-500/20"
                      >
                        {t('marketing_v2.home.pricing_btn_consultant')}
                      </Link>
                    ) : (
                      <Link
                        href={`/checkout?licenses=${licenses}&cycle=${billingCycle}`}
                        onClick={(e) => {
                          if (!user) {
                            e.preventDefault()
                            window.dispatchEvent(new CustomEvent('open-auth-modal', {
                              detail: { redirectTo: `/checkout?licenses=${licenses}&cycle=${billingCycle}` }
                            }))
                          }
                        }}
                        className="mt-8 w-full block py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-center font-black text-xs uppercase tracking-widest transition-all hover:scale-102 shadow-xl shadow-indigo-500/20"
                      >
                        {t('marketing_v2.home.pricing_btn_checkout')}
                      </Link>
                    )}
                  </>
                )
              })()}
            </div>
          </div>
        )}
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
        <BottomCta />
      </section>

    </div>
  )
}
