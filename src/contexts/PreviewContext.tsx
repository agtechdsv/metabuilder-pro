'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { InternalBrowser, PreviewTab } from '@/components/preview/InternalBrowser'

export type { PreviewTab }

interface PreviewContextData {
  openPreview: (url: string, title: string) => void
}

const PreviewContext = createContext<PreviewContextData>({
  openPreview: () => {}
})

export function usePreview() {
  return useContext(PreviewContext)
}

export function PreviewProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [initialUrl, setInitialUrl] = useState('')
  const [initialTitle, setInitialTitle] = useState('')
  const [isTauri, setIsTauri] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const checkTauri = async () => {
      try {
        const { isTauri: checkIsTauri } = await import('@tauri-apps/api/core')
        setIsTauri(checkIsTauri())
      } catch (e) {
        setIsTauri(false)
      }
    }
    checkTauri()
  }, [])

  const openInternalModal = (targetUrl: string, targetTitle: string) => {
    setInitialUrl(targetUrl)
    setInitialTitle(targetTitle)
    setIsOpen(true)
  }

  const openPreview = async (targetUrl: string, targetTitle: string) => {
    if (isTauri) {
      try {
        const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
        const existing = await WebviewWindow.getByLabel('app-preview')

        if (existing) {
          await existing.unminimize().catch(() => {})
          await existing.show().catch(() => {})
          await existing.setFocus().catch(() => {})

          if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
            const bc = new BroadcastChannel('metabuilder-preview-channel')
            bc.postMessage({ type: 'OPEN_TAB', url: targetUrl, title: targetTitle })
            bc.close()
          }
          await existing.emit('open-tab', { url: targetUrl, title: targetTitle }).catch(() => {})
          return
        }

        const previewWin = new WebviewWindow('app-preview', {
          url: `/app-preview?url=${encodeURIComponent(targetUrl)}&title=${encodeURIComponent(targetTitle)}`,
          title: `${targetTitle} - MetaBuilder PRO`,
          width: 1280,
          height: 800,
          center: true,
          decorations: true,
        })

        previewWin.once('tauri://error', async (e) => {
          console.error('Error creating app-preview window', e)
          const w = await WebviewWindow.getByLabel('app-preview')
          if (w) {
            await w.unminimize().catch(() => {})
            await w.show().catch(() => {})
            await w.setFocus().catch(() => {})
            if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
              const bc = new BroadcastChannel('metabuilder-preview-channel')
              bc.postMessage({ type: 'OPEN_TAB', url: targetUrl, title: targetTitle })
              bc.close()
            }
            await w.emit('open-tab', { url: targetUrl, title: targetTitle }).catch(() => {})
          } else {
            openInternalModal(targetUrl, targetTitle)
          }
        })
        return
      } catch (e) {
        console.error('Error handling detached preview window', e)
        openInternalModal(targetUrl, targetTitle)
        return
      }
    }

    // Web fallback
    openInternalModal(targetUrl, targetTitle)
  }

  return (
    <PreviewContext.Provider value={{ openPreview }}>
      {children}
      {mounted && isOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex flex-col bg-neutral-900">
          <InternalBrowser
            isWindow={false}
            initialUrl={initialUrl}
            initialTitle={initialTitle}
            onClose={() => setIsOpen(false)}
          />
        </div>,
        document.body
      )}
    </PreviewContext.Provider>
  )
}
