'use client'

import { motion } from 'framer-motion'
import { Zap, Clock, Rocket, CheckCircle2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function SpeedFeaturePage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-20 space-y-24">
      <Link href="/" className="inline-flex items-center gap-2 text-neutral-500 hover:text-indigo-600 transition-colors mb-8 group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Voltar para a Home
      </Link>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
        <div className="space-y-8">
          <div className="w-16 h-16 rounded-3xl bg-yellow-400/10 flex items-center justify-center text-yellow-500 border border-yellow-400/20">
            <Zap className="w-8 h-8 fill-current" />
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter dark:text-white leading-[1]">
            Desenvolva na <br/>
            <span className="text-yellow-500">velocidade do pensamento.</span>
          </h1>
          <p className="text-xl text-neutral-500 dark:text-neutral-400 leading-relaxed">
            O MetaBuilderPRO foi projetado para eliminar as tarefas repetitivas do desenvolvimento web. Nosso Wizard automatiza a criação de telas complexas a partir de uma descrição simples ou da estrutura do seu banco de dados.
          </p>
        </div>
        
        <div className="relative">
          <div className="absolute inset-0 bg-yellow-500/10 blur-3xl rounded-full"></div>
          <div className="relative p-8 rounded-[3rem] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-6">
             <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-4">
               <span className="font-bold text-sm dark:text-white">Estimativa de Tempo</span>
               <span className="text-xs text-yellow-500 font-black uppercase">MetaBuilderPRO vs Tradicional</span>
             </div>
             <div className="space-y-4">
               <div className="space-y-2">
                 <div className="flex justify-between text-xs font-bold text-neutral-400">
                   <span>CRUD Tradicional (Código Manual)</span>
                   <span>12 Horas</span>
                 </div>
                 <div className="w-full h-3 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <div className="w-full h-full bg-neutral-300 dark:bg-neutral-700"></div>
                 </div>
               </div>
               <div className="space-y-2">
                 <div className="flex justify-between text-xs font-bold text-yellow-500">
                   <span>MetaBuilderPRO Wizard</span>
                   <span>15 Minutos</span>
                 </div>
                 <div className="w-full h-3 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: '5%' }}
                      transition={{ duration: 1, delay: 0.5 }}
                      className="h-full bg-yellow-500"
                    ></motion.div>
                 </div>
               </div>
             </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-12">
        <div className="space-y-4">
          <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          <h3 className="text-xl font-bold dark:text-white">Wizard de Use Case</h3>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm leading-relaxed">
            Configure formulários, grids e filtros respondendo a perguntas simples. O sistema gera os componentes React otimizados para você.
          </p>
        </div>
        <div className="space-y-4">
          <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          <h3 className="text-xl font-bold dark:text-white">Geração de Esquema IA</h3>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm leading-relaxed">
            Nossa IA analisa seu banco de dados e sugere automaticamente as melhores configurações de interface, ícones e validações.
          </p>
        </div>
        <div className="space-y-4">
          <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          <h3 className="text-xl font-bold dark:text-white">Deploy Instantâneo</h3>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm leading-relaxed">
            As alterações feitas no Studio refletem imediatamente no ambiente de runtime para os seus usuários finais.
          </p>
        </div>
      </section>
      
      <section className="p-12 rounded-[3rem] bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-center space-y-8">
         <h2 className="text-3xl font-black dark:text-white">Pare de codar o básico.</h2>
         <p className="text-neutral-500 dark:text-neutral-400 max-w-xl mx-auto">
            Libere sua equipe para focar em inovação, enquanto o MetaBuilderPRO cuida da infraestrutura e interface de dados.
         </p>
         <button className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-transform">
            Experimentar Wizard Gratuitamente
         </button>
      </section>
    </div>
  )
}
