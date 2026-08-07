'use client'

import { Mail, Zap } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'

export function AgTechContent() {
  const { t } = useI18n()

  return (
    <div className="space-y-12">
      <div className="flex justify-center mb-6">
        <img src="/Logo-AGTech.jpeg" alt="AGTech" className="w-28 h-28 object-contain rounded-2xl shadow-md border border-neutral-100 dark:border-neutral-800" />
      </div>
      <div className="space-y-6">
        <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
          {t('agtech.p1')}
        </p>

        <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
          {t('agtech.p2')}
        </p>

        <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
          {t('agtech.p3')}
        </p>
      </div>

      <div className="space-y-6">
        <div className="text-center space-y-2">
          <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block">
            {t('agtech.cta_label')}
          </span>
          <div className="h-px w-12 bg-indigo-500/30 mx-auto" />
        </div>

        <a
          href="mailto:engenharia@metabuilderpro.com"
          className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-2xl shadow-indigo-600/30 active:scale-[0.98] group"
        >
          <Mail className="w-4 h-4 group-hover:scale-110 transition-transform" />
          {t('agtech.cta_button')}
        </a>
      </div>
    </div>
  )
}

