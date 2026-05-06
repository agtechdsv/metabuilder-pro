'use client'

import { Database, ShieldCheck, Layers } from 'lucide-react'
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
    <div className="z-10 max-w-5xl w-full flex flex-col gap-12 mt-12">
      <div className="flex flex-col gap-6 text-center md:text-left max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] uppercase tracking-wider font-bold w-fit self-center md:self-start">
          <ShieldCheck className="w-3.5 h-3.5" />
          {t('hero.badge')}
        </div>
        
        <h1 className="text-5xl md:text-8xl font-extrabold tracking-tighter leading-[1] py-2 text-black dark:text-white transition-colors">
          {t('hero.title_part1')} <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500">
            {t('hero.title_part2')}
          </span>
        </h1>
        
        <p className="text-lg md:text-xl text-neutral-600 dark:text-neutral-400 leading-relaxed max-w-2xl transition-colors">
          {t('hero.subtitle')}
        </p>

        <HeroActions user={user} />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-12">
        {features.map((feature, i) => (
          <div key={i} className="group p-8 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] bg-neutral-100/50 dark:bg-neutral-900/40 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/40 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all duration-500 backdrop-blur-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="mb-6 p-4 bg-white dark:bg-neutral-950 rounded-2xl w-fit border border-neutral-200 dark:border-neutral-800 group-hover:border-neutral-300 dark:group-hover:border-neutral-700 group-hover:scale-110 transition-all duration-500 shadow-inner">
              {feature.icon}
            </div>
            <h3 className="text-xl font-bold mb-3 text-neutral-900 dark:text-neutral-100 group-hover:text-black dark:group-hover:text-white transition-colors">{feature.title}</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed group-hover:text-neutral-700 dark:group-hover:text-neutral-300 transition-colors">{feature.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
