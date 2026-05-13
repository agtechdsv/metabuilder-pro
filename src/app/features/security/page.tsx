'use client'

import { motion } from 'framer-motion'
import { ShieldCheck, Lock, Fingerprint, Network, ArrowLeft, Key } from 'lucide-react'
import Link from 'next/link'

export default function SecurityFeaturePage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-20 space-y-24">
      <Link href="/" className="inline-flex items-center gap-2 text-neutral-500 hover:text-indigo-600 transition-colors mb-8 group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Voltar para a Home
      </Link>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
        <div className="space-y-8">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-400/20">
            <ShieldCheck className="w-8 h-8 fill-current" />
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter dark:text-white leading-[1]">
            Segurança <br/>
            <span className="text-emerald-500">Inabalável.</span>
          </h1>
          <p className="text-xl text-neutral-500 dark:text-neutral-400 leading-relaxed">
            Proteção total para os dados dos seus clientes. Escolha entre múltiplas estratégias de autenticação e garanta que apenas quem deve, acesse o que pode.
          </p>
        </div>
        
        <div className="relative">
           <div className="absolute inset-0 bg-emerald-500/10 blur-[120px] rounded-full"></div>
           <div className="relative p-12 rounded-[4rem] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-3xl text-center space-y-8">
              <div className="inline-block p-6 rounded-full bg-emerald-500 text-white shadow-2xl shadow-emerald-500/20">
                 <Lock className="w-12 h-12" />
              </div>
              <div className="space-y-2">
                 <h3 className="text-2xl font-black dark:text-white">Autenticação Customizável</h3>
                 <p className="text-sm text-neutral-500 dark:text-neutral-400">Suporte a BCrypt, MD5, SHA256 e mais.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800 flex items-center gap-3">
                    <Fingerprint className="w-4 h-4 text-emerald-500" />
                    <span className="text-[10px] font-black uppercase dark:text-white">Managed Auth</span>
                 </div>
                 <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800 flex items-center gap-3">
                    <Network className="w-4 h-4 text-emerald-500" />
                    <span className="text-[10px] font-black uppercase dark:text-white">LDAP / AD</span>
                 </div>
              </div>
           </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="space-y-6">
           <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
              <Key className="w-6 h-6" />
           </div>
           <h3 className="text-2xl font-black dark:text-white tracking-tight">Criptografia de Ponta</h3>
           <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed">
             Toda a comunicação entre o Runtime e sua base de dados é protegida por camadas de criptografia TLS, garantindo integridade e confidencialidade.
           </p>
        </div>
        <div className="space-y-6">
           <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
              <ShieldCheck className="w-6 h-6" />
           </div>
           <h3 className="text-2xl font-black dark:text-white tracking-tight">Conformidade LGPD/GDPR</h3>
           <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed">
             Ferramentas integradas para gestão de cookies, termos de uso e políticas de privacidade, ajudando você a manter seus projetos em conformidade legal.
           </p>
        </div>
      </section>

      <div className="p-16 rounded-[3rem] bg-indigo-600 text-white relative overflow-hidden group">
         <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
         <div className="relative z-10 text-center space-y-8">
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter">Pronto para proteger seus dados?</h2>
            <p className="text-indigo-100 max-w-2xl mx-auto text-lg leading-relaxed">
               Implemente segurança de nível bancário em seus sistemas em poucos cliques, sem ser um especialista em infraestrutura.
            </p>
            <button className="px-12 py-5 bg-white text-indigo-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-transform shadow-2xl">
               Ativar Segurança Enterprise
            </button>
         </div>
      </div>
    </div>
  )
}
