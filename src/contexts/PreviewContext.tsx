'use client'

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { usePathname, useSearchParams } from 'next/navigation'
import { X, RefreshCw, ExternalLink, Terminal, Minimize2, Maximize2, LayoutDashboard, Globe, AppWindow } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

export interface PreviewTab {
  id: string
  url: string // O src original
  displayUrl: string // A URL exibida
  title: string
}

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
  const [tabs, setTabs] = useState<PreviewTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  
  const [isTauri, setIsTauri] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { toast } = useToast()

  // Precisamos guardar as refs dos iframes
  const iframeRefs = useRef<Record<string, HTMLIFrameElement | null>>({})

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
      setTabs(prev => {
        const exists = prev.find(t => t.url === targetUrl || t.title === targetTitle)
        if (exists) {
          setActiveTabId(exists.id)
          return prev
        }
        
        const newTabId = Math.random().toString(36).substring(7)
        setActiveTabId(newTabId)
        return [...prev, {
          id: newTabId,
          url: targetUrl,
          displayUrl: targetUrl,
          title: targetTitle
        }]
      })
      setIsOpen(true)
      setIsMinimized(false)
    } else {
      window.open(targetUrl, '_blank')
    }
  }

  const closeTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setTabs(prev => {
      const newTabs = prev.filter(t => t.id !== id)
      if (newTabs.length === 0) {
        setIsOpen(false)
        setActiveTabId(null)
      } else if (activeTabId === id) {
        setActiveTabId(newTabs[newTabs.length - 1].id)
      }
      return newTabs
    })
    
    // Clean up ref
    if (iframeRefs.current[id]) {
      delete iframeRefs.current[id]
    }
  }

  const activeTab = tabs.find(t => t.id === activeTabId)

  const handleRefresh = () => {
    if (activeTabId && iframeRefs.current[activeTabId]) {
      const iframe = iframeRefs.current[activeTabId]
      if (iframe) {
        const currentSrc = iframe.src
        iframe.src = 'about:blank'
        setTimeout(() => {
          if (iframe) iframe.src = currentSrc
        }, 50)
      }
    }
  }

  const handleIframeLoad = (tabId: string) => {
    const iframe = iframeRefs.current[tabId]
    if (iframe) {
      try {
        const currentUrl = iframe.contentWindow?.location.href
        if (currentUrl && currentUrl !== 'about:blank') {
          setTabs(prev => prev.map(t => 
            t.id === tabId && t.displayUrl !== currentUrl ? { ...t, displayUrl: currentUrl } : t
          ))
        }
      } catch (e) {
        // Ignora erro cross-origin se a navegação sair do escopo local
      }
    }
  }

  const handleOpenExternal = () => {
    if (!activeTab) return
    import('@tauri-apps/plugin-shell').then(({ open }) => {
      open(activeTab.displayUrl)
    }).catch(() => {
      window.open(activeTab.displayUrl, '_blank')
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
                {/* Header Superior com as Abas */}
                <div className="bg-[#1a1b1e] border-b border-neutral-800 flex items-end pt-2 px-2 shrink-0 shadow-lg">
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar w-[calc(100%-250px)]">
                    {tabs.map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTabId(tab.id)}
                        className={`
                          group relative flex items-center gap-2 min-w-[140px] max-w-[200px] h-9 px-3 rounded-t-lg transition-colors border border-b-0
                          ${activeTabId === tab.id 
                            ? 'bg-neutral-900 border-neutral-800 z-10' 
                            : 'bg-[#2a2b2f] border-transparent hover:bg-[#34353a] text-neutral-400 z-0'
                          }
                        `}
                      >
                        <AppWindow className={`w-3.5 h-3.5 shrink-0 ${activeTabId === tab.id ? 'text-indigo-400' : 'text-neutral-500'}`} />
                        <span className={`text-xs truncate flex-1 text-left ${activeTabId === tab.id ? 'text-neutral-200 font-medium' : 'font-normal'}`}>
                          {tab.title}
                        </span>
                        <div 
                          onClick={(e) => closeTab(e, tab.id)}
                          className="w-5 h-5 flex items-center justify-center rounded hover:bg-neutral-700/50 text-neutral-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Top Right Actions */}
                  <div className="flex items-center justify-end gap-1 pb-1.5 ml-auto shrink-0 w-[240px]">
                    <div className="flex bg-black/40 rounded-lg p-1 border border-neutral-800/50 gap-1 mr-2">
                      <button 
                        onClick={() => setIsMinimized(true)}
                        className="px-3 py-1 rounded-md text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-all flex items-center gap-2 text-xs font-bold" 
                        title="Alternar para a IDE (Manter aberto em segundo plano)"
                      >
                        <Minimize2 className="w-3.5 h-3.5" />
                        <span>Minimizar</span>
                      </button>
                    </div>

                    <button 
                      onClick={() => {
                        setIsOpen(false)
                        setTabs([])
                        setActiveTabId(null)
                      }} 
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-800 hover:bg-red-500/80 text-neutral-300 hover:text-white transition-colors" 
                      title="Fechar Todas as Abas"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Navbar da Aba Ativa (Browser Style) */}
                <div className="h-12 bg-neutral-900 border-b border-neutral-800 flex items-center px-4 shrink-0 gap-4">
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={handleRefresh} 
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all" 
                      title="Atualizar Aba"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="flex-1 flex justify-center">
                    <div className="flex items-center gap-2 bg-[#1a1b1e] border border-neutral-800 px-4 py-1.5 rounded-full w-full max-w-2xl text-xs text-neutral-400 font-mono">
                      <Globe className="w-3.5 h-3.5" />
                      <span className="truncate">{activeTab?.displayUrl}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
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

                {/* Iframes */}
                <div className="flex-1 bg-white relative">
                  {tabs.map(tab => (
                    <iframe 
                      key={tab.id}
                      ref={el => { iframeRefs.current[tab.id] = el }}
                      src={tab.url}
                      onLoad={() => handleIframeLoad(tab.id)}
                      className={`w-full h-full border-none absolute inset-0 ${activeTabId === tab.id ? `opacity-100 z-10 ${isMinimized ? 'pointer-events-none' : 'pointer-events-auto'}` : 'opacity-0 z-0 pointer-events-none'}`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ))}
                </div>
              </motion.div>

              {/* Floating Restore Button when minimized */}
              <AnimatePresence>
                {isMinimized && activeTab && (
                  <motion.div 
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 50, scale: 0.9 }}
                    className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[99999] pointer-events-auto"
                  >
                    <div className="flex items-center gap-3 bg-neutral-900/90 backdrop-blur-xl border border-indigo-500/30 p-2 pl-4 pr-2 rounded-full shadow-2xl">
                      <div className="flex flex-col max-w-[200px]">
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">{tabs.length} {tabs.length === 1 ? 'Aba Aberta' : 'Abas Abertas'}</span>
                        <span className="text-sm font-semibold text-white truncate">{activeTab.title}</span>
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
                          setTabs([])
                          setActiveTabId(null)
                        }}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-500/20 text-neutral-400 hover:text-red-400 transition-colors"
                        title="Fechar Todas as Abas"
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
