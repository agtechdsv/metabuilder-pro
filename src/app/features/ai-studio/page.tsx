'use client'

import { useState } from 'react'
import { Bot, Sparkles, Code2, ArrowRight, Layers, FileJson, Cpu, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useI18n } from '@/i18n/I18nContext'

export default function AIStudioFeaturePage() {
  const { t } = useI18n()
  
  const images = [
    '/images/ai-studio/1.png',
    '/images/ai-studio/2.png',
    '/images/ai-studio/3.png',
    '/images/ai-studio/4.png',
  ]
  const [currentImg, setCurrentImg] = useState(0)

  const nextImg = () => setCurrentImg((prev) => (prev + 1) % images.length)
  const prevImg = () => setCurrentImg((prev) => (prev - 1 + images.length) % images.length)

  const aiFeatures = [
    {
      title: "Geração Inteligente",
      desc: "Descreva a regra de negócio em linguagem natural e a IA configurada interpretará o contexto do banco de dados, modelos e relacionamentos para criar a tela perfeita.",
      icon: <Bot className="w-8 h-8 text-violet-500" />,
      color: "from-violet-500/20 to-fuchsia-500/5",
      borderColor: "border-violet-500/20"
    },
    {
      title: "Código React Nativo",
      desc: "O resultado gerado não é um mockup. É código React.js funcional, otimizado e pronto para produção, com formulários de ponta e lógicas de estado avançadas.",
      icon: <Code2 className="w-8 h-8 text-fuchsia-500" />,
      color: "from-fuchsia-500/20 to-pink-500/5",
      borderColor: "border-fuchsia-500/20"
    },
    {
      title: "Grids e Componentes",
      desc: "A inteligência sabe exatamente como instanciar nossos componentes UI de alta performance como DataGrids avançados, seletores, filtros e modais interativos.",
      icon: <Layers className="w-8 h-8 text-pink-500" />,
      color: "from-pink-500/20 to-rose-500/5",
      borderColor: "border-pink-500/20"
    },
    {
      title: "Contexto do Schema",
      desc: "A IA tem visão total sobre as tabelas e relacionamentos do projeto para garantir que o caso de uso gerado conectará no Supabase/banco corretamente na primeira tentativa.",
      icon: <FileJson className="w-8 h-8 text-rose-500" />,
      color: "from-rose-500/20 to-orange-500/5",
      borderColor: "border-rose-500/20"
    }
  ]

  return (
    <main className="flex-grow flex flex-col items-center relative z-10 w-full">
      {/* Background Glow */}
      <div className="absolute top-0 left-0 w-full h-[80vh] overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[20%] w-[50%] h-[50%] bg-violet-500/20 rounded-full blur-[150px]"></div>
        <div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] bg-fuchsia-500/10 rounded-full blur-[150px]"></div>
      </div>

      <div className="w-full max-w-7xl mx-auto px-6 pt-32 pb-20">
        
        {/* Hero Section */}
        <div className="text-center max-w-5xl mx-auto mb-32 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-400 font-black text-xs uppercase tracking-widest mb-8 border border-violet-500/20 shadow-sm">
            <Sparkles className="w-4 h-4" />
            MetaBuilder AI Studio
          </div>
          
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black mb-8 leading-[1.05] tracking-tight text-neutral-900 dark:text-white">
            Programação com <br />
            <span className="bg-gradient-to-r from-violet-600 to-fuchsia-600 dark:from-violet-400 dark:to-fuchsia-400 bg-clip-text text-transparent">
              Inteligência Artificial.
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-neutral-600 dark:text-neutral-400 max-w-3xl mx-auto mb-12 leading-relaxed font-medium">
            Desenvolva interfaces e fluxos de negócio em segundos. Descreva a tela que você precisa e a Inteligência Artificial configurada vai gerar código React perfeitamente integrado ao seu banco de dados.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/downloads" 
              className="group relative px-10 py-5 bg-violet-600 hover:bg-violet-700 text-white font-black text-sm uppercase tracking-widest rounded-full shadow-2xl hover:shadow-violet-500/40 transition-all flex items-center gap-3 overflow-hidden hover:scale-105"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
              Experimente Grátis
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Feature Bento Grid */}
        <div className="mb-32">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-neutral-900 dark:text-white mb-4">Como funciona a Mágica?</h2>
            <p className="text-neutral-500 text-lg">Um gerador avançado conectado ao contexto do seu banco.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {aiFeatures.map((feature, idx) => (
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

        {/* Product Preview Gallery */}
        <div className="w-full flex flex-col items-center">
          <div className="w-full max-w-6xl aspect-[16/10] bg-neutral-100 dark:bg-[#0d1117] border border-neutral-200 dark:border-neutral-800 rounded-[2rem] shadow-2xl relative overflow-hidden flex flex-col group">
            {/* Fake Window Header */}
            <div className="h-12 bg-white dark:bg-[#161b22] border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between px-4 shrink-0 z-20 relative">
               <div className="flex items-center gap-2">
                 <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                 <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                 <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
               </div>
               <div className="text-[11px] font-bold text-neutral-500 tracking-wider">AI BUILDER STUDIO</div>
               <div className="w-12"></div>
            </div>
            
            {/* Carousel Content */}
            <div className="flex-1 relative overflow-hidden bg-black flex items-center justify-center">
               {images.map((src, idx) => (
                  <img
                    key={src}
                    src={src}
                    alt={`AI Studio Demo ${idx + 1}`}
                    className={`absolute inset-0 w-full h-full object-cover object-left-top transition-opacity duration-500 ${idx === currentImg ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
                  />
               ))}

               {/* Navigation Controls */}
               <button 
                 onClick={prevImg}
                 className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 bg-black/50 hover:bg-black/80 text-white rounded-full flex items-center justify-center backdrop-blur transition-all"
               >
                 <ChevronLeft className="w-6 h-6" />
               </button>
               <button 
                 onClick={nextImg}
                 className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 bg-black/50 hover:bg-black/80 text-white rounded-full flex items-center justify-center backdrop-blur transition-all"
               >
                 <ChevronRight className="w-6 h-6" />
               </button>
               
               {/* Indicators */}
               <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2 bg-black/50 rounded-full backdrop-blur">
                 {images.map((_, idx) => (
                   <button
                     key={idx}
                     onClick={() => setCurrentImg(idx)}
                     className={`w-2.5 h-2.5 rounded-full transition-all ${idx === currentImg ? 'bg-violet-500 w-8' : 'bg-white/50 hover:bg-white'}`}
                   />
                 ))}
               </div>
            </div>
          </div>
        </div>

      </div>
    </main>
  )
}
