'use client'

import { useEffect, useState } from 'react'
import { ZoomIn } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { isTauri } from '@/utils/tauriUtils'
import { ZOOM_BAR_EVENT, getZoomBar, toggleZoomBar } from '@/utils/ideZoomBar'

/** Ícone da lupa no cabeçalho, depois do avatar: liga e desliga a barra flutuante de zoom. Só aparece na IDE (Tauri). */
export function IdeZoomToggle() {
  const { t } = useI18n()
  const [desktop, setDesktop] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!isTauri()) return
    setDesktop(true)
    setOpen(getZoomBar().open)
    const on = (e: Event) => setOpen(!!(e as CustomEvent).detail?.open)
    window.addEventListener(ZOOM_BAR_EVENT, on)
    return () => window.removeEventListener(ZOOM_BAR_EVENT, on)
  }, [])

  if (!desktop) return null

  const label = t(open ? 'ide_zoom.bar_hide' : 'ide_zoom.bar_show')
  return (
    <button
      type="button"
      onClick={() => toggleZoomBar()}
      aria-pressed={open}
      aria-label={label}
      title={label}
      className={
        'rounded-xl border p-2.5 transition-all ' +
        (open
          ? 'border-blue-500/40 bg-blue-500/10 text-blue-500 dark:text-blue-400'
          : 'border-neutral-200 bg-neutral-100 text-neutral-500 hover:text-blue-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:text-blue-400')
      }
    >
      <ZoomIn className="h-5 w-5" />
    </button>
  )
}
