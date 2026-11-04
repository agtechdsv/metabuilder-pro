'use client'

import React, { useState } from 'react'
import { HELP_LANGS, HelpLang, HelpText, normalizeHelp } from '@/lib/helpText'
import { cn } from '@/lib/utils'

interface HelpTextEditorProps {
  value: unknown
  onChange: (value: HelpText) => void
  placeholder?: string
  rows?: number
}

const LANG_LABEL: Record<HelpLang, string> = { pt: 'PT', en: 'EN', es: 'ES' }

/** Um campo de texto por idioma (PT / EN / ES). Guarda só os idiomas preenchidos. */
export function HelpTextEditor({ value, onChange, placeholder, rows = 3 }: HelpTextEditorProps) {
  const [lang, setLang] = useState<HelpLang>('pt')
  const help = normalizeHelp(value)
  // enquanto digita, o texto não pode ser "limpo" (espaços no fim somem ao normalizar), então lê o valor bruto
  const raw = value && typeof value === 'object' ? (value as Record<string, string>)[lang] ?? '' : lang === 'pt' && typeof value === 'string' ? value : ''

  const update = (text: string) => {
    const current = value && typeof value === 'object' ? { ...(value as Record<string, string>) } : { ...help }
    current[lang] = text
    onChange(current as HelpText)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        {HELP_LANGS.map(l => (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            className={cn(
              'px-2.5 py-1 rounded-lg text-[9px] font-black tracking-widest transition-colors',
              lang === l ? 'bg-indigo-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-700'
            )}
          >
            {LANG_LABEL[l]}{help[l] ? ' ●' : ''}
          </button>
        ))}
      </div>
      <textarea
        value={raw}
        rows={rows}
        maxLength={2000}
        onChange={(e) => update(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-medium focus:border-indigo-500 outline-none transition-all resize-y"
      />
    </div>
  )
}
