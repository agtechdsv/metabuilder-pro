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
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <span className="text-base font-bold tracking-tight text-neutral-900 dark:text-white">
            MetaBuilder<span className="text-indigo-600">PRO</span>
          </span>
        </div>

        {/* Centro: Info Consolidada */}
        <div className="flex items-center gap-2 text-sm font-medium text-neutral-400 dark:text-neutral-500">
          <span>{language === 'pt' ? 'Desenvolvido por' : language === 'es' ? 'Desarrollado por' : 'Developed by'}</span>
          <button 
            onClick={() => setLegalType('agtech')}
            className="text-indigo-600 font-bold hover:scale-105 transition-transform"
          >
            AGTech ®
          </button>
          <span className="mx-1 opacity-30">|</span>
          <span>MetadataTech {language === 'en' ? 'High Performance' : 'de Alta Performance'} © 2026</span>
          <span className="ml-1">{language === 'en' ? 'All rights reserved.' : 'Todos os direitos reservados.'}</span>
        </div>

        {/* Lado Direito: Links Legais */}
        <div className="flex items-center gap-6">
          <button 
            onClick={() => setLegalType('privacy')}
            className="text-sm font-bold text-neutral-400 dark:text-neutral-500 hover:text-indigo-600 hover:underline underline-offset-4 transition-all cursor-pointer"
          >
            {language === 'pt' ? 'Privacidade' : language === 'es' ? 'Privacidad' : 'Privacy'}
          </button>
          <button 
            onClick={() => setLegalType('terms')}
            className="text-sm font-bold text-neutral-400 dark:text-neutral-500 hover:text-indigo-600 hover:underline underline-offset-4 transition-all cursor-pointer"
          >
            {language === 'pt' ? 'Termos' : language === 'es' ? 'Términos' : 'Terms'}
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

