'use client'

import { useI18n } from '@/i18n/I18nContext'

export function PrivacyContent() {
  const { t } = useI18n()

  const sections = [
    {
      title: t('privacy.item1_title'),
      content: t('privacy.item1_desc')
    },
    {
      title: t('privacy.item2_title'),
      content: t('privacy.item2_desc')
    },
    {
      title: t('privacy.item3_title'),
      content: t('privacy.item3_desc'),
      highlight: true
    },
    {
      title: t('privacy.item4_title'),
      content: t('privacy.item4_desc')
    }
  ]

  return (
    <div className="space-y-10">
      <p className="text-neutral-400 text-sm leading-relaxed">
        A <span className="text-white font-bold">MetaBuilder Pro</span> valoriza a sua privacidade. Esta política descreve como tratamos as informações coletadas através do nosso ecossistema de metadados inteligente.
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
              
              {section.highlight ? (
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 relative overflow-hidden group/box">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover/box:opacity-100 transition-opacity" />
                  <p className="text-sm text-neutral-300 italic leading-relaxed relative">
                    <span className="text-white font-bold not-italic">Importante:</span> {section.content}
                  </p>
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

