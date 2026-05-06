'use client'

import { Mail } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'

export function AgTechContent() {
  const { t } = useI18n()

  return (
    <div className="space-y-8 text-neutral-600 dark:text-neutral-300">
      <div className="space-y-6">
        <p className="text-base leading-relaxed">
          {t('agtech.p1')}
        </p>
        
        <p className="text-base leading-relaxed">
          {t('agtech.p2')}
        </p>
        
        <p className="text-base leading-relaxed">
          {t('agtech.p3')}
        </p>
      </div>

      <div className="pt-6 border-t border-neutral-100 dark:border-neutral-800 space-y-4">
        <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] text-center">
          {t('agtech.cta_label')}
        </p>
        
        <a 
          href="mailto:contato@agtech.com"
          className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-xl shadow-blue-900/20 active:scale-[0.98] group"
        >
          <Mail className="w-5 h-5 group-hover:scale-110 transition-transform" />
          {t('agtech.cta_button')}
        </a>
      </div>
    </div>
  )
}
