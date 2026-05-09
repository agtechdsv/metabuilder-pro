'use client'

import { useI18n } from '@/i18n/I18nContext'
import { AlertTriangle } from 'lucide-react'

export function TermsContent() {
  const { t } = useI18n()

  const sections = [
    {
      title: t('terms.item1_title'),
      content: t('terms.item1_desc')
    },
    {
      title: t('terms.item2_title'),
      content: t('terms.item2_desc'),
      warning: true
    },
    {
      title: t('terms.item3_title'),
      content: t('terms.item3_desc')
    },
    {
      title: t('terms.item4_title'),
      content: t('terms.item4_desc')
    }
  ]

  return (
    <div className="space-y-10">
      <p className="text-neutral-400 text-sm leading-relaxed">
        Bem-vindo ao <span className="text-white font-bold">MetaBuilder Pro</span>, o ecossistema de metadados de alta performance. Ao utilizar este sistema, você concorda com os seguintes termos:
      </p>

      <div className="space-y-8">
        {sections.map((section, idx) => (
          <div key={idx} className="relative pl-12 group">
            {/* Number Circle */}
            <div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-xs font-black shadow-[0_0_20px_rgba(99,102,241,0.1)] group-hover:scale-110 transition-transform">
              {idx + 1}
            </div>

            <div className="space-y-3">
              <h3 className="text-white font-black text-sm uppercase tracking-widest">
                {section.title}
              </h3>
              
              {section.warning ? (
                <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/20 relative overflow-hidden group/box">
                  <div className="flex gap-4 items-start relative">
                    <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-200/80 italic leading-relaxed">
                      <span className="text-amber-500 font-bold not-italic">Aviso Legal:</span> {section.content}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-neutral-400 leading-relaxed">
                  {section.content}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

