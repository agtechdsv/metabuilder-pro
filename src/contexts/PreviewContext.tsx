'use client'

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X, RefreshCw, ExternalLink, Terminal } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

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
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [isTauri, setIsTauri] = useState(false)
  const [mounted, setMounted] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

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

  const openPreview = (targetUrl: string, targetTitle: string) => {
    if (isTauri) {
      setUrl(targetUrl)
      setTitle(targetTitle)
      setIsOpen(true)
    } else {
      window.open(targetUrl, '_blank')
    }
  }

  const handleRefresh = () => {
    if (iframeRef.current) {
      const currentSrc = iframeRef.current.src
      iframeRef.current.src = 'about:blank'
      setTimeout(() => {
        if (iframeRef.current) iframeRef.current.src = currentSrc
      }, 50)
    }
  }

  const handleOpenExternal = () => {
    import('@tauri-apps/plugin-shell').then(({ open }) => {
      open(url)
    }).catch(() => {
      window.open(url, '_blank')
    })
  }

  const handleOpenDevTools = async () => {
    try {
      // No Tauri v2 o getCurrentWebview() expõe openDevTools() se compilado em modo dev
      const { getCurrentWebview } = await import('@tauri-apps/api/webview')
      const webview = getCurrentWebview() as any
      if (typeof webview.openDevTools === 'function') {
        webview.openDevTools()
      } else {
        // Fallback for some Tauri versions where it's on the window instead
        const { getCurrentWindow } = await import('@tauri-apps/api/window')
        const win = getCurrentWindow() as any
        if (typeof win.openDevTools === 'function') {
          win.openDevTools()
        }
      }
    } catch (e) {
      console.warn('Não foi possível abrir o DevTools', e)
    }
  }

  return (
    <PreviewContext.Provider value={{ openPreview }}>
      {children}
      {mounted && createPortal(
        <AnimatePresence>
          {isOpen && (
            <div className="fixed inset-0 z-[99999] flex flex-col bg-neutral-900">
              <motion.div 
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="flex-1 flex flex-col w-full h-full"
              >
                {/* Top Bar Glassmorphism */}
                <div className="h-14 bg-neutral-900/90 backdrop-blur-md border-b border-neutral-800 flex items-center justify-between px-4 shrink-0 shadow-lg">
                  <div className="flex items-center gap-4 w-1/3">
                    <button 
                      onClick={() => setIsOpen(false)} 
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-800 hover:bg-red-500/80 text-neutral-300 hover:text-white transition-colors" 
                      title="Fechar Pré-visualização"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="flex flex-col min-w-0">
                      <span className="text-neutral-200 font-semibold text-sm truncate">{title}</span>
                      <span className="text-neutral-500 font-mono text-[10px] truncate max-w-[300px]">{url}</span>
                    </div>
                  </div>

                  <div className="flex-1 flex justify-center">
                    <div className="flex bg-black/40 rounded-lg p-1 border border-neutral-800/50">
                      <button 
                        onClick={handleRefresh} 
                        className="px-4 py-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all flex items-center gap-2 text-xs font-medium" 
                        title="Atualizar Página"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Atualizar</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 w-1/3">
                    <button 
                      onClick={handleOpenDevTools} 
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-400 hover:text-emerald-400 hover:bg-neutral-800 transition-colors" 
                      title="Inspecionar Elemento (DevTools)"
                    >
                      <Terminal className="w-4 h-4" />
                    </button>

                    <button 
                      onClick={handleOpenExternal} 
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-400 hover:text-blue-400 hover:bg-neutral-800 transition-colors" 
                      title="Abrir no Navegador Externo"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Iframe Box */}
                <div className="flex-1 bg-white relative">
                  <iframe 
                    ref={iframeRef}
                    src={url}
                    className="w-full h-full border-none"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </PreviewContext.Provider>
  )
}
