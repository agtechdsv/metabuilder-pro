'use client'

import { motion } from 'framer-motion'
import { Monitor, Cpu, ShieldCheck, ArrowLeft, Download, RefreshCw, LayoutGrid, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { BottomCta } from '@/components/landing/BottomCta'
import { useI18n } from '@/i18n/I18nContext'

export default function DesktopFeaturePage() {
  const { t } = useI18n()

  const pillars = [
    {
      icon: <Cpu className="w-6 h-6 text-indigo-500" />,
      title: t('desktop_landing.pillars.tauri.title', 'Compilação Rust & Tauri'),
      desc: t('desktop_landing.pillars.tauri.desc', 'Gere executáveis leves, velozes e seguros. O motor de compilação embutido no MetaBuilder PRO gera instaladores MSI nativos para Windows em poucos minutos.')
    },
    {
      icon: <ShieldCheck className="w-6 h-6 text-emerald-500" />,
      title: t('desktop_landing.pillars.tunnel.title', 'Túnel Local Integrado (Zero-Trust)'),
      desc: t('desktop_landing.pillars.tunnel.desc', 'Acesse e sincronize dados locais da infraestrutura do cliente sem precisar abrir portas de firewall ou IPs públicos. Conexão criptografada de ponta a ponta.')
    },
    {
      icon: <LayoutGrid className="w-6 h-6 text-purple-500" />,
      title: t('desktop_landing.pillars.whitelabel.title', 'Personalização White-Label'),
      desc: t('desktop_landing.pillars.whitelabel.desc', 'Modifique o nome do app, descrição, ícone e cores para refletir a marca do seu cliente. Entregue um software próprio de alta fidelidade sem menção ao MetaBuilder.')
    },
    {
      icon: <Download className="w-6 h-6 text-cyan-500" />,
      title: t('desktop_landing.pillars.downloads.title', 'Central de Downloads Ativa'),
      desc: t('desktop_landing.pillars.downloads.desc', 'Disponibilize o arquivo de instalação automaticamente na Central de Downloads. Seus clientes podem baixar, gerenciar versões e rodar instaladores com um clique.')
    }
  ]

  return (
    <div className="max-w-7xl mx-auto px-6 py-20 space-y-24">
      <Link href="/" className="inline-flex items-center gap-2 text-neutral-500 hover:text-indigo-600 transition-colors mb-8 group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        {t('common.back_to_home', 'Voltar para Home')}
      </Link>

      {/* Hero Section */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
        <div className="space-y-8">
          <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 border border-indigo-400/20">
            <Monitor className="w-8 h-8" />
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter dark:text-white leading-[1]">
            {t('desktop_landing.hero.title_part1', 'Compilador Desktop.')} <br/>
            <span className="text-indigo-600 dark:text-indigo-400">{t('desktop_landing.hero.title_part2', 'Nativo & White-Label')}</span>
          </h1>
          <p className="text-xl text-neutral-500 dark:text-neutral-400 leading-relaxed">
            {t('desktop_landing.hero.desc', 'Transforme seu projeto ou o portal de aplicações do seu Workspace em um aplicativo instalável do Windows (.msi) totalmente customizado para o seu cliente final.')}
          </p>
        </div>
        
        {/* Animated Compilation Box */}
        <div className="relative">
          <div className="absolute inset-0 bg-indigo-500/10 blur-3xl rounded-full"></div>
          <div className="relative p-8 rounded-[3rem] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-6">
             <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-4">
               <span className="font-bold text-sm dark:text-white">{t('desktop_landing.compilation.status', 'Painel de Compilação')}</span>
               <span className="text-xs text-indigo-500 font-black uppercase flex items-center gap-1.5 animate-pulse">
                 <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                 {t('desktop_landing.compilation.running', 'Compilando')}
               </span>
             </div>
             
             <div className="space-y-4">
               {/* Step 1 */}
               <div className="flex items-start gap-3 p-3 rounded-2xl bg-neutral-50 dark:bg-black/40 border border-neutral-100 dark:border-neutral-800/60">
                 <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                 <div>
                   <h4 className="text-xs font-bold dark:text-white">{t('desktop_landing.compilation.step1_title', '1. Customização White-Label')}</h4>
                   <p className="text-[10px] text-neutral-400">{t('desktop_landing.compilation.step1_desc', 'Nome do software, descrição e ícone de 512x512 aplicados com sucesso.')}</p>
                 </div>
               </div>

               {/* Step 2 */}
               <div className="flex items-start gap-3 p-3 rounded-2xl bg-neutral-50 dark:bg-black/40 border border-neutral-100 dark:border-neutral-800/60">
                 <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                 <div>
                   <h4 className="text-xs font-bold dark:text-white">{t('desktop_landing.compilation.step2_title', '2. Configuração de Túnel Seguro')}</h4>
                   <p className="text-[10px] text-neutral-400">{t('desktop_landing.compilation.step2_desc', 'Credenciais e túnel do projeto embutidos de forma nativa e segura.')}</p>
                 </div>
               </div>

               {/* Step 3 */}
               <div className="flex items-start gap-3 p-3 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40">
                 <RefreshCw className="w-5 h-5 text-indigo-500 animate-spin shrink-0 mt-0.5" />
                 <div>
                   <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{t('desktop_landing.compilation.step3_title', '3. Geração do MSI (Rust/Tauri)')}</h4>
                   <p className="text-[10px] text-indigo-500/80">{t('desktop_landing.compilation.step3_desc', 'Compilando os binários nativos de alto desempenho no GitHub Actions...')}</p>
                 </div>
               </div>
             </div>
          </div>
        </div>
      </section>

      {/* Pillars Section */}
      <section className="space-y-16">
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <h2 className="text-3xl md:text-5xl font-black tracking-tight dark:text-white">
            {t('desktop_landing.pillars.title', 'Tudo o que você precisa')}
          </h2>
          <p className="text-neutral-500 dark:text-neutral-400">
            {t('desktop_landing.pillars.desc', 'Esqueça scripts complexos ou compilações demoradas na sua máquina local.')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {pillars.map((pillar, idx) => (
            <div 
              key={idx} 
              className="p-8 rounded-[2rem] bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-100 dark:border-neutral-800 hover:scale-[1.01] hover:shadow-xl transition-all duration-300 flex gap-6"
            >
              <div className="w-12 h-12 rounded-2xl bg-white dark:bg-black flex items-center justify-center shrink-0 border border-neutral-100 dark:border-neutral-800 shadow-sm">
                {pillar.icon}
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold dark:text-white">{pillar.title}</h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">{pillar.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <BottomCta />
    </div>
  )
}
