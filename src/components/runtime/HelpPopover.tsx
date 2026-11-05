'use client'

import React, { useEffect, useRef, useState } from 'react'
import { HelpCircle } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { resolveHelp } from '@/lib/helpText'
import { HelpFeedbackBar, type HelpFeedbackTarget } from './HelpFeedbackBar'
import { cn } from '@/lib/utils'

interface HelpPopoverProps {
  /** `{ pt, en, es }` escrito pelo DEV no Studio */
  help: unknown
  className?: string
  /** `screen` é o ícone maior do cabeçalho da tela; `field` é o pequeno ao lado do rótulo */
  variant?: 'field' | 'screen'
  /** Com isto, a ajuda mostra "Isto ajudou?" e o voto vai para o banco do cliente. Sem projeto, não pergunta. */
  feedback?: HelpFeedbackTarget
  /** Link para a Central de Ajuda do projeto */
  centralHref?: string
}

/** Ícone "?" que abre a ajuda ao clicar (funciona no toque, no teclado e com leitor de tela). Não aparece sem texto. */
export function HelpPopover({ help, className, variant = 'field', feedback, centralHref }: HelpPopoverProps) {
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
  const canAsk = !!feedback?.projectId && !!(feedback.screen || feedback.field)

  return (
    // o clique dentro do balão não deve chegar ao cabeçalho da coluna (que ordena) nem ao rótulo
    <span ref={rootRef} onClick={(e) => e.stopPropagation()} className={cn('relative inline-flex align-middle', className)}>
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
            'absolute z-50 top-full mt-2 w-64 max-w-[80vw] rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3 text-xs font-medium normal-case tracking-normal text-neutral-700 dark:text-neutral-200 shadow-xl text-left',
            variant === 'screen' ? 'right-0' : 'left-0'
          )}
        >
          <span className="block whitespace-pre-line">{text}</span>

          {centralHref && (
            <a href={centralHref} className="mt-2 block text-[11px] font-bold text-indigo-600 hover:underline">
              {t('runtime.help.see_all', 'Ver toda a ajuda')}
            </a>
          )}

          {canAsk && <HelpFeedbackBar feedback={feedback!} className="mt-3 pt-2 border-t border-neutral-100 dark:border-neutral-800" />}
        </span>
      )}
    </span>
  )
}
