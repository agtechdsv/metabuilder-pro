'use client'

import React, { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Check, CircleHelp, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { resolveHelp } from '@/lib/helpText'
import { useI18n } from '@/i18n/I18nContext'
import { PLATFORM_TOURS } from '@/lib/platformHelp/catalog'
import { toursForRoute } from '@/lib/platformHelp/routes'
import { seenTours, startPlatformTour, tourAvailable } from '@/lib/platformHelp/store'

/** Ícone de ajuda do cabeçalho nas áreas do Studio: lista os tours que existem para a tela em que a pessoa está. */
export function PlatformHelpButton() {
  const { t, language } = useI18n()
  const pathname = usePathname() || ''
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState<string[]>([])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { if (open) setSeen(seenTours()) }, [open])
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  // só nas áreas administrativas (Studio, dados, autenticação, configurações, logs...)
  if (!pathname.startsWith('/admin/')) return null
  const tours = toursForRoute(PLATFORM_TOURS, pathname)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={t('platform_help.button', 'Ajuda desta tela')}
        title={t('platform_help.button', 'Ajuda desta tela')}
        className={cn('flex h-9 w-9 items-center justify-center rounded-full border transition-colors', open ? 'border-indigo-300 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40' : 'border-neutral-200 text-neutral-500 hover:text-indigo-600 dark:border-neutral-800')}
      >
        <CircleHelp className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-[1000005] w-80 rounded-2xl border border-neutral-200 bg-white p-3 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900">
          <p className="px-1 pb-2 text-[10px] font-black uppercase tracking-widest text-neutral-400">{t('platform_help.menu_title', 'Ajuda desta tela')}</p>
          {tours.length === 0 ? (
            <p className="px-1 py-3 text-xs text-neutral-500">{t('platform_help.none', 'Ainda não há tutoriais para esta tela. Eles estão sendo preparados.')}</p>
          ) : (
            <ul className="space-y-1">
              {tours.map(tour => {
                const avail = tourAvailable(tour)
                return (
                <li key={tour.id}>
                  <button
                    type="button"
                    disabled={!avail}
                    onClick={() => { setOpen(false); startPlatformTour(tour) }}
                    className="flex w-full items-start gap-3 rounded-xl p-2 text-left hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent dark:hover:bg-neutral-800"
                  >
                    <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', seen.includes(tour.id) ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40' : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40')}>
                      {seen.includes(tour.id) ? <Check className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-black text-neutral-800 dark:text-neutral-100">{resolveHelp(tour.title, language)}</span>
                      <span className="block text-[11px] leading-snug text-neutral-500">{resolveHelp(tour.summary, language)}</span>
                      <span className="mt-0.5 block text-[10px] font-bold text-neutral-400">{tour.steps.length} {t('platform_help.steps', 'passos')}</span>
                      {!avail && <span className="mt-0.5 block text-[10px] font-bold text-amber-600">{resolveHelp(tour.needsHint, language) || t('platform_help.unavailable', 'Indisponível nesta etapa.')}</span>}
                    </span>
                  </button>
                </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
