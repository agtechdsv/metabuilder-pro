'use client'

import React from 'react'
import { Check, Eye, ListVideo, Move, Pause, Pencil, Play, Plus, Repeat, Search, Trash2 } from 'lucide-react'
import { resolveHelp } from '@/lib/helpText'
import type { Tour, TourAction } from '@/lib/interactiveHelp/types'
import { cn } from '@/lib/utils'
import { HelpFeedbackBar } from './HelpFeedbackBar'

type T = (key: string, fallback?: string) => string

export const ACTION_ICON: Record<TourAction, React.ComponentType<{ className?: string }>> = {
  search: Search, view: Eye, create: Plus, edit: Pencil, move: Move, delete: Trash2,
}

function ActionBadge({ action, tone }: { action: TourAction; tone: 'next' | 'done' | 'idle' }) {
  const Icon = ACTION_ICON[action]
  return (
    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
      tone === 'next' ? 'bg-indigo-600 text-white' : tone === 'done' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50' : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800')}>
      {tone === 'done' ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
    </span>
  )
}

/** Fila em miniatura: concluídos (✓), o próximo em destaque e os pendentes. */
function QueueList({ queue, doneUpTo, nextIndex, language }: { queue: Tour[]; doneUpTo: number; nextIndex: number | null; language: string }) {
  return (
    <ol className="space-y-1">
      {queue.map((q, i) => {
        const done = i <= doneUpTo
        const next = i === nextIndex
        return (
          <li key={q.id} className={cn('flex items-center gap-2 text-[11px]', done ? 'text-emerald-600' : next ? 'font-black text-indigo-600' : 'text-neutral-400')}>
            <span className={cn('flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black', done ? 'bg-emerald-100 dark:bg-emerald-950/50' : next ? 'bg-indigo-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800')}>
              {done ? <Check className="h-2.5 w-2.5" /> : i + 1}
            </span>
            <span className="truncate">{resolveHelp(q.title, language) || q.id}</span>
          </li>
        )
      })}
    </ol>
  )
}

const CARD = 'absolute bottom-4 right-4 z-10 w-[390px] max-w-[calc(100%-2rem)] rounded-2xl border border-neutral-200 bg-white p-4 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900 animate-in fade-in slide-in-from-bottom-4 duration-300'

/** Contagem regressiva em anel; o traço avança por transição de CSS, então o movimento é contínuo. */
function CountdownRing({ remaining, total, held }: { remaining: number; total: number; held: boolean }) {
  const r = 18
  const c = 2 * Math.PI * r
  const offset = c * (1 - Math.max(0, remaining) / Math.max(1, total))
  return (
    <span className="relative flex h-11 w-11 shrink-0 items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 44 44" aria-hidden="true">
        <circle cx="22" cy="22" r={r} fill="none" strokeWidth="3" className="stroke-neutral-200 dark:stroke-neutral-700" />
        <circle cx="22" cy="22" r={r} fill="none" strokeWidth="3" strokeLinecap="round" className="stroke-indigo-600"
          style={{ strokeDasharray: c, strokeDashoffset: held ? c * 0.0 : offset, transition: 'stroke-dashoffset 1s linear' }} />
      </svg>
      {held ? <Pause className="h-3.5 w-3.5 text-indigo-600" /> : <span className="text-xs font-black text-neutral-700 dark:text-neutral-200">{Math.max(0, remaining)}</span>}
    </span>
  )
}

interface UpNextProps {
  finished: Tour
  next: Tour
  queue: Tour[]
  index: number
  remaining: number
  total: number
  held: boolean
  language: string
  t: T
  onPlayNow: () => void
  onHold: () => void
  onResume: () => void
  onChooseAnother: () => void
}

