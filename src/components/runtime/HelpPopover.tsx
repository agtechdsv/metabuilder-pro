'use client'

import React, { useEffect, useRef, useState } from 'react'
import { HelpCircle, ThumbsDown, ThumbsUp } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { resolveHelp } from '@/lib/helpText'
import { HELP_FEEDBACK_MAX_COMMENT } from '@/lib/helpFeedback'
import { cn } from '@/lib/utils'

interface HelpPopoverProps {
  /** `{ pt, en, es }` escrito pelo DEV no Studio */
  help: unknown
  className?: string
  /** `screen` é o ícone maior do cabeçalho da tela; `field` é o pequeno ao lado do rótulo */
  variant?: 'field' | 'screen'
  /** Com isto, a ajuda mostra "Isto ajudou?" e o voto vai para o banco do cliente. Sem projeto, não pergunta. */
  feedback?: { projectId?: string; screen?: string; field?: string; zone?: 'filter' | 'grid' | 'form' | 'screen' }
  /** Link para a Central de Ajuda do projeto */
  centralHref?: string
}

type FeedbackState = 'idle' | 'comment' | 'sending' | 'done' | 'error'

/** Ícone "?" que abre a ajuda ao clicar (funciona no toque, no teclado e com leitor de tela). Não aparece sem texto. */
export function HelpPopover({ help, className, variant = 'field', feedback, centralHref }: HelpPopoverProps) {
  const { language, t } = useI18n()
  const text = resolveHelp(help, language)
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<FeedbackState>('idle')
  const [comment, setComment] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [lastVote, setLastVote] = useState<'up' | 'down'>('down')
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

  const send = async (vote: 'up' | 'down', withComment?: string) => {
    setLastVote(vote)
    setState('sending')
    try {
      const res = await fetch('/api/v1/help-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...feedback, vote, comment: withComment || undefined, language }),
      })
      if (res.ok) { setState('done'); return }
      const body = await res.json().catch(() => null)
      setErrorMsg(typeof body?.error === 'string' ? body.error : '')
      setState('error')
    } catch {
      setErrorMsg('')
      setState('error')
    }
  }

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

          {canAsk && (
            <span className="mt-3 pt-2 border-t border-neutral-100 dark:border-neutral-800 block text-[11px] text-neutral-500">
              {state === 'done' ? (
                <span>{t('runtime.help.thanks', 'Obrigado pelo retorno!')}</span>
              ) : state === 'comment' || (lastVote === 'down' && (state === 'sending' || state === 'error')) ? (
                <span className="block space-y-2">
                  <span className="block">{t('runtime.help.what_missing', 'O que faltou? (opcional)')}</span>
                  <textarea
                    value={comment}
                    maxLength={HELP_FEEDBACK_MAX_COMMENT}
                    rows={2}
                    onChange={e => setComment(e.target.value)}
                    className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 px-2 py-1 text-xs outline-none focus:border-indigo-500"
                  />
                  {state === 'error' && <span className="block text-red-500">{t('runtime.help.error', 'Não foi possível enviar agora.')}{errorMsg ? ` (${errorMsg})` : ''}</span>}
                  <button
                    type="button"
                    disabled={state === 'sending'}
                    onClick={() => send('down', comment.trim())}
                    className="rounded-lg bg-indigo-600 px-3 py-1 text-[11px] font-bold text-white disabled:opacity-50"
                  >
                    {t('runtime.help.send', 'Enviar')}
                  </button>
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span className="flex-1">
                    {t('runtime.help.was_helpful', 'Isto ajudou?')}
                    {state === 'error' && <span className="block text-red-500">{t('runtime.help.error', 'Não foi possível enviar agora.')}{errorMsg ? ` (${errorMsg})` : ''}</span>}
                  </span>
                  <button type="button" aria-label={t('runtime.help.yes', 'Sim')} title={t('runtime.help.yes', 'Sim')} onClick={() => send('up')} className="p-1 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-950 hover:text-emerald-600">
                    <ThumbsUp className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" aria-label={t('runtime.help.no', 'Não')} title={t('runtime.help.no', 'Não')} onClick={() => setState('comment')} className="p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600">
                    <ThumbsDown className="w-3.5 h-3.5" />
                  </button>
                </span>
              )}
            </span>
          )}
        </span>
      )}
    </span>
  )
}
