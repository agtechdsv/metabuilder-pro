'use client'

import { motion } from 'framer-motion'
import { ShieldCheck, Zap, Database, Palette, Layout, Globe, Search, ArrowRight, CheckCircle2 } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import Link from 'next/link'

export function MarketingSections() {
  const { t } = useI18n()

  const features = [
    {
      icon: <Zap className="w-6 h-6 text-yellow-400" />,
      title: "Desenvolvimento Ultra-Rápido",
      desc: "Transforme semanas de desenvolvimento em horas com nosso Wizard de Casos de Uso e geração automática de telas.",
      href: "/features/speed"
    },
    {
      icon: <Database className="w-6 h-6 text-blue-400" />,
      title: "Integração Nativa com Legados",
      desc: "Conecte sua base de dados SQL existente e deixe o MetaBuilderPRO mapear e criar a interface instantaneamente.",
      href: "/features/integration"
    },
    {
      icon: <Palette className="w-6 h-6 text-purple-400" />,
      title: "Identidade Visual Dinâmica",
      desc: "Branding total: desde cores e fontes até o favicon e logo, tudo configurado em tempo real por projeto.",
      href: "/features/branding"
    },
    {
      icon: <ShieldCheck className="w-6 h-6 text-emerald-400" />,
      title: "Arquitetura Zero-Trust",
      desc: "Segurança máxima: nosso túnel WebSocket garante que seus dados nunca saiam da sua rede sem seu comando direto.",
      href: "/features/zero-trust"
    }
  ]

  return (
    <div className="w-full space-y-32 py-20 px-6">
      
      {/* Feature Bento Grid */}
      <section className="max-w-7xl mx-auto">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-3xl md:text-5xl font-black tracking-tight dark:text-white">
            Uma engine completa para <br/>
            <span className="text-indigo-600">desenvolvedores e empresas.</span>
          </h2>
          <p className="text-neutral-500 dark:text-neutral-400 max-w-2xl mx-auto text-lg">
            Esqueça o boilerplate. Foque no que importa: a lógica de negócio do seu cliente.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => (
            <Link key={i} href={feature.href} className="group p-8 rounded-[2.5rem] bg-neutral-100/50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 hover:border-indigo-500/50 transition-all duration-500 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-neutral-950 flex items-center justify-center mb-6 shadow-inner border border-neutral-200 dark:border-neutral-800 group-hover:scale-110 transition-transform duration-500">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold dark:text-white mb-3">{feature.title}</h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">{feature.desc}</p>
              </div>
              <div className="mt-8 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                Saiba Mais <ArrowRight className="w-3 h-3" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Legacy Bridge Showcase */}
      <section className="max-w-7xl mx-auto rounded-[3rem] bg-gradient-to-br from-indigo-600 to-indigo-900 p-12 overflow-hidden relative group">
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 blur-3xl pointer-events-none">
          <div className="w-full h-full bg-white rounded-full translate-x-1/2 -translate-y-1/4"></div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
          <div className="space-y-8 text-white">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-[10px] uppercase tracking-wider font-bold">
              <Database className="w-3.5 h-3.5" />
              Legacy Bridge Technology
            </div>
            <h2 className="text-4xl md:text-6xl font-black leading-[1.1] tracking-tight">
              Não migre seus dados. <br/>
              Apenas dê vida a eles.
            </h2>
            <p className="text-indigo-100 text-lg leading-relaxed max-w-md">
              O MetaBuilderPRO se conecta ao seu banco de dados SQL atual (PostgreSQL, MySQL, SQL Server) e gera uma interface administrativa completa em minutos, sem mexer em uma linha da sua estrutura atual.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <button className="px-8 py-4 bg-white text-indigo-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-transform shadow-2xl">
                Agende uma Demonstração
              </button>
              <button className="px-8 py-4 bg-indigo-500/20 border border-white/20 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-500/30 transition-all">
                Ver Documentação
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
                      <h4 className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-4">Como funciona o Túnel Seguro</h4>
                      <ul className="space-y-3">
                         <li className="flex items-start gap-3 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-indigo-500 mt-0.5" />
                            <span className="text-neutral-600 dark:text-neutral-400"><strong>Executável Nativo:</strong> Um arquivo leve (.exe ou binário Linux) roda no seu servidor.</span>
                         </li>
                         <li className="flex items-start gap-3 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-indigo-500 mt-0.5" />
                            <span className="text-neutral-600 dark:text-neutral-400"><strong>Zero Inbound:</strong> Nenhuma porta de firewall precisa ser aberta para fora.</span>
                         </li>
                         <li className="flex items-start gap-3 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-indigo-500 mt-0.5" />
                            <span className="text-neutral-600 dark:text-neutral-400"><strong>Privacidade da String:</strong> Nós nunca recebemos ou armazenamos sua senha do banco.</span>
                         </li>
                      </ul>
                   </div>
                </div>
             </div>
          </div>

          <div className="space-y-8">
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter dark:text-white leading-[1]">
              Privacidade em primeiro lugar. <br/>
              <span className="text-indigo-600">Sempre.</span>
            </h2>
            <p className="text-xl text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Diferente de outras ferramentas, o MetaBuilderPRO não conecta no seu banco. Ele envia comandos criptografados para o seu túnel local, que processa a informação e devolve apenas o necessário.
            </p>
            <div className="flex gap-4">
               <div className="flex-1 p-6 rounded-3xl bg-neutral-100 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800">
                  <h4 className="text-2xl font-black text-indigo-600 mb-2">100%</h4>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Dados Encriptados</p>
               </div>
               <div className="flex-1 p-6 rounded-3xl bg-neutral-100 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800">
                  <h4 className="text-2xl font-black text-emerald-600 mb-2">Zero</h4>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Portas Abertas</p>
               </div>
            </div>
          </div>
        </div>
      </section>
      <section className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="p-12 rounded-[2.5rem] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl">
             <Layout className="w-7 h-7" />
          </div>
          <h3 className="text-3xl font-black dark:text-white tracking-tight">Wizard de <br/>Casos de Uso</h3>
          <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed">
            Não perca tempo desenhando grids e formulários um a um. Nosso assistente inteligente cria fluxos completos de CRUD, Master-Detail e Dashboards baseados na semântica do seu banco de dados.
          </p>
        </div>
        
        <div className="p-12 rounded-[2.5rem] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-xl">
             <Globe className="w-7 h-7" />
          </div>
          <h3 className="text-3xl font-black dark:text-white tracking-tight">Runtime<br/>Whitelabel</h3>
          <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed">
            O MetaBuilderPRO desaparece para que sua marca brilhe. Favicons dinâmicos, URLs customizadas e temas específicos para cada projeto que você hospedar na plataforma.
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-4xl mx-auto text-center py-20 space-y-8">
        <h2 className="text-4xl md:text-7xl font-black tracking-tighter dark:text-white">
          Pronto para o <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-500">Próximo Nível?</span>
        </h2>
        <p className="text-xl text-neutral-500 dark:text-neutral-400">
          Acelere sua entrega técnica e encante seus clientes com interfaces premium.
        </p>
        <div className="flex flex-col md:flex-row items-center justify-center gap-4">
          <button className="w-full md:w-auto px-10 py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-500/20 active:scale-95">
             Começar Agora Grátis
          </button>
          <button className="w-full md:w-auto px-10 py-5 bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-all active:scale-95">
             Ver Planos Enterprise
          </button>
        </div>
      </section>

    </div>
  )
}
