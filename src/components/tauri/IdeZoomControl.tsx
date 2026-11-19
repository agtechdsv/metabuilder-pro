'use client'

import { useEffect, useState } from 'react'
import { Minus, Plus, ZoomIn } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { isTauri } from '@/utils/tauriUtils'
import { IDE_ZOOM_EVENT, getIdeZoom, stepIdeZoom } from '@/utils/ideZoom'
import { IDE_ZOOM_MAX, IDE_ZOOM_MIN, zoomPercent } from '@/lib/ideZoom'

/** Linha do menu do usuário com −, % (volta a 100%) e +. Só aparece na IDE (Tauri). */
export function IdeZoomControl() {
  const { t } = useI18n()
  const [desktop, setDesktop] = useState(false)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    if (!isTauri()) return
    setDesktop(true)
    setZoom(getIdeZoom())
    const on = (e: Event) => setZoom(Number((e as CustomEvent).detail) || 1)
    window.addEventListener(IDE_ZOOM_EVENT, on)
    return () => window.removeEventListener(IDE_ZOOM_EVENT, on)
  }, [])

  if (!desktop) return null

  const btn = 'flex h-8 w-8 items-center justify-center rounded-xl border border-neutral-200 text-neutral-600 transition-all hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-white/5'
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <div className="rounded-xl bg-neutral-100 p-2 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"><ZoomIn className="h-4 w-4" /></div>
      <span className="flex-1 text-sm font-bold text-neutral-600 dark:text-neutral-300">{t('ide_zoom.label')}</span>
      <button type="button" className={btn} aria-label={t('ide_zoom.out')} title={t('ide_zoom.out')} disabled={zoom <= IDE_ZOOM_MIN} onClick={() => void stepIdeZoom(-1)}><Minus className="h-3.5 w-3.5" /></button>
      <button type="button" className="min-w-[3.25rem] rounded-xl px-1 py-1.5 text-center text-xs font-black tabular-nums text-neutral-900 hover:bg-neutral-100 dark:text-white dark:hover:bg-white/5" aria-label={t('ide_zoom.reset')} title={t('ide_zoom.reset')} onClick={() => void stepIdeZoom(0)}>{zoomPercent(zoom)}</button>
      <button type="button" className={btn} aria-label={t('ide_zoom.in')} title={t('ide_zoom.in')} disabled={zoom >= IDE_ZOOM_MAX} onClick={() => void stepIdeZoom(1)}><Plus className="h-3.5 w-3.5" /></button>
    </div>
  )
}
