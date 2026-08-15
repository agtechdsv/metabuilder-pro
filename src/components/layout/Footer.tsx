'use client'

import { Layers } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '@/i18n/I18nContext'
import { LegalModal } from '@/components/legal/LegalModal'
import { PrivacyContent } from '@/components/legal/PrivacyContent'
import { TermsContent } from '@/components/legal/TermsContent'
import { AgTechContent } from '@/components/legal/AgTechContent'

export function Footer() {
  const { t, language } = useI18n()
  const [legalType, setLegalType] = useState<'privacy' | 'terms' | 'agtech' | null>(null)

  return (
    <footer className="w-full border-t border-neutral-200 dark:border-neutral-900/50 pt-3 pb-3 mt-auto">
      <div className="w-full px-10 flex flex-col md:flex-row items-center justify-between gap-8 md:gap-4">

        {/* Lado Esquerdo: Logo */}
        <div className="flex items-center gap-3">
          <img src="/icon-desktop-square.png" className="w-8 h-8 object-contain drop-shadow-sm" alt="Logo" />
          <span className="text-base font-bold tracking-tight text-neutral-900 dark:text-white">
            MetaBuilder<span className="text-indigo-600">PRO</span>
          </span>
        </div>

        {/* Centro: Info Consolidada */}
        <div className="flex flex-col items-center gap-1 text-[11px] font-medium text-neutral-400 dark:text-neutral-500">
          <div className="flex items-center gap-1">
             <span>{t('footer.copyright', '© 2026 AG Tech Serviços de Informática Ltda. Todos os direitos reservados.')}</span>
          </div>
          <div className="flex items-center gap-1">
             <span>{t('footer.trademark', 'MetaBuilder PRO™ é uma marca comercial da')}</span>
             <button 
               onClick={() => setLegalType('agtech')}
               className="text-indigo-600 dark:text-indigo-400 font-bold hover:scale-105 transition-transform"
             >
               AG Tech
             </button>
          </div>
        </div>

        {/* Lado Direito: Links Legais */}
        <div className="flex items-center gap-6">
          <button 
            onClick={() => setLegalType('privacy')}
            className="text-sm font-bold text-neutral-400 dark:text-neutral-500 hover:text-indigo-600 hover:underline underline-offset-4 transition-all cursor-pointer"
          >
            {t('footer.privacy')}
          </button>
          <button 
            onClick={() => setLegalType('terms')}
            className="text-sm font-bold text-neutral-400 dark:text-neutral-500 hover:text-indigo-600 hover:underline underline-offset-4 transition-all cursor-pointer"
          >
            {t('footer.terms')}
          </button>
        </div>
      </div>

      {/* Modais Legais */}
      <LegalModal
        isOpen={legalType !== null}
        onClose={() => setLegalType(null)}
        title={
          legalType === 'privacy' ? t('privacy.title') :
            legalType === 'terms' ? t('terms.title') :
              t('agtech.title')
        }
      >
        {legalType === 'privacy' && <PrivacyContent />}
        {legalType === 'terms' && <TermsContent />}
        {legalType === 'agtech' && <AgTechContent />}
      </LegalModal>
    </footer>
  )
}

