'use client'

import { motion } from 'framer-motion'
import { ScrollText, Database, ShieldAlert, Clock, ArrowLeft, Terminal, FileText } from 'lucide-react'
import Link from 'next/link'
import { BottomCta } from '@/components/landing/BottomCta'
import { useI18n } from '@/i18n/I18nContext'

export default function LogsFeaturePage() {
  const { t } = useI18n()

  return (
    <div className="max-w-7xl mx-auto px-6 py-20 space-y-24">
      <Link href="/" className="inline-flex items-center gap-2 text-neutral-500 hover:text-indigo-600 transition-colors mb-8 group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        {t('common.back_to_home')}
      </Link>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
        <div className="space-y-8">
          <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 border border-indigo-400/20">
            <ScrollText className="w-8 h-8" />
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter dark:text-white leading-[1]">
            {t('marketing_v2.features.logs.hero_title') || 'Auditoria & Logs.'} <br/>
            <span className="text-indigo-500">{t('marketing_v2.features.logs.hero_title_highlight') || 'Transparência Total.'}</span>
          </h1>
          <p className="text-xl text-neutral-500 dark:text-neutral-400 leading-relaxed">
            {t('marketing_v2.features.logs.hero_desc') || 'Monitore tudo em tempo real. Com suporte a logs locais no cliente ou direto no banco de dados, você tem controle total sobre o tráfego do túnel, execuções de BPM e mutações SQL.'}
          </p>
        </div>
        
        <div className="relative">
           <div className="absolute inset-0 bg-indigo-500/10 blur-[120px] rounded-full"></div>
           <div className="relative p-12 rounded-[4rem] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-3xl text-center space-y-8">
              <div className="inline-block p-6 rounded-full bg-indigo-500 text-white shadow-2xl shadow-indigo-500/20">
                 <Terminal className="w-12 h-12" />
              </div>
              <div className="space-y-2">
                 <h3 className="text-2xl font-black dark:text-white">{t('marketing_v2.features.logs.tech_title') || 'Rastreabilidade Avançada'}</h3>
                 <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('marketing_v2.features.logs.tech_desc') || 'Configure retenção customizada, selecione os tipos de logs gravados e visualize em uma interface premium direto no painel.'}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800 flex items-center gap-3">
                    <Clock className="w-4 h-4 text-indigo-500" />
                    <span className="text-[10px] font-black uppercase dark:text-white">{t('marketing_v2.features.logs.tag_realtime') || 'Tempo Real'}</span>
                 </div>
                 <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800 flex items-center gap-3">
                    <ShieldAlert className="w-4 h-4 text-indigo-500" />
                    <span className="text-[10px] font-black uppercase dark:text-white">{t('marketing_v2.features.logs.tag_security') || 'Segurança Máxima'}</span>
                 </div>
              </div>
           </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="space-y-6">
           <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
              <Database className="w-6 h-6" />
           </div>
           <h3 className="text-2xl font-black dark:text-white tracking-tight">{t('marketing_v2.features.logs.block1_title') || 'Gravação Dual: Banco ou Arquivo'}</h3>
           <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed">
             {t('marketing_v2.features.logs.block1_desc') || 'Escolha onde quer gravar os seus logs. Salve de forma estruturada no banco de dados do cliente para visualização integrada no dashboard, ou direcione tudo para arquivos locais rotacionados diariamente no servidor do cliente para auditorias externas offline.'}
           </p>
        </div>
        <div className="space-y-6">
           <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
              <FileText className="w-6 h-6" />
           </div>
           <h3 className="text-2xl font-black dark:text-white tracking-tight">{t('marketing_v2.features.logs.block2_title') || 'Zero Lock-In & Performance'}</h3>
           <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed">
             {t('marketing_v2.features.logs.block2_desc') || 'A auditoria local é processada de forma ultra rápida pelo binário do Túnel CLI. Defina políticas de retenção para expurgar registros antigos de forma automática e manter a performance de consultas ao banco sempre otimizadas.'}
           </p>
        </div>
      </section>

      <div className="p-16 rounded-[3rem] bg-indigo-600 text-white relative overflow-hidden group">
         <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
         <div className="relative z-10 text-center space-y-8">
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter">{t('marketing_v2.features.logs.footer_title') || 'Controle absoluto sobre seus dados.'}</h2>
            <p className="text-indigo-100 max-w-2xl mx-auto text-lg leading-relaxed">
               {t('marketing_v2.features.logs.footer_desc') || 'Seja depurando uma regra de negócio complexa no BPM, monitorando queries pesadas de escrita ou auditando o acesso de usuários finais, nossa engine de logs oferece a transparência necessária para operações robustas.'}
            </p>
            <BottomCta />
         </div>
      </div>
    </div>
  )
}
