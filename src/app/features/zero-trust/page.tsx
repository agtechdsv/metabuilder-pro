'use client'

import { motion } from 'framer-motion'
import { ShieldCheck, Zap, Database, Globe, ArrowLeft, Lock, Server, Cpu, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

export default function ZeroTrustFeaturePage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-20 space-y-24">
      <Link href="/" className="inline-flex items-center gap-2 text-neutral-500 hover:text-indigo-600 transition-colors mb-8 group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Voltar para a Home
      </Link>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
        <div className="space-y-8">
          <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 border border-indigo-400/20">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter dark:text-white leading-[1]">
            Arquitetura <br/>
            <span className="text-indigo-600">Zero-Trust Bridge.</span>
          </h1>
          <p className="text-xl text-neutral-500 dark:text-neutral-400 leading-relaxed">
            Inovação em segurança que permite conectar sua interface na nuvem ao seu banco de dados local sem expor uma única porta de rede.
          </p>
        </div>
        
        <div className="relative">
          <div className="absolute inset-0 bg-indigo-500/10 blur-[120px] rounded-full"></div>
          <div className="relative p-8 rounded-[3rem] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-3xl space-y-8">
             <div className="flex items-center justify-between gap-4">
                <div className="text-center space-y-2">
                   <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center mx-auto text-indigo-600">
                      <Globe className="w-6 h-6" />
                   </div>
                   <p className="text-[9px] font-black uppercase dark:text-white">Cloud App</p>
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-indigo-500 to-emerald-500 relative">
                   <Zap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500" />
                </div>
                <div className="text-center space-y-2">
                   <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mx-auto text-emerald-600 font-bold">
                      <Cpu className="w-6 h-6" />
                   </div>
                   <p className="text-[9px] font-black uppercase dark:text-white">Tunnel Binary</p>
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-emerald-500 to-indigo-500 relative">
                   <Database className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                </div>
             </div>
             
             <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-black/50 border border-neutral-100 dark:border-white/5 font-mono text-[11px] text-indigo-400">
                <p className="text-neutral-500"># Túnel estabelecido via WebSocket Seguro</p>
                <p>tunnel_id: mtb_live_9823</p>
                <p>status: <span className="text-emerald-500">ENCRYPTED_AND_READY</span></p>
             </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        <div className="space-y-6">
           <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
              <Server className="w-6 h-6" />
           </div>
           <h3 className="text-2xl font-black dark:text-white tracking-tight">Executável Nativo</h3>
           <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed">
             Fornecemos binários otimizados para Windows e Linux. Basta rodar no servidor onde o banco está instalado ou em um servidor que tenha acesso à rede local.
           </p>
        </div>
        <div className="space-y-6">
           <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
              <Lock className="w-6 h-6" />
           </div>
           <h3 className="text-2xl font-black dark:text-white tracking-tight">Cego por Design</h3>
           <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed">
             Nosso sistema "não sabe" os seus dados sensíveis. O executável local é o único que possui a senha do banco, agindo como um mediador seguro que processa comandos via eventos.
           </p>
        </div>
        <div className="space-y-6">
           <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
              <Zap className="w-6 h-6" />
           </div>
           <h3 className="text-2xl font-black dark:text-white tracking-tight">Performance Realtime</h3>
           <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed">
             Utilizamos WebSockets para garantir que a latência seja mínima. A experiência de uso é idêntica a estar conectado diretamente ao banco de dados.
           </p>
        </div>
      </div>

      <section className="bg-neutral-900 rounded-[3rem] p-12 text-white">
         <div className="max-w-3xl space-y-8">
            <h2 className="text-3xl font-black">Resumo para o Gestor de TI</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-4">
                  <div className="flex gap-3">
                     <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                     <p className="text-sm opacity-80">Não requer abertura de portas de entrada (Inbound).</p>
                  </div>
                  <div className="flex gap-3">
                     <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                     <p className="text-sm opacity-80">Conexão TLS 1.3 ponta-a-ponta.</p>
                  </div>
               </div>
               <div className="space-y-4">
                  <div className="flex gap-3">
                     <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                     <p className="text-sm opacity-80">As credenciais do banco nunca saem da infra do cliente.</p>
                  </div>
                  <div className="flex gap-3">
                     <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                     <p className="text-sm opacity-80">Auditável: todos os comandos SQL passam pelo túnel local.</p>
                  </div>
               </div>
            </div>
         </div>
      </section>
    </div>
  )
}
