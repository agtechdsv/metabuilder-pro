'use client'

import { Server, Key, Network, Cpu, ArrowRight, Terminal, FileCode2, Database, Download, Lock, Zap } from 'lucide-react'
import Link from 'next/link'
import { useI18n } from '@/i18n/I18nContext'
import { motion } from 'framer-motion'

export default function IDEFeaturePage() {
  const { t } = useI18n()

  const proFeatures = [
    {
      title: t('marketing_v2.features.ide.byoc_title', 'BYOC (Bring Your Own Code)'),
      desc: t('marketing_v2.features.ide.byoc_desc', 'Injete componentes React customizados nativamente. A IDE conta com o poderoso Monaco Editor integrado, oferecendo syntax highlighting e validações em tempo real. Codifique sem sair da plataforma.'),
      icon: <FileCode2 className="w-8 h-8 text-indigo-500" />,
      color: "from-indigo-500/20 to-blue-500/5",
      borderColor: "border-indigo-500/20"
    },
    {
      title: t('marketing_v2.features.ide.pty_title', 'Terminal PTY Integrado'),
      desc: t('marketing_v2.features.ide.pty_desc', 'Acesso total ao shell do seu sistema diretamente pela IDE. Execute comandos bash ou powershell, inicie scripts de banco de dados, gerencie dependências e orquestre containers lado a lado com seu projeto.'),
      icon: <Terminal className="w-8 h-8 text-emerald-500" />,
      color: "from-emerald-500/20 to-teal-500/5",
      borderColor: "border-emerald-500/20"
    },
    {
      title: t('marketing_v2.features.ide.sql_title', 'SQL Studio Local'),
      desc: t('marketing_v2.features.ide.sql_desc', 'Console nativo para rodar queries cruas (DDL e DML) contra a sua base de dados local com 0ms de delay de rede. Sem proxies e sem limitações impostas pela nuvem.'),
      icon: <Database className="w-8 h-8 text-blue-500" />,
      color: "from-blue-500/20 to-cyan-500/5",
      borderColor: "border-blue-500/20"
    },
    {
      title: t('marketing_v2.features.ide.eject_title', 'Ejeção de Código Fonte'),
      desc: t('marketing_v2.features.ide.eject_desc', 'Sem vendor lock-in absoluto. A qualquer momento, gere e faça download do código fonte completo (Next.js / Node.js) da sua aplicação pronta para ser executada onde você quiser.'),
      icon: <Download className="w-8 h-8 text-purple-500" />,
      color: "from-purple-500/20 to-pink-500/5",
      borderColor: "border-purple-500/20"
    }
  ]

  const extraFeatures = [
    {
      title: t('ide_landing.features.tunnel.title'),
      desc: t('ide_landing.features.tunnel.desc'),
      icon: <Network className="w-6 h-6 text-indigo-500" />
    },
    {
      title: t('ide_landing.features.config.title'),
      desc: t('ide_landing.features.config.desc'),
      icon: <Server className="w-6 h-6 text-emerald-500" />
    },
    {
      title: t('ide_landing.features.ldap.title'),
      desc: t('ide_landing.features.ldap.desc'),
      icon: <Key className="w-6 h-6 text-purple-500" />
    }
  ]

  return (
    <main className="flex-grow flex flex-col items-center relative z-10 w-full">
      {/* Background Glow */}
      <div className="absolute top-0 left-0 w-full h-[80vh] overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[20%] w-[50%] h-[50%] bg-indigo-500/20 rounded-full blur-[150px]"></div>
        <div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[150px]"></div>
      </div>

      <div className="w-full max-w-7xl mx-auto px-6 pt-32 pb-20">
        
        {/* Hero Section */}
        <div className="text-center max-w-5xl mx-auto mb-32 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-black text-xs uppercase tracking-widest mb-8 border border-indigo-500/20 shadow-sm">
            <Cpu className="w-4 h-4" />
            {t('marketing_v2.features.ide.badge', 'MetaBuilder IDE Pro')}
          </div>
          
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black mb-8 leading-[1.05] tracking-tight text-neutral-900 dark:text-white">
            {t('marketing_v2.features.ide.hero_title_part1', 'Poder de nuvem,')} <br />
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
              {t('marketing_v2.features.ide.hero_title_part2', 'liberdade local.')}
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-neutral-600 dark:text-neutral-400 max-w-3xl mx-auto mb-12 leading-relaxed font-medium">
            {t('marketing_v2.features.ide.hero_desc', 'Desenvolvida para o Pro Developer. A MetaBuilder IDE Desktop oferece um ambiente sem restrições, unindo modelagem low-code ao acesso nativo à infraestrutura da sua máquina.')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/downloads" 
              className="group relative px-10 py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm uppercase tracking-widest rounded-full shadow-2xl hover:shadow-indigo-500/40 transition-all flex items-center gap-3 overflow-hidden hover:scale-105"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
              {t('marketing_v2.features.ide.hero_cta', 'Download da IDE')}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Feature Bento Grid (Pro Developer) */}
        <div className="mb-32">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-neutral-900 dark:text-white mb-4">{t('marketing_v2.features.ide.pro_title', 'Experiência Pro Developer')}</h2>
            <p className="text-neutral-500 text-lg">{t('marketing_v2.features.ide.pro_desc', 'Controle absoluto sobre o seu código e infraestrutura.')}</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {proFeatures.map((feature, idx) => (
              <div 
                key={idx} 
                className={`group relative p-10 md:p-12 rounded-[3rem] bg-gradient-to-br ${feature.color} border ${feature.borderColor} overflow-hidden hover:scale-[1.02] transition-transform duration-500`}
              >
                <div className="relative z-10 flex flex-col h-full">
                  <div className="w-16 h-16 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-center justify-center mb-8 shadow-sm group-hover:scale-110 transition-transform duration-500">
                    {feature.icon}
                  </div>
                  <h3 className="text-2xl md:text-3xl font-black text-neutral-900 dark:text-white mb-4 leading-tight">
                    {feature.title}
                  </h3>
                  <p className="text-neutral-600 dark:text-neutral-400 text-base md:text-lg leading-relaxed font-medium mt-auto">
                    {feature.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Infra features */}
        <div className="mb-32">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-neutral-900 dark:text-white mb-4">{t('marketing_v2.features.ide.infra_title', 'Conectividade e Segurança')}</h2>
            <p className="text-neutral-500 text-lg">{t('marketing_v2.features.ide.infra_desc', 'Funcionalidades empresariais embutidas no seu ambiente de desenvolvimento.')}</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {extraFeatures.map((feature, idx) => (
              <div 
                key={idx} 
                className="bg-neutral-50/50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-8 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors duration-300 relative group"
              >
                <div className="w-12 h-12 bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-xl flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">
                  {feature.title}
                </h3>
                <p className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Product Preview Mockup */}
        <div className="w-full flex flex-col items-center">
          <div className="w-full max-w-6xl aspect-[16/10] bg-neutral-100 dark:bg-[#0d1117] border border-neutral-200 dark:border-neutral-800 rounded-[2rem] shadow-2xl relative overflow-hidden flex flex-col group">
            {/* Fake Window Header */}
            <div className="h-12 bg-white dark:bg-[#161b22] border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between px-4 shrink-0">
               <div className="flex items-center gap-2">
                 <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                 <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                 <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
               </div>
               <div className="text-[11px] font-bold text-neutral-500 tracking-wider">METABUILDER PRO IDE</div>
               <div className="w-12"></div>
            </div>
            
            {/* Fake Content area simulating Monaco + Terminal */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
               {/* Sidebar */}
               <div className="w-48 border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-black/50 hidden md:flex flex-col p-4 gap-4">
                  <div className="space-y-3">
                     <div className="h-2 w-16 bg-neutral-200 dark:bg-neutral-800 rounded"></div>
                     <div className="h-2 w-24 bg-neutral-200 dark:bg-neutral-800 rounded"></div>
                     <div className="h-2 w-20 bg-neutral-200 dark:bg-neutral-800 rounded"></div>
                  </div>
                  <div className="mt-8 space-y-3">
                     <div className="h-2 w-16 bg-neutral-200 dark:bg-neutral-800 rounded"></div>
                     <div className="h-2 w-24 bg-neutral-200 dark:bg-neutral-800 rounded"></div>
                  </div>
               </div>
               
               {/* Editor and Terminal */}
               <div className="flex-1 flex flex-col relative overflow-hidden">
                  {/* Editor */}
                  <div className="flex-1 p-6 font-mono text-[13px] leading-loose text-neutral-800 dark:text-indigo-200 opacity-90 overflow-hidden">
                     <p><span className="text-pink-500 dark:text-pink-400">import</span> { '{' } Button { '}' } <span className="text-pink-500 dark:text-pink-400">from</span> <span className="text-green-600 dark:text-green-300">'@/components/ui/button'</span>;</p>
                     <p className="mt-4"><span className="text-pink-500 dark:text-pink-400">export default function</span> <span className="text-blue-600 dark:text-blue-300">CustomActionCard</span>() { '{' }</p>
                     <p className="ml-4"><span className="text-pink-500 dark:text-pink-400">return</span> (</p>
                     <p className="ml-8">&lt;<span className="text-blue-600 dark:text-blue-300">div</span> className=<span className="text-green-600 dark:text-green-300">"p-6 bg-white dark:bg-black rounded-xl"</span>&gt;</p>
                     <p className="ml-12">&lt;<span className="text-blue-600 dark:text-blue-300">h3</span>&gt;Ação Customizada&lt;/<span className="text-blue-600 dark:text-blue-300">h3</span>&gt;</p>
                     <p className="ml-12">&lt;<span className="text-blue-600 dark:text-blue-300">Button</span> onClick=...&gt;Disparar&lt;/<span className="text-blue-600 dark:text-blue-300">Button</span>&gt;</p>
                     <p className="ml-8">&lt;/<span className="text-blue-600 dark:text-blue-300">div</span>&gt;</p>
                     <p className="ml-4">);</p>
                     <p>{ '}' }</p>
                  </div>
                  
                  {/* Terminal Panel */}
                  <div className="h-48 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black p-4 font-mono text-[12px] overflow-hidden flex flex-col relative">
                     <div className="flex items-center gap-2 mb-2 text-neutral-500 font-bold uppercase tracking-wider text-[10px]">
                       <Terminal className="w-3 h-3" /> {t('marketing_v2.features.ide.terminal_integrated', 'Terminal Integrado')}
                     </div>
                     <p className="text-neutral-500 mb-1">{t('marketing_v2.features.ide.terminal_byoc_init', 'Iniciando compilação do componente BYOC...')}</p>
                     <p className="text-neutral-800 dark:text-neutral-300">{t('marketing_v2.features.ide.terminal_swc_compile', 'Compilando dependências locais com SWC')}</p>
                     <p className="text-emerald-600 dark:text-emerald-400 mt-1">{t('marketing_v2.features.ide.terminal_build_complete', '✓ Build completada em 2.4s')}</p>
                     <div className="mt-2 flex items-center gap-2">
                       <span className="text-green-600 dark:text-green-400">C:\Projects\MetaApp&gt;</span>
                       <span className="w-2 h-4 bg-neutral-800 dark:bg-neutral-300 animate-pulse"></span>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </div>

      </div>
    </main>
  )
}
