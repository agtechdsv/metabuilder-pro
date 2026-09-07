'use client'

import { useState } from 'react'
import { Server, Key, Network, Cpu, ArrowRight, Terminal, FileCode2, Database, Download, Lock, Zap, CheckCircle2, Layers, Sparkles } from 'lucide-react'
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
      desc: t('marketing_v2.features.ide.eject_desc', 'Sem vendor lock-in absoluto. A qualquer momento, gere e faça download do código fonte completo no backend da sua escolha: Next.js (Node.js) ou Next.js + Spring Boot 3.x (Java 21).'),
      icon: <Download className="w-8 h-8 text-purple-500" />,
      color: "from-purple-500/20 to-pink-500/5",
      borderColor: "border-purple-500/20"
    },
    {
      title: t('marketing_v2.features.ide.intellisense_title', 'IntelliSense e TypeScript'),
      desc: t('marketing_v2.features.ide.intellisense_desc', 'O motor do Editor preserva a sintaxe React/JSX nativamente, fornecendo autocompletar inteligente, formatação e alertas de erros em tempo real sem lentidão, focando apenas no que importa.'),
      icon: <Zap className="w-8 h-8 text-amber-500" />,
      color: "from-amber-500/20 to-yellow-500/5",
      borderColor: "border-amber-500/20"
    },
    {
      title: t('marketing_v2.features.ide.tabs_title', 'Gestão de Merges e Abas'),
      desc: t('marketing_v2.features.ide.tabs_desc', 'Controle supremo do seu fluxo de trabalho: botões "Fechar Salvos", navegação automática por trechos modificados (Diff Arrows) e reversão cirúrgica de arquivos durante o processo de Merge.'),
      icon: <Lock className="w-8 h-8 text-red-500" />,
      color: "from-red-500/20 to-orange-500/5",
      borderColor: "border-red-500/20"
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

        {/* SEÇÃO DETALHADA: EJECT & SYNC — ESCOLHA SUA STACK DE BACKEND */}
        <div className="mb-32">
          {/* Header da Seção */}
          <div className="text-center max-w-4xl mx-auto mb-16 space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-bold text-xs uppercase tracking-widest border border-indigo-500/20 shadow-sm">
              <Download className="w-4 h-4 text-indigo-500" />
              <span>Eject & Sync Architecture</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black tracking-wider ml-1">
                Multi-Stack Backend
              </span>
            </div>

            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-neutral-900 dark:text-white leading-tight tracking-tight">
              Eject & Sync — <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-amber-500 via-purple-500 to-emerald-500 bg-clip-text text-transparent">
                Escolha sua Stack de Backend
              </span>
            </h2>

            <p className="text-xl md:text-2xl text-neutral-600 dark:text-neutral-300 font-medium">
              Exporte código profissional. Sem lock-in. Sem vendor dependência.
            </p>

            {/* Destaque Diferencial */}
            <div className="p-6 md:p-8 rounded-3xl bg-neutral-100/80 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 text-left relative overflow-hidden shadow-lg">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0 mt-1">
                  <Sparkles className="w-5 h-5 text-indigo-500" />
                </div>
                <div>
                  <h4 className="font-bold text-neutral-900 dark:text-white text-base md:text-lg mb-1">
                    Diferencial de Engenharia MetaBuilder PRO
                  </h4>
                  <p className="text-neutral-600 dark:text-neutral-300 text-sm md:text-base leading-relaxed">
                    A maioria das plataformas gera um arquivo gigante, ilegível e monolítico. O MetaBuilder gera um <strong>projeto completo, modular e organizado por feature</strong>, pronto para produção — na linguagem e arquitetura que sua equipe escolher.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Cards Lado a Lado Comparando as Duas Opções */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
            {/* Opção 1: Next.js Full-Stack (Node.js) */}
            <div className="relative p-8 md:p-10 rounded-[3rem] bg-gradient-to-b from-amber-500/5 via-white/50 to-white dark:via-neutral-900/50 dark:to-neutral-950 border border-amber-500/30 shadow-xl overflow-hidden flex flex-col justify-between group hover:border-amber-500 transition-all duration-300">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="p-3 px-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center gap-3 shadow-md">
                    <img src="/React-Logo.svg" alt="React" className="h-10 md:h-12 w-auto object-contain" />
                    <span className="text-lg font-bold text-neutral-300 dark:text-neutral-700">+</span>
                    <img src="/Node.js-Logo.svg" alt="Node.js" className="h-9 md:h-11 w-auto object-contain" />
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

                <div className="space-y-3">
                  <h5 className="text-xs font-black uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    O que é exportado:
                  </h5>
                  <ul className="space-y-3 text-sm text-neutral-600 dark:text-neutral-300">
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                      <span><strong>Server Actions & API Routes:</strong> Ações de servidor e endpoints HTTP tipados nativos do Next.js App Router.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                      <span><strong>Zero Configuração (<code className="text-xs bg-neutral-200 dark:bg-neutral-800 px-1 py-0.5 rounded font-mono">.env.local</code>):</strong> Variáveis de conexão, tokens e segredos gerados automaticamente.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                      <span><strong>Deploy Vercel-Ready:</strong> Um único comando <code className="text-xs bg-neutral-200 dark:bg-neutral-800 px-1 py-0.5 rounded font-mono">vercel deploy</code> ou build Docker pronto para nuvem.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                      <span><strong>Ideal para:</strong> Startups, MVPs, provas de conceito e equipes ágeis que preferem JavaScript/TypeScript unificado.</span>
                    </li>
                  </ul>
                </div>

                {/* Estrutura de Arquivos Gerada */}
                <div className="mt-4 rounded-2xl bg-[#0d1117] p-5 font-mono text-[11px] text-neutral-300 border border-neutral-800 overflow-x-auto shadow-inner">
                  <div className="text-neutral-500 mb-2 font-bold flex items-center gap-1.5">
                    <FileCode2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>ESTRUTURA DO PROJETO GERADO:</span>
                  </div>
                  <p className="text-amber-400">📁 meu-app/</p>
                  <p className="ml-3 text-neutral-400">├── 📁 src/app/api/ <span className="text-neutral-500"># Endpoints REST tipados</span></p>
                  <p className="ml-3 text-neutral-400">├── 📁 src/app/(dashboard)/ <span className="text-neutral-500"># Telas e Server Actions</span></p>
                  <p className="ml-3 text-neutral-400">├── 📁 src/components/ui/ <span className="text-neutral-500"># Componentes reutilizáveis</span></p>
                  <p className="ml-3 text-neutral-400">├── 📁 src/lib/db/ <span className="text-neutral-500"># Client ORM e queries</span></p>
                  <p className="ml-3 text-neutral-400">├── 📄 .env.local <span className="text-emerald-400"># Conexões pré-configuradas</span></p>
                  <p className="ml-3 text-neutral-400">└── 📄 package.json</p>
                </div>
              </div>

              <div className="pt-6 border-t border-neutral-200 dark:border-neutral-800/80 mt-8 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                <span>📦 Projeto Full-Stack Único</span>
                <span className="text-amber-600 dark:text-amber-400 font-bold">Node.js LTS</span>
              </div>
            </div>

            {/* Opção 2: Next.js + Spring Boot (Java 21) */}
            <div className="relative p-8 md:p-10 rounded-[3rem] bg-gradient-to-b from-emerald-500/5 via-white/50 to-white dark:via-neutral-900/50 dark:to-neutral-950 border border-emerald-500/30 shadow-xl overflow-hidden flex flex-col justify-between group hover:border-emerald-500 transition-all duration-300">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="p-3 px-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center gap-3 shadow-md">
                    <img src="/Spring-Logo.svg" alt="Spring Boot" className="h-9 md:h-11 w-auto object-contain max-w-[130px]" />
                    <span className="text-lg font-bold text-neutral-300 dark:text-neutral-700">+</span>
                    <img src="/Java-Logo.svg" alt="Java" className="h-11 md:h-13 w-auto object-contain" />
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
                    Frontend Next.js chamando API REST gerada em Spring Boot 3.x
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-950 dark:text-emerald-200 text-sm font-bold leading-relaxed">
                  "Enterprise-grade. Spring Boot 3.x + Java 21 com Virtual Threads. Frontend e backend independentes."
                </div>

                <div className="space-y-3">
                  <h5 className="text-xs font-black uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    O que é exportado:
                  </h5>
                  <ul className="space-y-3 text-sm text-neutral-600 dark:text-neutral-300">
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>Pastas frontend/ e backend/ separadas:</strong> Deploys independentes em servidores, pipelines de CI/CD ou clusters Kubernetes distintos.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>Virtual Threads (Project Loom):</strong> Suporte nativo a alta concorrência com threads virtuais do Java 21 ativadas.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>pom.xml & Swagger OpenAPI 3.0:</strong> Maven configurado com Spring Web, JPA/Hibernate, validações e documentação automática em <code className="text-xs bg-neutral-200 dark:bg-neutral-800 px-1 py-0.5 rounded font-mono">/swagger-ui.html</code>.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>CORS e Drivers Nativos:</strong> CORS pré-liberado para o Next.js e drivers adequados (PostgreSQL, Oracle, SQL Server) prontos no <code className="text-xs bg-neutral-200 dark:bg-neutral-800 px-1 py-0.5 rounded font-mono">application.yml</code>.</span>
                    </li>
                  </ul>
                </div>

                {/* Estrutura de Arquivos Gerada */}
                <div className="mt-4 rounded-2xl bg-[#0d1117] p-5 font-mono text-[11px] text-neutral-300 border border-neutral-800 overflow-x-auto shadow-inner">
                  <div className="text-neutral-500 mb-2 font-bold flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-emerald-400" />
                    <span>ESTRUTURA DO PROJETO GERADO:</span>
                  </div>
                  <p className="text-emerald-400">📁 meu-app-enterprise/</p>
                  <p className="ml-3 text-neutral-400">├── 📁 frontend/ <span className="text-neutral-500"># Next.js 15 App Router</span></p>
                  <p className="ml-6 text-neutral-500">├── 📁 src/app/ & components/</p>
                  <p className="ml-6 text-neutral-500">└── 📄 package.json</p>
                  <p className="ml-3 text-emerald-300">└── 📁 backend/ <span className="text-neutral-500"># Spring Boot 3.x + Java 21</span></p>
                  <p className="ml-6 text-neutral-400">├── 📄 pom.xml <span className="text-emerald-400"># Maven Build + Swagger</span></p>
                  <p className="ml-6 text-neutral-400">├── 📁 src/main/java/ <span className="text-neutral-500"># Controllers, Services, Entities</span></p>
                  <p className="ml-6 text-neutral-400">└── 📁 src/main/resources/ <span className="text-emerald-400"># application.yml + Drivers</span></p>
                </div>
              </div>

              <div className="pt-6 border-t border-neutral-200 dark:border-neutral-800/80 mt-8 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                <span>🏛️ Arquitetura Corporativa Desacoplada</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">Java 21 + Spring 3</span>
              </div>
            </div>
          </div>

          {/* Tabela Comparativa Resumida */}
          <div className="rounded-3xl border border-neutral-200 dark:border-neutral-800 overflow-hidden bg-white/50 dark:bg-neutral-900/30 backdrop-blur-sm p-6 md:p-8">
            <h4 className="text-lg font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-500" />
              Comparativo Direto de Capacidades no Eject
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400 text-xs font-bold uppercase tracking-wider">
                    <th className="pb-4">Característica</th>
                    <th className="pb-4 text-amber-600 dark:text-amber-400">
                      <span className="inline-flex items-center gap-2">
                        <img src="/React-Logo.svg" alt="React" className="h-6 w-auto inline object-contain" />
                        <img src="/Node.js-Logo.svg" alt="Node.js" className="h-5 w-auto inline object-contain" />
                        <span>Next.js Full-Stack (Node.js)</span>
                      </span>
                    </th>
                    <th className="pb-4 text-emerald-600 dark:text-emerald-400">
                      <span className="inline-flex items-center gap-2">
                        <img src="/Spring-Logo.svg" alt="Spring" className="h-5 w-auto inline object-contain" />
                        <img src="/Java-Logo.svg" alt="Java" className="h-6 w-auto inline object-contain" />
                        <span>Next.js + Spring Boot (Java 21)</span>
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800/60 font-medium">
                  <tr>
                    <td className="py-3.5 text-neutral-800 dark:text-neutral-200 font-bold">Repositório</td>
                    <td className="py-3.5 text-neutral-600 dark:text-neutral-400">Monorepo / Projeto Único</td>
                    <td className="py-3.5 text-neutral-600 dark:text-neutral-400">Pastas frontend/ e backend/ independentes</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 text-neutral-800 dark:text-neutral-200 font-bold">Linguagem Backend</td>
                    <td className="py-3.5 text-neutral-600 dark:text-neutral-400">Node.js + TypeScript</td>
                    <td className="py-3.5 text-neutral-600 dark:text-neutral-400">Java 21 LTS (Virtual Threads habilitadas)</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 text-neutral-800 dark:text-neutral-200 font-bold">Documentação de API</td>
                    <td className="py-3.5 text-neutral-600 dark:text-neutral-400">Tipos TypeScript end-to-end</td>
                    <td className="py-3.5 text-neutral-600 dark:text-neutral-400">Swagger / OpenAPI 3.0 interativo automático</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 text-neutral-800 dark:text-neutral-200 font-bold">Deploy</td>
                    <td className="py-3.5 text-neutral-600 dark:text-neutral-400">Vercel, AWS Amplify, Docker</td>
                    <td className="py-3.5 text-neutral-600 dark:text-neutral-400">Vercel (Front) + JAR / Kubernetes / JVM (Back)</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 text-neutral-800 dark:text-neutral-200 font-bold">Lock-in</td>
                    <td className="py-3.5 text-amber-600 dark:text-amber-400 font-bold">Zero Lock-in (Código aberto padrão)</td>
                    <td className="py-3.5 text-emerald-600 dark:text-emerald-400 font-bold">Zero Lock-in (Maven + Spring padrão)</td>
                  </tr>
                </tbody>
              </table>
            </div>
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
                  <p><span className="text-pink-500 dark:text-pink-400">import</span> {'{'} Button {'}'} <span className="text-pink-500 dark:text-pink-400">from</span> <span className="text-green-600 dark:text-green-300">'@/components/ui/button'</span>;</p>
                  <p className="mt-4"><span className="text-pink-500 dark:text-pink-400">export default function</span> <span className="text-blue-600 dark:text-blue-300">CustomActionCard</span>() {'{'}</p>
                  <p className="ml-4"><span className="text-pink-500 dark:text-pink-400">return</span> (</p>
                  <p className="ml-8">&lt;<span className="text-blue-600 dark:text-blue-300">div</span> className=<span className="text-green-600 dark:text-green-300">"p-6 bg-white dark:bg-black rounded-xl"</span>&gt;</p>
                  <p className="ml-12">&lt;<span className="text-blue-600 dark:text-blue-300">h3</span>&gt;Ação Customizada&lt;/<span className="text-blue-600 dark:text-blue-300">h3</span>&gt;</p>
                  <p className="ml-12">&lt;<span className="text-blue-600 dark:text-blue-300">Button</span> onClick=...&gt;Disparar&lt;/<span className="text-blue-600 dark:text-blue-300">Button</span>&gt;</p>
                  <p className="ml-8">&lt;/<span className="text-blue-600 dark:text-blue-300">div</span>&gt;</p>
                  <p className="ml-4">);</p>
                  <p>{'}'}</p>
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
