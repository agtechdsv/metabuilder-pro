'use client'

import { useEffect } from 'react'
import { isTauri } from '@/utils/tauriUtils'
import { restoreIdeZoom, stepIdeZoom } from '@/utils/ideZoom'
import { zoomDirFromKey, zoomDirFromWheel } from '@/lib/ideZoom'

/**
 * Zoom da IDE: devolve o zoom guardado ao abrir e liga os atalhos Ctrl +, Ctrl -, Ctrl 0 e Ctrl + roda do mouse.
 * Os atalhos passam por aqui (e não pelo zoom nativo do WebView2) para o valor mostrado no menu ser sempre o real e ficar guardado.
 * No site (fora do Tauri) não faz nada.
 */
export function IdeZoomHost() {
  useEffect(() => {
    if (!isTauri()) return
    void restoreIdeZoom()

    const onKey = (e: KeyboardEvent) => {
      const dir = zoomDirFromKey(e)
      if (dir === null) return
      e.preventDefault()
      void stepIdeZoom(dir)
    }

    let lastWheel = 0
    const onWheel = (e: WheelEvent) => {
      const dir = zoomDirFromWheel(e)
      if (dir === null) return
      e.preventDefault() // sem isso o webview rola a página em vez de dar zoom
      const now = Date.now()
      if (now - lastWheel < 90) return // a roda manda vários eventos por giro: um passo por vez
      lastWheel = now
      void stepIdeZoom(dir)
    }

    window.addEventListener('keydown', onKey)
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('wheel', onWheel)
    }
  }, [])
  return null
}
