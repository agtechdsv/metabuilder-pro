'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Sun, Moon, ChevronDown, Check } from 'lucide-react'
import { useTheme } from '@/components/CustomThemeProvider'
import { useI18n } from '@/i18n/I18nContext'

const LANGUAGES = [
  { code: 'pt', label: 'Português', flag: 'https://flagcdn.com/w80/br.png', short: 'PT' },
  { code: 'en', label: 'English', flag: 'https://flagcdn.com/w80/us.png', short: 'EN' },
  { code: 'es', label: 'Español', flag: 'https://flagcdn.com/w80/es.png', short: 'ES' },
] as const

/**
 * Tema e idioma dentro da IDE Local (como nas outras janelas do MetaBuilder). Versão compacta, no tamanho dos botões do
 * cabeçalho da IDE. A escolha vale para todas as janelas do app: as duas ficam guardadas no navegador e as janelas se avisam.
 */
export function IdeThemeLanguage() {
  const { theme, setTheme } = useTheme()
  const { language, setLanguage, t } = useI18n()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])
  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  if (!mounted) return null
  const current = LANGUAGES.find(l => l.code === language) || LANGUAGES[0]
  const light = theme === 'light'

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => setTheme(light ? 'dark' : 'light')}
        className="flex items-center justify-center w-8 h-8 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg transition-colors border border-neutral-700"
        title={light ? t('workspace_components.ide_local.theme_dark', 'Tema escuro') : t('workspace_components.ide_local.theme_light', 'Tema claro')}
        aria-label="Toggle theme"
      >
        {light ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
      </button>

      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-1.5 px-2 h-8 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg transition-colors border border-neutral-700 text-xs font-bold"
          title={t('workspace_components.ide_local.language', 'Idioma')}
        >
          <img src={current.flag} alt={current.label} className="w-4 h-4 rounded-full object-cover" />
          {current.short}
          <ChevronDown className="w-3 h-3" />
        </button>
        {open && (
          <div className="absolute right-0 mt-1 w-40 z-[100000] rounded-lg border border-neutral-700 bg-neutral-900 shadow-xl overflow-hidden">
            {LANGUAGES.map(l => (
              <button
                key={l.code}
                onClick={() => { setLanguage(l.code); setOpen(false) }}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-800 hover:text-white"
              >
                <span className="flex items-center gap-2">
                  <img src={l.flag} alt={l.label} className="w-4 h-4 rounded-full object-cover" />
                  {l.label}
                </span>
                {language === l.code && <Check className="w-3.5 h-3.5 text-indigo-400" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
