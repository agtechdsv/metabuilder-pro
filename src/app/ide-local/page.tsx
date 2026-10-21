'use client'

import React, { useEffect, useRef } from 'react'
import { useIDE, type IDETarget } from '@/contexts/IDESyncContext'
import { IDE_LOCAL_OPEN_EVENT } from '@/utils/ideLocalWindow'

/**
 * Janela própria da IDE Local (desktop). A IDE em si é renderizada pelo IDESyncProvider;
 * esta página só diz qual projeto abrir (pela URL ou por evento, quando a janela já está aberta).
 */
export default function IDELocalPage() {
  const { openIDEHere } = useIDE()
  const openRef = useRef(openIDEHere)
  openRef.current = openIDEHere

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const type = p.get('type') === 'workspace' ? 'workspace' : 'project'
    const id = p.get('id')
    const slug = p.get('slug')
    if (id && slug) Promise.resolve(openRef.current({ type, id, name: p.get('name') || slug, slug }, { detached: true })).catch(err => console.error('IDE Local: não foi possível abrir', err))

    let unlisten: (() => void) | undefined
    let cancelled = false
    import('@tauri-apps/api/event')
      .then(({ listen }) => listen<IDETarget>(IDE_LOCAL_OPEN_EVENT, (e) => {
        if (e.payload?.id && e.payload?.slug) Promise.resolve(openRef.current(e.payload, { detached: true })).catch(err => console.error('IDE Local: não foi possível abrir', err))
      }))
      .then((fn) => { if (cancelled) fn(); else unlisten = fn })
      .catch(() => {})
    return () => { cancelled = true; unlisten?.() }
  }, [])

  return <div className="w-full h-screen bg-white dark:bg-[#1e1e1e]" />
}
