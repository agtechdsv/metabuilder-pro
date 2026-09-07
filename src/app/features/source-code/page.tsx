'use client'

import { ArrowLeft, Download, Code2, FileCode2, Layers, Cpu, CheckCircle2, Server, Sparkles, ArrowRight, Zap } from 'lucide-react'
import Link from 'next/link'
import { BottomCta } from '@/components/landing/BottomCta'
import { useI18n } from '@/i18n/I18nContext'

export default function SourceCodeFeaturePage() {
  const { t } = useI18n()

  return (
    <div className="max-w-7xl mx-auto px-6 py-20 space-y-24">
      <Link href="/" className="inline-flex items-center gap-2 text-neutral-500 hover:text-indigo-600 transition-colors mb-8 group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        {t('common.back_to_home')}
      </Link>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
        <div className="space-y-8">
          <div className="w-16 h-16 rounded-3xl bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-400/20">
            <Download className="w-8 h-8" />
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter dark:text-white leading-[1]">
            {t('marketing_v2.features.source_code.hero_title')} <br/>
            <span className="text-blue-500">{t('marketing_v2.features.source_code.hero_title_highlight')}</span>
          </h1>
          <p className="text-xl text-neutral-500 dark:text-neutral-400 leading-relaxed">
            {t('marketing_v2.features.source_code.hero_desc')}
          </p>
        </div>
        
        <div className="relative">
           <div className="absolute inset-0 bg-blue-500/10 blur-[120px] rounded-full"></div>
           <div className="relative p-12 rounded-[4rem] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-3xl text-center space-y-8">
              <div className="inline-block p-6 rounded-full bg-blue-500 text-white shadow-2xl shadow-blue-500/20">
                 <FileCode2 className="w-12 h-12" />
              </div>
              <div className="space-y-2">
                 <h3 className="text-2xl font-black dark:text-white">{t('marketing_v2.features.source_code.tech_title')}</h3>
                 <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('marketing_v2.features.source_code.tech_desc')}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800 flex items-center gap-3">
                    <Code2 className="w-4 h-4 text-blue-500" />
                    <span className="text-[10px] font-black uppercase dark:text-white">{t('marketing_v2.features.source_code.tag_clean_code')}</span>
                 </div>
                 <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800 flex items-center gap-3">
                    <Layers className="w-4 h-4 text-blue-500" />
                    <span className="text-[10px] font-black uppercase dark:text-white">{t('marketing_v2.features.source_code.tag_hexagonal')}</span>
                 </div>
              </div>
           </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="space-y-6">
           <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
              <Code2 className="w-6 h-6" />
           </div>
           <h3 className="text-2xl font-black dark:text-white tracking-tight">{t('marketing_v2.features.source_code.block1_title')}</h3>
           <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed">
             {t('marketing_v2.features.source_code.block1_desc')}
           </p>
        </div>
        <div className="space-y-6">
           <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
              <Cpu className="w-6 h-6" />
           </div>
           <h3 className="text-2xl font-black dark:text-white tracking-tight">{t('marketing_v2.features.source_code.block2_title')}</h3>
           <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed">
             {t('marketing_v2.features.source_code.block2_desc')}
           </p>
        </div>
      </section>

      {/* SEÇÃO MULTI-STACK BACKEND NO EJECT */}
      <section className="space-y-12">
        <div className="text-center max-w-4xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold text-xs uppercase tracking-widest border border-amber-500/20 shadow-sm">
            <Download className="w-4 h-4 text-amber-500" />
            <span>Eject & Sync Multi-Stack</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black tracking-wider ml-1">
              NOVO
            </span>
          </div>

          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-neutral-900 dark:text-white leading-[1.1]">
            Você escolhe a stack de backend. <br />
            <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-500 dark:from-amber-400 dark:via-orange-400 dark:to-emerald-400 bg-clip-text text-transparent">
              Nós geramos a arquitetura limpa.
            </span>
          </h2>

          <p className="text-lg md:text-xl text-neutral-600 dark:text-neutral-400 leading-relaxed max-w-3xl mx-auto font-medium">
            A maioria das plataformas gera um arquivo gigante, confuso e monolítico. O MetaBuilder gera um projeto completo, organizado por feature, pronto para produção — na linguagem que você escolher.
          </p>
        </div>

        {/* Cards Lado a Lado */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Card 1: Node.js */}
          <div className="relative p-8 md:p-10 rounded-[3rem] bg-white dark:bg-neutral-900 border border-amber-500/30 shadow-xl flex flex-col justify-between group hover:border-amber-500 transition-all duration-300">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="h-14 px-3.5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center gap-2.5 shadow-sm">
                  <img src="/React-Logo.svg" alt="React" className="h-7 w-auto object-contain" />
                  <span className="text-neutral-300 dark:text-neutral-700 font-light">+</span>
                  <img src="/Node.js-Logo.svg" alt="Node.js" className="h-6 w-auto object-contain" />
                </div>
                <span className="px-3.5 py-1.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-xs font-bold uppercase tracking-wider">
                  Modo 1 • Startup-Ready
                </span>
              </div>

              <div>
                <h3 className="text-2xl md:text-3xl font-black text-neutral-900 dark:text-white">
                  Next.js Full-Stack <span className="text-amber-600 dark:text-amber-400 font-bold">(Node.js)</span>
                </h3>
                <p className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 mt-1">
                  Frontend React + Backend Node.js no mesmo projeto Next.js
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-950 dark:text-amber-200 text-sm font-bold leading-relaxed">
                "Startup-ready. Deploy rápido. Um projeto, zero configuração."
              </div>

              <ul className="space-y-3.5 text-sm text-neutral-600 dark:text-neutral-300">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <span><strong>Server Actions & API Routes:</strong> Rotas de backend nativas Next.js com tipagem estrita TypeScript.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <span><strong>Zero Configuração (<code className="text-xs bg-neutral-200 dark:bg-neutral-800 px-1 py-0.5 rounded font-mono">.env.local</code>):</strong> Conexões de banco, chaves e variáveis já configuradas para rodar imediatamente.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <span><strong>Deploy Vercel-Ready:</strong> Deploy em 1 clique na Vercel, AWS ou imagem Docker otimizada.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <span><strong>Organização Modular:</strong> Telas, componentes e server actions estruturados por feature sem poluição.</span>
                </li>
              </ul>

              {/* File Tree */}
              <div className="rounded-2xl bg-[#0d1117] p-5 font-mono text-[11px] text-neutral-300 border border-neutral-800 overflow-x-auto shadow-inner">
                <div className="text-neutral-500 mb-2 font-bold flex items-center gap-1.5">
                  <FileCode2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>ESTRUTURA DE CÓDIGO EXPORTADA:</span>
                </div>
                <p className="text-amber-400">📁 meu-projeto-nextjs/</p>
                <p className="ml-3 text-neutral-400">├── 📁 src/app/api/ <span className="text-neutral-500"># API Routes REST</span></p>
                <p className="ml-3 text-neutral-400">├── 📁 src/app/(dashboard)/ <span className="text-neutral-500"># Pages & Server Actions</span></p>
                <p className="ml-3 text-neutral-400">├── 📁 src/components/ <span className="text-neutral-500"># UI Components</span></p>
                <p className="ml-3 text-neutral-400">├── 📄 .env.local <span className="text-emerald-400"># Conexões automáticas</span></p>
                <p className="ml-3 text-neutral-400">└── 📄 package.json</p>
              </div>
            </div>

            <div className="pt-6 border-t border-neutral-200 dark:border-neutral-800 mt-8 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 font-mono">
              <span>📦 Repositório Único</span>
              <span className="text-amber-600 dark:text-amber-400 font-bold">Node.js / Next.js</span>
            </div>
          </div>

          {/* Card 2: Java Spring Boot */}
          <div className="relative p-8 md:p-10 rounded-[3rem] bg-white dark:bg-neutral-900 border border-emerald-500/30 shadow-xl flex flex-col justify-between group hover:border-emerald-500 transition-all duration-300">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="h-14 px-3.5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center gap-2.5 shadow-sm">
                  <img src="/Spring-Logo.svg" alt="Spring Boot" className="h-6 w-auto object-contain" />
                  <span className="text-neutral-300 dark:text-neutral-700 font-light">+</span>
                  <img src="/Java-Logo.svg" alt="Java" className="h-8 w-auto object-contain" />
                </div>
                <span className="px-3.5 py-1.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold uppercase tracking-wider">
                  Modo 2 • Enterprise-Grade
                </span>
              </div>

              <div>
                <h3 className="text-2xl md:text-3xl font-black text-neutral-900 dark:text-white">
                  Next.js + Spring Boot <span className="text-emerald-600 dark:text-emerald-400 font-bold">(Java 21)</span>
                </h3>
                <p className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 mt-1">
                  Frontend Next.js consumindo API REST gerada em Spring Boot 3.x
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-950 dark:text-emerald-200 text-sm font-bold leading-relaxed">
                "Enterprise-grade. Spring Boot 3.x + Java 21 com Virtual Threads. Frontend e backend independentes."
              </div>

              <ul className="space-y-3.5 text-sm text-neutral-600 dark:text-neutral-300">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>frontend/ + backend/ Desacoplados:</strong> Separação total de código para deploys autônomos e governança corporativa.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Virtual Threads (Project Loom):</strong> Java 21 com suporte nativo a milhares de requisições simultâneas e baixíssimo consumo.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>pom.xml & Swagger OpenAPI:</strong> Dependências Maven completas com documentação viva gerada automaticamente.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>CORS e Drivers Nativos:</strong> CORS pré-configurado e suporte a PostgreSQL, Oracle e SQL Server no <code className="text-xs bg-neutral-200 dark:bg-neutral-800 px-1 py-0.5 rounded font-mono">application.yml</code>.</span>
                </li>
              </ul>

              {/* File Tree */}
              <div className="rounded-2xl bg-[#0d1117] p-5 font-mono text-[11px] text-neutral-300 border border-neutral-800 overflow-x-auto shadow-inner">
                <div className="text-neutral-500 mb-2 font-bold flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-emerald-400" />
                  <span>ESTRUTURA DE CÓDIGO EXPORTADA:</span>
                </div>
                <p className="text-emerald-400">📁 meu-projeto-enterprise/</p>
                <p className="ml-3 text-neutral-400">├── 📁 frontend/ <span className="text-neutral-500"># Next.js 15 (Client)</span></p>
                <p className="ml-6 text-neutral-500">└── 📄 package.json</p>
                <p className="ml-3 text-emerald-300">└── 📁 backend/ <span className="text-neutral-500"># Spring Boot 3.x (Java 21)</span></p>
                <p className="ml-6 text-neutral-400">├── 📄 pom.xml <span className="text-emerald-400"># Maven & Swagger</span></p>
                <p className="ml-6 text-neutral-400">├── 📁 src/main/java/ <span className="text-neutral-500"># Clean Architecture</span></p>
                <p className="ml-6 text-neutral-400">└── 📁 src/main/resources/ <span className="text-emerald-400"># application.yml</span></p>
              </div>
            </div>

            <div className="pt-6 border-t border-neutral-200 dark:border-neutral-800 mt-8 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 font-mono">
              <span>🏛️ Deploy Desacoplado</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">Spring Boot 3.x + Java 21</span>
            </div>
          </div>
        </div>

        {/* Callout de Soberania Técnica */}
        <div className="p-8 rounded-3xl bg-neutral-100 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-1">
            <h4 className="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              Soberania total sobre o seu código fonte
            </h4>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Faça o Eject a qualquer momento e continue desenvolvendo no VS Code, IntelliJ IDEA ou Eclipse com total compatibilidade.
            </p>
          </div>
          <Link
            href="/features/ide"
            className="inline-flex items-center gap-2 px-6 py-3.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-bold text-xs uppercase tracking-widest rounded-2xl hover:scale-105 transition-transform shrink-0 shadow-lg shadow-black/10 dark:shadow-white/10"
          >
            <span>Ver Eject na IDE</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <div className="p-16 rounded-[3rem] bg-indigo-600 text-white relative overflow-hidden group">
         <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
         <div className="relative z-10 text-center space-y-8">
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter">{t('marketing_v2.features.source_code.footer_title')}</h2>
            <p className="text-indigo-100 max-w-2xl mx-auto text-lg leading-relaxed">
               {t('marketing_v2.features.source_code.footer_desc')}
            </p>
            <BottomCta />
         </div>
      </div>
    </div>
  )
}
