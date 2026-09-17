'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams } from 'next/navigation'
import { X, RefreshCw, ExternalLink, Terminal, Minimize2, AppWindow, ArrowLeft } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

export interface PreviewTab {
  id: string
  url: string
  displayUrl: string
  title: string
}

interface InternalBrowserProps {
  isWindow?: boolean
  initialUrl?: string
  initialTitle?: string
  onClose?: () => void
}

export function InternalBrowser({
  isWindow = false,
  initialUrl: propUrl,
  initialTitle: propTitle,
  onClose,
}: InternalBrowserProps) {
  const searchParams = useSearchParams()
  const initialUrl = propUrl || searchParams?.get('url') || ''
  const initialTitle = propTitle || searchParams?.get('title') || 'Aplicação'

  const [tabs, setTabs] = useState<PreviewTab[]>(() => {
    if (initialUrl) {
      const tabId = Math.random().toString(36).substring(7)
      return [{
        id: tabId,
        url: initialUrl,
        displayUrl: initialUrl,
        title: initialTitle
      }]
    }
    return []
  })

  const [activeTabId, setActiveTabId] = useState<string | null>(() => {
    return tabs[0]?.id || null
  })

  const [isMinimized, setIsMinimized] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(null)
  const [loadingTabs, setLoadingTabs] = useState<Set<string>>(new Set(tabs[0]?.id ? [tabs[0].id] : []))
  const [urlInput, setUrlInput] = useState('')

  const iframeRefs = useRef<Record<string, HTMLIFrameElement | null>>({})
  const { toast } = useToast()

  const openNewTab = (targetUrl: string, targetTitle: string) => {
    if (!targetUrl) return
    setTabs(prev => {
      const exists = prev.find(t => t.url === targetUrl || t.title === targetTitle)
      if (exists) {
        setActiveTabId(exists.id)
        setLoadingTabs(current => new Set([...current, exists.id]))
        return prev
      }

      const newTabId = Math.random().toString(36).substring(7)
      setActiveTabId(newTabId)
      setLoadingTabs(current => new Set([...current, newTabId]))
      return [...prev, {
        id: newTabId,
        url: targetUrl,
        displayUrl: targetUrl,
        title: targetTitle
      }]
    })
    setIsMinimized(false)
  }

  // Cross-window and Tauri communication
  useEffect(() => {
    // 1. BroadcastChannel (fast, same-origin)
    let bc: BroadcastChannel | null = null
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bc = new BroadcastChannel('metabuilder-preview-channel')
      bc.onmessage = (event) => {
        if (event.data?.type === 'OPEN_TAB') {
          openNewTab(event.data.url, event.data.title)
        }
      }
    }

    // 2. Tauri Event Listener
    let unlistenTauri: (() => void) | null = null
    const setupTauri = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event')
        const unlisten = await listen<{ url: string; title: string }>('open-tab', (e) => {
          if (e.payload?.url) {
            openNewTab(e.payload.url, e.payload.title || 'Aplicação')
          }
        })
        unlistenTauri = unlisten
      } catch (_) {}
    }
    setupTauri()

    return () => {
      if (bc) bc.close()
      if (unlistenTauri) unlistenTauri()
    }
  }, [])

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null)
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const activeTab = tabs.find(t => t.id === activeTabId)

  // Sync window / document title
  useEffect(() => {
    if (activeTab) {
      const docTitle = `${activeTab.title} - MetaBuilder PRO`
      document.title = docTitle
      setUrlInput(activeTab.displayUrl || activeTab.url)

      if (isWindow) {
        import('@tauri-apps/api/webviewWindow').then(({ getCurrentWebviewWindow }) => {
          getCurrentWebviewWindow().setTitle(docTitle).catch(() => {})
        }).catch(() => {})
      }
    }
  }, [activeTab, isWindow])

  const closeTabById = (id: string) => {
    setTabs(prev => {
      const newTabs = prev.filter(t => t.id !== id)
      if (newTabs.length === 0) {
        setActiveTabId(null)
        if (isWindow) {
          import('@tauri-apps/api/webviewWindow').then(({ getCurrentWebviewWindow }) => {
            getCurrentWebviewWindow().close().catch(() => {})
          }).catch(() => {
            onClose?.()
          })
        } else {
          onClose?.()
        }
      } else if (activeTabId === id) {
        setActiveTabId(newTabs[newTabs.length - 1].id)
      }
      return newTabs
    })
    if (iframeRefs.current[id]) {
      delete iframeRefs.current[id]
    }
  }

  const closeTab = (e: React.MouseEvent | null, id: string) => {
    if (e) e.stopPropagation()
    closeTabById(id)
  }

  const closeOtherTabs = (id: string) => {
    setTabs(prev => {
      const remaining = prev.filter(t => t.id === id)
      prev.forEach(t => {
        if (t.id !== id && iframeRefs.current[t.id]) delete iframeRefs.current[t.id]
      })
      setActiveTabId(id)
      return remaining
    })
  }

  const closeTabsToRight = (id: string) => {
    setTabs(prev => {
      const idx = prev.findIndex(t => t.id === id)
      if (idx === -1) return prev
      const newTabs = prev.slice(0, idx + 1)
      prev.slice(idx + 1).forEach(t => {
        if (iframeRefs.current[t.id]) delete iframeRefs.current[t.id]
      })
      if (!newTabs.find(t => t.id === activeTabId)) {
        setActiveTabId(newTabs[newTabs.length - 1].id)
      }
      return newTabs
    })
  }

  const closeTabsToLeft = (id: string) => {
    setTabs(prev => {
      const idx = prev.findIndex(t => t.id === id)
      if (idx === -1) return prev
      const newTabs = prev.slice(idx)
      prev.slice(0, idx).forEach(t => {
        if (iframeRefs.current[t.id]) delete iframeRefs.current[t.id]
      })
      if (!newTabs.find(t => t.id === activeTabId)) {
        setActiveTabId(newTabs[0].id)
      }
      return newTabs
    })
  }

  const closeAllTabs = () => {
    setTabs([])
    setActiveTabId(null)
    iframeRefs.current = {}
    if (isWindow) {
      import('@tauri-apps/api/webviewWindow').then(({ getCurrentWebviewWindow }) => {
        getCurrentWebviewWindow().close().catch(() => {})
      }).catch(() => {
        onClose?.()
      })
    } else {
      onClose?.()
    }
  }

  const handleBack = () => {
    if (activeTabId && iframeRefs.current[activeTabId]) {
      const iframe = iframeRefs.current[activeTabId]
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.history.back()
      }
    }
  }

  const handleRefresh = () => {
    if (activeTabId && iframeRefs.current[activeTabId]) {
      const iframe = iframeRefs.current[activeTabId]
      if (iframe) {
        setLoadingTabs(prev => new Set([...prev, activeTabId]))
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
          setLoadingTabs(prev => {
            const next = new Set(prev)
            next.delete(tabId)
            return next
          })
          setTabs(prev => prev.map(t =>
            t.id === tabId && t.displayUrl !== currentUrl ? { ...t, displayUrl: currentUrl } : t
          ))
          if (tabId === activeTabId) {
            setUrlInput(currentUrl)
          }
        }
      } catch (e) {
        setLoadingTabs(prev => {
          const next = new Set(prev)
          next.delete(tabId)
          return next
        })
      }
    }
  }

  const handleOpenExternal = () => {
    if (!activeTab) return
    import('@tauri-apps/plugin-shell').then(({ open }) => {
      open(activeTab.displayUrl || activeTab.url)
    }).catch(() => {
      window.open(activeTab.displayUrl || activeTab.url, '_blank')
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

  const handleNavigateUrl = (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeTabId || !urlInput.trim()) return
    const iframe = iframeRefs.current[activeTabId]
    if (iframe) {
      setLoadingTabs(prev => new Set([...prev, activeTabId]))
      iframe.src = urlInput.trim()
    }
  }

  if (tabs.length === 0) {
    return (
      <div className="w-full h-full min-h-screen flex flex-col items-center justify-center bg-neutral-900 text-neutral-400 gap-4 p-8">
        <AppWindow className="w-12 h-12 text-neutral-600" />
        <h2 className="text-lg font-bold text-neutral-300">Nenhuma aba aberta no navegador interno</h2>
        <p className="text-sm text-neutral-500">Selecione uma aplicação ou caso de uso na IDE para visualizar aqui.</p>
        {isWindow && (
          <button
            onClick={closeAllTabs}
            className="mt-4 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold rounded-xl transition-all"
          >
            Fechar Janela
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={`flex flex-col bg-neutral-900 w-full h-full min-h-screen select-none ${isWindow ? 'h-screen overflow-hidden' : ''}`}>
      {/* Header Superior com as Abas */}
      <div className="bg-[#1a1b1e] border-b border-neutral-800 flex items-end pt-2 px-2 shrink-0 shadow-lg relative">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar w-[calc(100%-250px)]">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              onMouseDown={(e) => {
                if (e.button === 1) {
                  e.preventDefault()
                  closeTab(e, tab.id)
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                setContextMenu({ x: e.clientX, y: e.clientY, tabId: tab.id })
              }}
              className={`
                group relative flex items-center gap-2 min-w-[140px] max-w-[220px] h-9 px-3 rounded-t-lg transition-colors border border-b-0
                ${activeTabId === tab.id 
                  ? 'bg-neutral-900 border-neutral-800 z-10 text-white font-medium shadow-sm' 
                  : 'bg-[#2a2b2f] border-transparent hover:bg-[#34353a] text-neutral-400 z-0 font-normal'
                }
              `}
            >
              <AppWindow className={`w-3.5 h-3.5 shrink-0 ${activeTabId === tab.id ? 'text-indigo-400' : 'text-neutral-500'}`} />
              <span className="text-xs truncate flex-1 text-left">
                {tab.title}
              </span>
              <div 
                onClick={(e) => closeTab(e, tab.id)}
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-neutral-700/50 text-neutral-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Fechar Aba"
              >
                <X className="w-3 h-3" />
              </div>
            </button>
          ))}
        </div>

        {/* Top Right Actions */}
        <div className="flex items-center justify-end gap-1 pb-1.5 ml-auto shrink-0 w-[240px]">
          {!isWindow && (
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
          )}

          <button 
            onClick={closeAllTabs} 
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-800 hover:bg-red-500/80 text-neutral-300 hover:text-white transition-colors" 
            title={isWindow ? "Fechar Janela" : "Fechar Todas as Abas"}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Context Menu das Abas */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            style={{ top: contextMenu.y, left: contextMenu.x }}
            className="fixed z-[9999999] w-56 py-1.5 bg-[#2a2b2f] border border-neutral-700 rounded-lg shadow-2xl flex flex-col text-sm text-neutral-300"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => { closeTab(null, contextMenu.tabId); setContextMenu(null) }} className="px-4 py-2 text-left hover:bg-neutral-700 hover:text-white transition-colors w-full">Fechar Guia Atual</button>
            <button onClick={() => { closeOtherTabs(contextMenu.tabId); setContextMenu(null) }} className="px-4 py-2 text-left hover:bg-neutral-700 hover:text-white transition-colors w-full">Fechar Outras Guias</button>
            <button onClick={() => { closeTabsToRight(contextMenu.tabId); setContextMenu(null) }} className="px-4 py-2 text-left hover:bg-neutral-700 hover:text-white transition-colors w-full">Fechar Guias à Direita</button>
            <button onClick={() => { closeTabsToLeft(contextMenu.tabId); setContextMenu(null) }} className="px-4 py-2 text-left hover:bg-neutral-700 hover:text-white transition-colors w-full">Fechar Guias à Esquerda</button>
            <div className="h-px bg-neutral-700 my-1 mx-2" />
            <button onClick={() => { closeAllTabs(); setContextMenu(null) }} className="px-4 py-2 text-left hover:bg-red-500/20 hover:text-red-400 transition-colors w-full">Fechar Todas as Guias</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navbar da Aba Ativa (Browser Style) */}
      <div className="h-12 bg-neutral-900 border-b border-neutral-800 flex items-center px-4 shrink-0 gap-4">
        <div className="flex items-center gap-1">
          <button 
            onClick={handleBack} 
            className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all" 
            title="Voltar"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
        
        <form onSubmit={handleNavigateUrl} className="flex-1 flex justify-center">
          <div className="flex items-center gap-2 bg-[#1a1b1e] border border-neutral-800 pl-4 pr-1 py-1 rounded-full w-full max-w-2xl text-xs text-neutral-300 font-mono transition-colors focus-within:border-indigo-500/50">
            <span className="text-neutral-500 text-[11px] select-none">URL</span>
            <input 
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="bg-transparent border-none outline-none w-full text-xs font-mono text-neutral-200 placeholder-neutral-500"
              placeholder="Digite a URL..."
            />
            <button 
              type="button"
              onClick={handleRefresh} 
              className="w-7 h-7 flex items-center justify-center rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all shrink-0" 
              title="Atualizar Aba"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>

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

      {/* Area dos Iframes */}
      <div className="flex-1 bg-white relative">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`w-full h-full absolute inset-0 ${activeTabId === tab.id ? 'z-10' : 'z-0 pointer-events-none'}`}
          >
            {/* Loading overlay */}
            {loadingTabs.has(tab.id) && activeTabId === tab.id && (
              <div className="absolute inset-0 z-20 bg-neutral-900 flex flex-col items-center justify-center gap-4">
                <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                <span className="text-sm font-medium text-indigo-400 animate-pulse">Carregando aplicação...</span>
              </div>
            )}
            <iframe 
              ref={el => { iframeRefs.current[tab.id] = el }}
              src={tab.url}
              onLoad={() => handleIframeLoad(tab.id)}
              className={`w-full h-full border-none bg-white ${activeTabId === tab.id ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ))}
      </div>
    </div>
  )
}
