'use client'

import { useEffect, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { isTauri } from '@/utils/tauriUtils'
import { IDE_ZOOM_EVENT, getIdeZoom, stepIdeZoom } from '@/utils/ideZoom'
import { IDE_ZOOM_MAX, IDE_ZOOM_MIN, zoomPercent } from '@/lib/ideZoom'

/** Controle de zoom no cabeçalho, depois do avatar: −, % (clique volta a 100%) e +. Só aparece na IDE (Tauri). */
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

  const btn = 'flex h-7 w-7 items-center justify-center rounded-full text-neutral-500 transition-all hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-30 disabled:hover:bg-transparent dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-white'
  return (
    <div className="flex items-center gap-0.5 rounded-full border border-neutral-200 bg-white p-0.5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/50" role="group" aria-label={t('ide_zoom.label')}>
      <button type="button" className={btn} aria-label={t('ide_zoom.out')} title={t('ide_zoom.out')} disabled={zoom <= IDE_ZOOM_MIN} onClick={() => void stepIdeZoom(-1)}><Minus className="h-3.5 w-3.5" /></button>
      <button type="button" className="min-w-[2.75rem] rounded-full px-1 py-1 text-center text-[11px] font-black tabular-nums text-neutral-900 hover:bg-neutral-100 dark:text-white dark:hover:bg-white/10" aria-label={t('ide_zoom.reset')} title={t('ide_zoom.reset')} onClick={() => void stepIdeZoom(0)}>{zoomPercent(zoom)}</button>
      <button type="button" className={btn} aria-label={t('ide_zoom.in')} title={t('ide_zoom.in')} disabled={zoom >= IDE_ZOOM_MAX} onClick={() => void stepIdeZoom(1)}><Plus className="h-3.5 w-3.5" /></button>
    </div>
  )
}
