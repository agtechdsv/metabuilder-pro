'use client'

import React, { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Check, ChevronDown, CircleHelp, FoldVertical, Play, UnfoldVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { resolveHelp } from '@/lib/helpText'
import { useI18n } from '@/i18n/I18nContext'
import { PLATFORM_TOURS } from '@/lib/platformHelp/catalog'
import { toursForRoute } from '@/lib/platformHelp/routes'
import { menuSections } from '@/lib/platformHelp/menuGroups'
import { useCollapsedGroups } from '@/lib/platformHelp/useCollapsedGroups'
import { seenTours, startPlatformTour, tourAvailable, tourWrongLogic, WRONG_LOGIC_HINT } from '@/lib/platformHelp/store'

/** Ícone de ajuda do cabeçalho nas áreas do Studio: lista os tours que existem para a tela em que a pessoa está. */
export function PlatformHelpButton() {
  const { t, language } = useI18n()
  const pathname = usePathname() || ''
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState<string[]>([])
  const { collapsed, save: saveCollapsed, toggle: toggleGroup } = useCollapsedGroups()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { if (open) setSeen(seenTours()) }, [open])
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  // só nas áreas administrativas (Studio, dados, autenticação, configurações, logs...)
  if (!pathname.startsWith('/admin/') && pathname !== '/workspace') return null
  const tours = toursForRoute(PLATFORM_TOURS, pathname)
  const sections = menuSections(tours)
  const groupKeys = sections.map(sec => sec.title?.pt || '').filter(Boolean)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        data-help-id="platform.help_button"
        onClick={() => setOpen(o => !o)}
        aria-label={t('platform_help.button', 'Ajuda desta tela')}
        title={t('platform_help.button', 'Ajuda desta tela')}
        className={cn('flex h-9 w-9 items-center justify-center rounded-full border transition-colors', open ? 'border-indigo-300 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40' : 'border-neutral-200 text-neutral-500 hover:text-indigo-600 dark:border-neutral-800')}
      >
        <CircleHelp className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-[1000005] w-80 max-h-[calc(100vh-7rem)] overflow-y-auto overscroll-contain rounded-2xl border border-neutral-200 bg-white p-3 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900">
          <div className="flex items-center justify-between px-1 pb-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{t('platform_help.menu_title', 'Ajuda desta tela')}</p>
            {groupKeys.length > 1 && (
              <div className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                <button type="button" onClick={() => saveCollapsed([])} disabled={collapsed.every(k => !groupKeys.includes(k))} title={t('platform_help.expand_all', 'Expandir tudo')} aria-label={t('platform_help.expand_all', 'Expandir tudo')} className="p-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-500/10 disabled:opacity-40 disabled:hover:bg-transparent"><UnfoldVertical className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => saveCollapsed(groupKeys)} disabled={groupKeys.every(k => collapsed.includes(k))} title={t('platform_help.collapse_all', 'Recolher tudo')} aria-label={t('platform_help.collapse_all', 'Recolher tudo')} className="p-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-500/10 disabled:opacity-40 disabled:hover:bg-transparent"><FoldVertical className="w-3.5 h-3.5" /></button>
              </div>
            )}
          </div>
          {tours.length === 0 ? (
            <p className="px-1 py-3 text-xs text-neutral-500">{t('platform_help.none', 'Ainda não há tutoriais para esta tela. Eles estão sendo preparados.')}</p>
          ) : (
            sections.map((sec, si) => {
            const gk = sec.title?.pt || ''
            const closed = !!gk && collapsed.includes(gk)
            return (
            <div key={si}>
            {sec.title && (
              <button
                type="button"
                onClick={() => toggleGroup(gk)}
                aria-expanded={!closed}
                className="mt-2 flex w-full items-center gap-2 rounded-lg px-1 pb-1 pt-1 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">{resolveHelp(sec.title, language)}</span>
                <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-700" />
                <span className="text-[10px] font-bold text-neutral-400">{sec.tours.length}</span>
                <ChevronDown className={cn('h-3.5 w-3.5 text-neutral-400 transition-transform', closed && '-rotate-90')} />
              </button>
            )}
            <ul className={cn('space-y-1', closed && 'hidden')}>
              {sec.tours.map(tour => {
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
                      {!avail && <span className="mt-0.5 block text-[10px] font-bold text-amber-600">{resolveHelp(tourWrongLogic(tour) ? WRONG_LOGIC_HINT : tour.needsHint, language) || t('platform_help.unavailable', 'Indisponível nesta etapa.')}</span>}
                    </span>
                  </button>
                </li>
                )
              })}
            </ul>
            </div>
            )
            })
          )}
        </div>
      )}
    </div>
  )
}
