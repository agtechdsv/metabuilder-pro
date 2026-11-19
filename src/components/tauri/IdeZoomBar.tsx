'use client'

import { useEffect, useRef, useState } from 'react'
import { GripVertical, Minus, Plus, X } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { isTauri } from '@/utils/tauriUtils'
import { IDE_ZOOM_EVENT, getIdeZoom, stepIdeZoom } from '@/utils/ideZoom'
import { ZOOM_BAR_EVENT, getZoomBar, setZoomBar } from '@/utils/ideZoomBar'
import { IDE_ZOOM_MAX, IDE_ZOOM_MIN, zoomPercent } from '@/lib/ideZoom'
import { DEFAULT_ZOOM_BAR, ZOOM_BAR_SIZE, barCssPosition, fractionsFromCssPosition, type ZoomBarState } from '@/lib/ideZoomBar'

/**
 * Barra flutuante de zoom (− % +), ligada pelo ícone do cabeçalho. Tamanho e lugar fixos NA TELA: ela é desenhada com o inverso do zoom e a
 * posição é uma fração da janela, então não "acompanha" o zoom e o usuário pode clicar várias vezes no mesmo botão. Arrasta-se pela alça.
 * Só existe na IDE (Tauri).
 */
export function IdeZoomBar() {
  const { t } = useI18n()
  const [desktop, setDesktop] = useState(false)
  const [bar, setBar] = useState<ZoomBarState>(DEFAULT_ZOOM_BAR)
  const [zoom, setZoom] = useState(1)
  const [vp, setVp] = useState({ w: 0, h: 0 })
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ dx: number; dy: number } | null>(null)
  const latest = useRef(bar)
  latest.current = bar

  useEffect(() => {
    if (!isTauri()) return
    setDesktop(true)
    const measure = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    setBar(getZoomBar())
    setZoom(getIdeZoom())
    measure()
    const onBar = (e: Event) => setBar({ ...(e as CustomEvent).detail })
    const onZoom = (e: Event) => { setZoom(Number((e as CustomEvent).detail) || 1); requestAnimationFrame(measure) }
    window.addEventListener(ZOOM_BAR_EVENT, onBar)
    window.addEventListener(IDE_ZOOM_EVENT, onZoom)
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener(ZOOM_BAR_EVENT, onBar)
      window.removeEventListener(IDE_ZOOM_EVENT, onZoom)
      window.removeEventListener('resize', measure)
    }
  }, [])

  if (!desktop || !bar.open || !vp.w) return null

  const pos = barCssPosition(bar, vp.w, vp.h, zoom)

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top }
    e.currentTarget.setPointerCapture(e.pointerId)
    e.preventDefault()
  }
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    const fr = fractionsFromCssPosition(e.clientX - drag.current.dx, e.clientY - drag.current.dy, window.innerWidth, window.innerHeight, zoom)
    setBar(b => ({ ...b, ...fr }))
  }
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    drag.current = null
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* já solto */ }
    setZoomBar({ fx: latest.current.fx, fy: latest.current.fy }) // guarda só ao soltar
  }

  const btn = 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-all hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-30 disabled:hover:bg-transparent dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-white'
  return (
    <div
      ref={ref}
      role="group"
      aria-label={t('ide_zoom.label')}
      style={{ position: 'fixed', left: pos.left, top: pos.top, width: ZOOM_BAR_SIZE.w, height: ZOOM_BAR_SIZE.h, transform: `scale(${pos.scale})`, transformOrigin: 'top left', zIndex: 2147483000 }}
      className="flex items-center gap-0.5 rounded-full border border-neutral-200 bg-white/95 p-1 opacity-85 shadow-xl backdrop-blur transition-opacity hover:opacity-100 dark:border-neutral-700 dark:bg-neutral-900/95"
    >
      <div
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        title={t('ide_zoom.drag')} aria-label={t('ide_zoom.drag')}
        className="flex h-7 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-full text-neutral-400 hover:text-neutral-700 active:cursor-grabbing dark:hover:text-neutral-200"
      >
        <GripVertical className="h-4 w-4" />
      </div>
      <button type="button" className={btn} aria-label={t('ide_zoom.out')} title={t('ide_zoom.out')} disabled={zoom <= IDE_ZOOM_MIN} onClick={() => void stepIdeZoom(-1)}><Minus className="h-3.5 w-3.5" /></button>
      <button type="button" className="min-w-[3rem] flex-1 rounded-full px-1 py-1 text-center text-[11px] font-black tabular-nums text-neutral-900 hover:bg-neutral-100 dark:text-white dark:hover:bg-white/10" aria-label={t('ide_zoom.reset')} title={t('ide_zoom.reset')} onClick={() => void stepIdeZoom(0)}>{zoomPercent(zoom)}</button>
      <button type="button" className={btn} aria-label={t('ide_zoom.in')} title={t('ide_zoom.in')} disabled={zoom >= IDE_ZOOM_MAX} onClick={() => void stepIdeZoom(1)}><Plus className="h-3.5 w-3.5" /></button>
      <button type="button" className={btn} aria-label={t('ide_zoom.bar_close')} title={t('ide_zoom.bar_close')} onClick={() => setZoomBar({ open: false })}><X className="h-3.5 w-3.5" /></button>
    </div>
  )
}
