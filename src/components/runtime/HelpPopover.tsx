'use client'

import React, { useEffect, useRef, useState } from 'react'
import { HelpCircle } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { resolveHelp } from '@/lib/helpText'
import { cn } from '@/lib/utils'

interface HelpPopoverProps {
  /** `{ pt, en, es }` escrito pelo DEV no Studio */
  help: unknown
  className?: string
  /** `screen` é o ícone maior do cabeçalho da tela; `field` é o pequeno ao lado do rótulo */
  variant?: 'field' | 'screen'
}

/** Ícone "?" que abre a ajuda ao clicar (funciona no toque, no teclado e com leitor de tela). Não aparece sem texto. */
export function HelpPopover({ help, className, variant = 'field' }: HelpPopoverProps) {
  const { language, t } = useI18n()
  const text = resolveHelp(help, language)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('touchstart', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('touchstart', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!text) return null
  const label = t('runtime.help.open', 'Ajuda')

  return (
    <span ref={rootRef} className={cn('relative inline-flex align-middle', className)}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        title={label}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o) }}
        className={cn(
          'inline-flex items-center justify-center rounded-full text-neutral-400 hover:text-indigo-500 focus:text-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors',
          variant === 'screen' ? 'w-9 h-9 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700' : 'w-4 h-4'
        )}
      >
        <HelpCircle className={variant === 'screen' ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
      </button>
      {open && (
        <span
          role="note"
          className={cn(
            'absolute z-50 top-full mt-2 w-64 max-w-[80vw] rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3 text-xs font-medium normal-case tracking-normal text-neutral-700 dark:text-neutral-200 shadow-xl whitespace-pre-line text-left',
            variant === 'screen' ? 'right-0' : 'left-0'
          )}
        >
          {text}
        </span>
      )}
    </span>
  )
}
