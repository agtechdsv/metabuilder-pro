'use client'

import React, { useState } from 'react'
import { ThumbsDown, ThumbsUp } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { HELP_FEEDBACK_MAX_COMMENT, type HelpFeedbackZone } from '@/lib/helpFeedback'
import { cn } from '@/lib/utils'

export interface HelpFeedbackTarget {
  projectId?: string
  screen?: string
  field?: string
  zone?: HelpFeedbackZone
}

type FeedbackState = 'idle' | 'comment' | 'sending' | 'done' | 'error'

/**
 * "Isto ajudou?": 👍 grava na hora; 👎 abre um comentário opcional. O voto vai ao banco do cliente pelo servidor
 * (quem votou vem da sessão). Usado no balão do `?` e na Central de Ajuda.
 */
export function HelpFeedbackBar({ feedback, className }: { feedback: HelpFeedbackTarget; className?: string }) {
  const { language, t } = useI18n()
  const [state, setState] = useState<FeedbackState>('idle')
  const [comment, setComment] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [lastVote, setLastVote] = useState<'up' | 'down'>('down')

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

  const errorLine = state === 'error'
    ? <span className="block text-red-500">{t('runtime.help.error', 'Não foi possível enviar agora.')}{errorMsg ? ` (${errorMsg})` : ''}</span>
    : null

  return (
    <span className={cn('block text-[11px] text-neutral-500', className)} onClick={(e) => e.stopPropagation()}>
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
          {errorLine}
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
            {errorLine}
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
  )
}
