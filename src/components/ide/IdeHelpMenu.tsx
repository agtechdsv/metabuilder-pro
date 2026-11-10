'use client'

import React, { useEffect, useRef, useState } from 'react'
import { CircleHelp, Play } from 'lucide-react'
import { resolveHelp } from '@/lib/helpText'
import { useI18n } from '@/i18n/I18nContext'
import { PLATFORM_TOURS } from '@/lib/platformHelp/catalog'
import { startPlatformTour, tourAvailable } from '@/lib/platformHelp/store'

/** Rota "virtual" dos tours da IDE Local: a janela da IDE não tem as páginas do Studio, então estes tours têm o próprio menu. */
export const IDE_TOUR_ROUTE = '/ide-local'

/** Ícone de ajuda do cabeçalho da IDE Local: lista os tours da IDE e do Ejetar & Sincronizar. */
export function IdeHelpMenu() {
  const { t, language } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  const tours = PLATFORM_TOURS.filter(x => x.route === IDE_TOUR_ROUTE)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        data-help-id="ide.help"
        onClick={() => setOpen(o => !o)}
        title={t('platform_help.button', 'Ajuda desta tela')}
        aria-label={t('platform_help.button', 'Ajuda desta tela')}
        className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-colors ${open ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400' : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-700'}`}
      >
        <CircleHelp className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-[1000010] w-80 max-h-[70vh] overflow-y-auto rounded-2xl border border-neutral-700 bg-neutral-900 p-3 shadow-2xl">
          <p className="px-1 pb-2 text-[10px] font-black uppercase tracking-widest text-neutral-500">{t('platform_help.menu_title', 'Ajuda desta tela')}</p>
          <ul className="space-y-1">
            {tours.map(tour => (
              <li key={tour.id}>
                <button
                  type="button"
                  disabled={!tourAvailable(tour)}
                  onClick={() => { setOpen(false); startPlatformTour(tour) }}
                  className="flex w-full items-start gap-3 rounded-xl p-2 text-left hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-300"><Play className="h-3 w-3" /></span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-neutral-100">{resolveHelp(tour.title, language)}</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-neutral-400">{resolveHelp(tour.summary, language)}</span>
                    <span className="mt-0.5 block text-[10px] font-semibold text-neutral-500">{tour.steps.length} {t('platform_help.steps', 'passos')}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
