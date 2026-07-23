'use client'

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { usePathname, useSearchParams } from 'next/navigation'
import { X, RefreshCw, ExternalLink, Terminal, Minimize2, Maximize2, LayoutDashboard } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

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
  const [isMinimized, setIsMinimized] = useState(false)
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [isTauri, setIsTauri] = useState(false)
  const [mounted, setMounted] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  // Fecha o modal caso a tela principal da IDE mude (ex: menu de contexto do Tray)
  useEffect(() => {
    setIsOpen(false)
    setIsMinimized(false)
  }, [pathname, searchParams])

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
      setIsMinimized(false)
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

  const handleIframeLoad = () => {
    if (iframeRef.current) {
      try {
        const currentUrl = iframeRef.current.contentWindow?.location.href
        if (currentUrl && currentUrl !== 'about:blank' && currentUrl !== url) {
          setUrl(currentUrl)
        }
      } catch (e) {
        // Ignora erro cross-origin se a navegação sair do escopo local
      }
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
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('open_devtools')
    } catch (e) {
      toast('Não foi possível abrir o DevTools: ' + String(e), 'error')
    }
  }

  return (
    <PreviewContext.Provider value={{ openPreview }}>
      {children}
      {mounted && createPortal(
        <AnimatePresence>
          {isOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ 
                  opacity: isMinimized ? 0 : 1, 
                  y: isMinimized ? '20%' : 0, 
                  scale: isMinimized ? 0.95 : 1 
                }}
                exit={{ opacity: 0, y: 20, scale: 0.98 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className={`fixed inset-0 z-[99999] flex flex-col bg-neutral-900 ${isMinimized ? 'pointer-events-none' : 'pointer-events-auto'}`}
              >
                {/* Top Bar Glassmorphism */}
                <div className="h-14 bg-neutral-900/90 backdrop-blur-md border-b border-neutral-800 flex items-center justify-between px-4 shrink-0 shadow-lg">
                  <div className="flex items-center gap-4 w-1/3">
                    <button 
                      onClick={() => {
                        setIsOpen(false)
                        setIsMinimized(false)
                      }} 
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
                    <div className="flex bg-black/40 rounded-lg p-1 border border-neutral-800/50 gap-1">
                      <button 
                        onClick={() => setIsMinimized(true)}
                        className="px-4 py-1.5 rounded-md text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-all flex items-center gap-2 text-xs font-bold" 
                        title="Alternar para a IDE (Manter aberto em segundo plano)"
                      >
                        <Minimize2 className="w-3.5 h-3.5" />
                        <span>Alternar IDE</span>
                      </button>
                      <div className="w-px bg-neutral-800/50 my-1 mx-1"></div>
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
                    onLoad={handleIframeLoad}
                    className="w-full h-full border-none"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </motion.div>

              {/* Floating Restore Button when minimized */}
              <AnimatePresence>
                {isMinimized && (
                  <motion.div 
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 50, scale: 0.9 }}
                    className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[99999] pointer-events-auto"
                  >
                    <div className="flex items-center gap-3 bg-neutral-900/90 backdrop-blur-xl border border-indigo-500/30 p-2 pl-4 pr-2 rounded-full shadow-2xl">
                      <div className="flex flex-col max-w-[200px]">
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Preview Ativo</span>
                        <span className="text-sm font-semibold text-white truncate">{title}</span>
                      </div>
                      <button 
                        onClick={() => setIsMinimized(false)}
                        className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-full text-xs font-bold transition-all shadow-lg"
                      >
                        <LayoutDashboard className="w-4 h-4" />
                        Retornar
                      </button>
                      <button 
                        onClick={() => {
                          setIsOpen(false)
                          setIsMinimized(false)
                        }}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-500/20 text-neutral-400 hover:text-red-400 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </PreviewContext.Provider>
  )
}
