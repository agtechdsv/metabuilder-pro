'use client'

import { Layers } from 'lucide-react'
import Link from 'next/link'
import { useI18n } from '@/i18n/I18nContext'

export function Footer() {
  const { t, language } = useI18n()

  return (
    <footer className="mt-32 w-full max-w-7xl border-t border-neutral-200 dark:border-neutral-800/50 pt-12 pb-12 transition-colors">
      <div className="flex flex-col md:flex-row justify-between items-center gap-8">
        {/* Logo Section */}
        <div className="flex items-center gap-2 group cursor-default opacity-80 hover:opacity-100 transition-opacity">
          <div className="p-1.5 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <Layers className="w-5 h-5 text-blue-500" />
          </div>
          <span className="text-lg font-bold tracking-tight text-neutral-900 dark:text-white">
            MetaBuilder<span className="text-blue-500">PRO</span>
          </span>
        </div>

        {/* Development Info */}
        <div className="text-[10px] md:text-[11px] text-neutral-500 font-medium text-center tracking-wider uppercase">
          {language === 'pt' ? 'Desenvolvido por' : language === 'es' ? 'Desarrollado por' : 'Developed by'}{' '}
          <Link href="/agtech" className="text-blue-500 hover:text-blue-400 font-bold hover:underline underline-offset-4 transition-all">AGTECH ®</Link> 
          {' '}— | <span className="text-neutral-500 dark:text-neutral-400">MetadataTech de Alta Performance © 2026</span> {language === 'en' ? 'All rights reserved.' : 'Todos os direitos reservados.'}
        </div>

        {/* Legal Links */}
        <div className="flex gap-8 items-center">
          <Link href="/privacy" className="text-xs font-bold text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors tracking-widest uppercase">
            {language === 'pt' ? 'Privacidade' : language === 'es' ? 'Privacidad' : 'Privacy'}
          </Link>
          <Link href="/terms" className="text-xs font-bold text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors tracking-widest uppercase">
            {language === 'pt' ? 'Termos' : language === 'es' ? 'Términos' : 'Terms'}
          </Link>
        </div>
      </div>
    </footer>
  )
}
