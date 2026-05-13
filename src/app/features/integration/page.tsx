'use client'

import { motion } from 'framer-motion'
import { Database, Link2, ShieldAlert, Cpu, ArrowLeft, Terminal } from 'lucide-react'
import Link from 'next/link'

export default function IntegrationFeaturePage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-20 space-y-24">
      <Link href="/" className="inline-flex items-center gap-2 text-neutral-500 hover:text-indigo-600 transition-colors mb-8 group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Voltar para a Home
      </Link>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
        <div className="space-y-8">
          <div className="w-16 h-16 rounded-3xl bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
            <Database className="w-8 h-8" />
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter dark:text-white leading-[1]">
            Onde seus <br/>
            <span className="text-blue-500">dados já estão.</span>
          </h1>
          <p className="text-xl text-neutral-500 dark:text-neutral-400 leading-relaxed">
            Não gaste recursos em migrações arriscadas. O MetaBuilderPRO atua como uma camada de interface ultra-moderna sobre seus bancos de dados SQL existentes.
          </p>
        </div>
        
        <div className="relative group">
          <div className="absolute inset-0 bg-blue-500/10 blur-3xl rounded-full group-hover:bg-blue-500/20 transition-colors"></div>
          <div className="relative p-8 rounded-[3rem] bg-[#0A0A0F] border border-white/10 shadow-3xl">
             <div className="flex items-center gap-2 mb-6">
                <Terminal className="w-4 h-4 text-blue-400" />
                <span className="text-[10px] font-mono text-blue-400 uppercase tracking-widest">Connection Console</span>
             </div>
             <div className="space-y-4 font-mono text-[12px] text-blue-300/80">
                <p><span className="text-white">$</span> connect --adapter postgres --ssl true</p>
                <div className="pl-4 space-y-1">
                   <p className="text-emerald-400">✓ Auth connection established</p>
                   <p>✓ Fetching schema for 'public'</p>
                   <p className="text-white">Found Tables:</p>
                   <p className="pl-4"> - customers <span className="text-blue-500 opacity-50">(1.2M rows)</span></p>
                   <p className="pl-4"> - orders <span className="text-blue-500 opacity-50">(5.4M rows)</span></p>
                   <p className="pl-4"> - products <span className="text-blue-500 opacity-50">(850k rows)</span></p>
                </div>
                <p><span className="text-white">$</span> metabuilder generate --all</p>
                <p className="text-indigo-400 font-bold">✨ Building UI System based on relationships...</p>
             </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="p-12 rounded-[2.5rem] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-6">
          <Link2 className="w-10 h-10 text-indigo-500" />
          <h3 className="text-2xl font-black dark:text-white tracking-tight">Preserve sua Lógica</h3>
          <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed">
            Continue usando suas Procedures, Triggers e Views. O MetaBuilderPRO respeita a inteligência que você já construiu no banco de dados.
          </p>
        </div>
        <div className="p-12 rounded-[2.5rem] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-6">
          <ShieldAlert className="w-10 h-10 text-red-500" />
          <h3 className="text-2xl font-black dark:text-white tracking-tight">Segurança Transparente</h3>
          <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed">
            Seus dados nunca saem da sua infraestrutura. O MetaBuilderPRO apenas gerencia como eles são exibidos e editados através de conexões seguras.
          </p>
        </div>
      </div>

      <section className="max-w-4xl mx-auto text-center space-y-8">
         <div className="flex justify-center gap-8 flex-wrap opacity-50 grayscale hover:grayscale-0 transition-all">
            {/* Logos de bancos de dados simulados */}
            <span className="text-2xl font-black">PostgreSQL</span>
            <span className="text-2xl font-black">MySQL</span>
            <span className="text-2xl font-black">SQL Server</span>
            <span className="text-2xl font-black">Oracle</span>
            <span className="text-2xl font-black">SQLite</span>
         </div>
         <p className="text-neutral-400 font-medium">Compatível com os principais motores de banco de dados do mercado.</p>
      </section>
    </div>
  )
}
