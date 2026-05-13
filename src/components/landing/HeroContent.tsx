'use client'

import { motion } from 'framer-motion'
import { Database, ShieldCheck, Layers, Zap } from 'lucide-react'
import { HeroActions } from '@/components/landing/HeroActions'
import { useI18n } from '@/i18n/I18nContext'

interface HeroContentProps {
  user: any
}

export function HeroContent({ user }: HeroContentProps) {
  const { t } = useI18n()

  const features = [
    { 
      title: t('features.dynamic_title'), 
      desc: t('features.dynamic_desc'),
      icon: <Database className="w-6 h-6 text-blue-400" />
    },
    { 
      title: t('features.nocode_title'), 
      desc: t('features.nocode_desc'),
      icon: <Layers className="w-6 h-6 text-indigo-400" />
    },
    { 
      title: t('features.enterprise_title'), 
      desc: t('features.enterprise_desc'),
      icon: <ShieldCheck className="w-6 h-6 text-emerald-400" />
    },
  ]

  return (
    <div className="z-10 max-w-7xl w-full flex flex-col items-center gap-20 py-20">
      <div className="flex flex-col gap-10 text-center items-center max-w-4xl">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 dark:text-indigo-400 text-[11px] uppercase tracking-widest font-black"
        >
          <Zap className="w-4 h-4 fill-indigo-500" />
          A Engine de Software do Futuro
        </motion.div>
        
        <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.1] text-black dark:text-white transition-colors">
          Construa Apps <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500">
            Enterprise
          </span> <br/>
          em Segundos.
        </h1>
        
        <p className="text-xl md:text-2xl text-neutral-600 dark:text-neutral-400 leading-relaxed max-w-3xl font-medium">
          Acelere sua entrega técnica com o MetaBuilderPRO. Conecte bancos legados, use IA para gerar interfaces premium e gerencie múltiplos projetos em uma única plataforma whitelabel.
        </p>

        <HeroActions user={user} />
      </div>
      
      {/* Visual Showcase / Mockup */}
      <motion.div 
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.8 }}
        className="relative w-full aspect-video max-w-6xl rounded-[3rem] overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-3xl bg-neutral-100 dark:bg-neutral-900"
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent z-10 pointer-events-none"></div>
        <img 
          src="/metabuilder_showcase_mockup.png" 
          alt="MetaBuilderPRO Interface" 
          className="w-full h-full object-cover"
        />
        {/* Decorative elements over image */}
        <div className="absolute top-10 left-10 z-20 flex gap-4">
           <div className="px-4 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
             Runtime Online
           </div>
        </div>
      </motion.div>
    </div>
  )
}
