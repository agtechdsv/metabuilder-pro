'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Copy, Check } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'

interface AboutModalProps {
  isOpen: boolean
  onClose: () => void
}

/** Sobre: versão da IDE (ou "aplicativo web"), empresa e um botão que copia os dados para o suporte (sem segredos). */
export function AboutModal({ isOpen, onClose }: AboutModalProps) {
  const { t, language } = useI18n()
  const [mounted, setMounted] = useState(false)
  const [version, setVersion] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!isOpen) return
    setCopied(false)
    let alive = true
    ;(async () => {
      try {
        const { isTauri } = await import('@tauri-apps/api/core')
        const inIframe = typeof window !== 'undefined' && window.self !== window.top
        if (!isTauri() || inIframe) { if (alive) setVersion(null); return }
        const { getVersion } = await import('@tauri-apps/api/app')
        const v = await getVersion()
        if (alive) setVersion(v)
      } catch {
        if (alive) setVersion(null)
      }
    })()
    return () => { alive = false }
  }, [isOpen])

  if (!mounted || !isOpen) return null

  const platform = typeof navigator !== 'undefined' ? navigator.platform || '' : ''
  const editionLabel = version ? t('footer.about_version_ide', 'Versão da IDE') : t('footer.about_version_web', 'Edição')
  const siteVersion = process.env.NEXT_PUBLIC_APP_VERSION || ''
  const editionValue = version
    ? `v${version}`
    : `${t('footer.about_web_edition', 'Aplicativo web')}${siteVersion ? ` · v${siteVersion}` : ''}`

  const copyInfo = async () => {
    const lines = [
      'MetaBuilder PRO',
      `${editionLabel}: ${editionValue}`,
      `${t('footer.about_system', 'Sistema')}: ${platform}`,
      `Idioma: ${language}`,
      `Data: ${new Date().toISOString()}`,
    ]
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* sem permissão de área de transferência: o texto continua visível na tela */ }
  }

  return createPortal(
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose} data-testid="about-modal">
      <div
        className="w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between p-6 pb-3">
          <div className="flex items-center gap-3">
            <img src="/icon-desktop-square.png" className="w-12 h-12 object-contain" alt="MetaBuilder PRO" />
            <div>
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white">{t('footer.about_title', 'Sobre o MetaBuilder PRO')}</h3>
              <p className="text-xs text-neutral-500" data-testid="about-version">{editionLabel}: <strong>{editionValue}</strong></p>
            </div>
          </div>
          <button onClick={onClose} aria-label={t('footer.about_close', 'Fechar')} className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pb-4 text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
          <p className="mb-3">{t('footer.about_description', 'Studio low-code que monta telas, automações e relatórios a partir de configuração.')}</p>
          <p className="text-xs text-neutral-500">© 2026 {t('footer.about_company', 'AG Tech Serviços de Informática Ltda.')}</p>
        </div>

        <div className="flex items-center justify-between gap-3 p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
          <button
            onClick={copyInfo}
            data-testid="about-copy"
            className="flex items-center gap-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? t('footer.about_copied', 'Copiado!') : t('footer.about_copy', 'Copiar informações para o suporte')}
          </button>
          <button onClick={onClose} className="px-5 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-bold rounded-lg hover:opacity-90">
            {t('footer.about_close', 'Fechar')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