/** "A seguir": aparece quando um tutorial termina e ainda há outros na fila (como o fim de vídeo do YouTube). */
export function UpNextCard({ finished, next, queue, index, remaining, total, held, language, t, onPlayNow, onHold, onResume, onChooseAnother }: UpNextProps) {
  return (
    <div className={CARD} role="status" aria-live="polite">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">{t('runtime.tour.up_next', 'A seguir')}</span>
        <span className="text-[10px] font-bold text-neutral-400">{t('runtime.tour.sequence', 'Tutorial {current} de {total}').replace('{current}', String(index + 2)).replace('{total}', String(queue.length))}</span>
      </div>

      <p className="mb-3 flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
        <Check className="h-3.5 w-3.5" /> {t('runtime.tour.finished', 'Concluído')}: <span className="truncate text-neutral-500">{resolveHelp(finished.title, language)}</span>
      </p>

      <div className="mb-3 flex items-center gap-3">
        <ActionBadge action={next.action} tone="next" />
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-neutral-900 dark:text-white">{resolveHelp(next.title, language) || next.id}</p>
          <p className="text-[11px] text-neutral-400">{next.steps.length} {t('runtime.tour.steps', 'passos')}</p>
        </div>
      </div>

      {queue.length > 2 && (
        <div className="mb-3 rounded-xl bg-neutral-50 p-2.5 dark:bg-neutral-800/60">
          <QueueList queue={queue} doneUpTo={index} nextIndex={index + 1} language={language} />
        </div>
      )}

      <div className="flex items-center gap-3">
        <CountdownRing remaining={remaining} total={total} held={held} />
        <p className="flex-1 text-[11px] font-bold text-neutral-500">
          {held ? t('runtime.tour.held', 'Sequência pausada') : t('runtime.tour.starts_in', 'Começa em {seconds}s').replace('{seconds}', String(Math.max(0, remaining)))}
        </p>
        {held ? (
          <>
            <button type="button" onClick={onChooseAnother} className="rounded-lg px-3 py-2 text-[11px] font-bold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">{t('runtime.tour.choose_another', 'Escolher outro')}</button>
            <button type="button" onClick={onResume} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-[11px] font-black text-white hover:bg-indigo-500"><Play className="h-3 w-3" />{t('runtime.tour.resume_sequence', 'Continuar')}</button>
          </>
        ) : (
          <>
            <button type="button" onClick={onHold} className="rounded-lg px-3 py-2 text-[11px] font-bold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">{t('runtime.tour.cancel', 'Cancelar')}</button>
            <button type="button" onClick={onPlayNow} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-[11px] font-black text-white hover:bg-indigo-500"><Play className="h-3 w-3" />{t('runtime.tour.play_now', 'Começar agora')}</button>
          </>
        )}
      </div>
    </div>
  )
}

interface DoneProps {
  queue: Tour[]
  language: string
  t: T
  projectId?: string
  viewId?: string
  onReplayAll: () => void
  onChooseAnother: () => void
}

/** Fim da fila: o que foi visto, de novo, escolher outro e o "Isto ajudou?". */
export function DoneCard({ queue, language, t, projectId, viewId, onReplayAll, onChooseAnother }: DoneProps) {
  return (
    <div className={CARD} role="status" aria-live="polite">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50"><Check className="h-4 w-4" /></span>
        <div>
          <p className="text-sm font-black text-neutral-900 dark:text-white">{queue.length > 1 ? t('runtime.tour.done_all', 'Você viu todos os tutoriais selecionados') : t('runtime.tour.done_one', 'Tutorial concluído')}</p>
          <p className="text-[11px] text-neutral-400">{queue.length} {queue.length > 1 ? t('runtime.tour.tutorials', 'tutoriais') : t('runtime.tour.tutorial', 'tutorial')}</p>
        </div>
      </div>

      {queue.length > 1 && (
        <div className="mb-3 rounded-xl bg-neutral-50 p-2.5 dark:bg-neutral-800/60">
          <QueueList queue={queue} doneUpTo={queue.length - 1} nextIndex={null} language={language} />
        </div>
      )}

      <div className="mb-3 flex gap-2">
        <button type="button" onClick={onReplayAll} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-[11px] font-black text-white hover:bg-indigo-500">
          <Repeat className="h-3 w-3" />{t('runtime.tour.replay', 'Reproduzir de novo')}
        </button>
        <button type="button" onClick={onChooseAnother} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-[11px] font-bold text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800">
          <ListVideo className="h-3 w-3" />{t('runtime.tour.choose_another', 'Escolher outro')}
        </button>
      </div>

      {projectId && viewId && <HelpFeedbackBar feedback={{ projectId, screen: viewId, zone: 'tutorial' }} className="border-t border-neutral-100 pt-3 dark:border-neutral-800" />}
    </div>
  )
}
