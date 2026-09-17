'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams } from 'next/navigation'
import { X, RefreshCw, ExternalLink, Terminal, Minimize2, AppWindow, ArrowLeft, Plus, Lock, Globe, Building2, FolderKanban } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

export interface PreviewTab {
  id: string
  url: string
  displayUrl: string
  title: string
  isSelecting?: boolean
}

interface InternalBrowserProps {
  isWindow?: boolean
  initialUrl?: string
  initialTitle?: string
  onClose?: () => void
}

interface WorkspaceTarget {
  id: string
  name: string
  slug: string
  has_portal_project: boolean
  projects: Array<{
    id: string
    name: string
    slug: string
    show_in_portal: boolean
  }>
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
        title: initialTitle,
        isSelecting: false,
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
  const [availableWorkspaces, setAvailableWorkspaces] = useState<WorkspaceTarget[]>([])

  const iframeRefs = useRef<Record<string, HTMLIFrameElement | null>>({})
  const { toast } = useToast()

  // Fetch available workspaces and projects for the tab selection combo
  useEffect(() => {
    fetch('/api/preview/targets')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.workspaces)) {
          setAvailableWorkspaces(data.workspaces)
        }
      })
      .catch(err => console.error('Error fetching preview targets:', err))
  }, [])

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
        title: targetTitle,
        isSelecting: false,
      }]
    })
    setIsMinimized(false)
  }

  // Cross-window and Tauri communication
  useEffect(() => {
    let bc: BroadcastChannel | null = null
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bc = new BroadcastChannel('metabuilder-preview-channel')
      bc.onmessage = (event) => {
        if (event.data?.type === 'OPEN_TAB') {
          openNewTab(event.data.url, event.data.title)
        }
      }
    }

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

  // Compute active base origin (e.g. https://www.metabuilderpro.com or window.location.origin)
  const getBaseOrigin = () => {
    if (activeTab?.url && activeTab.url.startsWith('http')) {
      try {
        return new URL(activeTab.url).origin
      } catch (_) {}
    }
    const firstWithUrl = tabs.find(t => t.url && t.url.startsWith('http'))
    if (firstWithUrl) {
      try {
        return new URL(firstWithUrl.url).origin
      } catch (_) {}
    }
    if (typeof window !== 'undefined') {
      return window.location.origin
    }
    return 'https://www.metabuilderpro.com'
  }

  // Sync window / document title
  useEffect(() => {
    if (activeTab) {
      const docTitle = `${activeTab.title} - MetaBuilder PRO`
      document.title = docTitle
      setUrlInput(activeTab.displayUrl || activeTab.url || '')

      if (isWindow) {
        import('@tauri-apps/api/webviewWindow').then(({ getCurrentWebviewWindow }) => {
          getCurrentWebviewWindow().setTitle(docTitle).catch(() => {})
        }).catch(() => {})
      }
    }
  }, [activeTab, isWindow])

  const handleAddNewTab = () => {
    const newTabId = Math.random().toString(36).substring(7)
    setTabs(prev => [...prev, {
      id: newTabId,
      url: '',
      displayUrl: '',
      title: 'Nova Aba',
      isSelecting: true,
    }])
    setActiveTabId(newTabId)
  }

  const handleSelectTarget = (tabId: string, value: string) => {
    if (!value) return
    const baseOrigin = getBaseOrigin()
    const parts = value.split(':')
    const type = parts[0]
    let targetUrl = ''
    let targetTitle = ''

    if (type === 'portal') {
      const wsSlug = parts[1]
      const wsName = parts.slice(2).join(':')
      targetUrl = `${baseOrigin}/${wsSlug}`
      targetTitle = `Portal: ${wsName}`
    } else if (type === 'project') {
      const wsSlug = parts[1]
      const projSlug = parts[2]
      const projName = parts.slice(3).join(':')
      targetUrl = `${baseOrigin}/${wsSlug}/${projSlug}`
      targetTitle = `Projeto: ${projName}`
    }

    if (targetUrl) {
      setTabs(prev => prev.map(t =>
        t.id === tabId
          ? {
              ...t,
              url: targetUrl,
              displayUrl: targetUrl,
              title: targetTitle,
              isSelecting: false,
            }
          : t
      ))
      setLoadingTabs(prev => new Set([...prev, tabId]))
      setUrlInput(targetUrl)
    }
  }

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
      if (iframe && activeTab?.url) {
        setLoadingTabs(prev => new Set([...prev, activeTabId]))
        const currentSrc = iframe.src || activeTab.url
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
    if (!activeTab || !activeTab.url) return
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

  if (tabs.length === 0) {
    return (
      <div className="w-full h-full min-h-screen flex flex-col items-center justify-center bg-neutral-900 text-neutral-400 gap-4 p-8">
        <AppWindow className="w-12 h-12 text-neutral-600" />
        <h2 className="text-lg font-bold text-neutral-300">Nenhuma aba aberta no navegador interno</h2>
        <p className="text-sm text-neutral-500">Adicione uma nova aba ou selecione um caso de uso na IDE.</p>
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleAddNewTab}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/30"
          >
            <Plus className="w-4 h-4" />
            Nova Aba
          </button>
          {isWindow && (
            <button
              onClick={closeAllTabs}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold rounded-xl transition-all"
            >
              Fechar Janela
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col bg-neutral-900 w-full h-full min-h-screen select-none ${isWindow ? 'h-screen overflow-hidden' : ''}`}>
      {/* Header Superior com as Abas */}
      <div className="bg-[#1a1b1e] border-b border-neutral-800 flex items-end pt-2 px-2 shrink-0 shadow-lg relative">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar w-[calc(100%-250px)]">
          {tabs.map(tab => {
            const isActive = activeTabId === tab.id
            return (
              <div
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
                  group relative flex items-center gap-2 ${tab.isSelecting ? 'min-w-[190px] max-w-[280px]' : 'min-w-[140px] max-w-[240px]'} h-9 px-3 rounded-t-lg transition-colors border border-b-0 cursor-pointer
                  ${isActive 
                    ? 'bg-neutral-900 border-neutral-800 z-10 text-white font-medium shadow-sm' 
                    : 'bg-[#2a2b2f] border-transparent hover:bg-[#34353a] text-neutral-400 z-0 font-normal'
                  }
                `}
              >
                {/* Bolinha na aba ativa */}
                {isActive && (
                  <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.9)] shrink-0 animate-pulse" />
                )}

                <AppWindow className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-indigo-400' : 'text-neutral-500'}`} />

                {/* Nome da aba ou Combo de Seleção de Workspace/Projetos */}
                {tab.isSelecting ? (
                  <select
                    autoFocus
                    value=""
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => handleSelectTarget(tab.id, e.target.value)}
                    className="bg-neutral-800 text-neutral-200 text-xs font-semibold rounded px-2 py-0.5 border border-indigo-500/60 outline-none cursor-pointer flex-1 truncate max-w-[180px]"
                  >
                    <option value="" disabled>Selecione...</option>
                    {availableWorkspaces.map(ws => (
                      <React.Fragment key={ws.id}>
                        {ws.has_portal_project && (
                          <optgroup label="Workspace (Portal)">
                            <option value={`portal:${ws.slug}:${ws.name}`}>
                              {ws.name}
                            </option>
                          </optgroup>
                        )}
                        {ws.projects.length > 0 && (
                          <optgroup label="Projetos">
                            {ws.projects.map((proj: any) => (
                              <option key={proj.id} value={`project:${ws.slug}:${proj.slug}:${proj.name}`}>
                                {proj.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </React.Fragment>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs truncate flex-1 text-left">
                    {tab.title}
                  </span>
                )}

                <div 
                  onClick={(e) => closeTab(e, tab.id)}
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-neutral-700/50 text-neutral-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Fechar Aba"
                >
                  <X className="w-3 h-3" />
                </div>
              </div>
            )
          })}

          {/* Botão + para adicionar nova aba */}
          <button
            onClick={handleAddNewTab}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition-colors shrink-0 mb-0.5 ml-1"
            title="Nova Aba (Adicionar Workspace ou Projeto)"
          >
            <Plus className="w-4 h-4" />
          </button>
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

      {/* Navbar da Aba Ativa (Browser Style com URL protegida somente leitura) */}
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
        
        <div className="flex-1 flex justify-center">
          <div className="flex items-center gap-2 bg-[#1a1b1e] border border-neutral-800 pl-3 pr-1 py-1 rounded-full w-full max-w-2xl text-xs text-neutral-400 font-mono transition-colors">
            <span title="URL protegida" className="flex items-center">
              <Lock className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
            </span>
            <span className="text-neutral-500 text-[11px] select-none font-sans font-bold">URL</span>
            <input 
              type="text"
              readOnly
              value={urlInput}
              className="bg-transparent border-none outline-none w-full text-xs font-mono text-neutral-300 cursor-default select-all"
              title="URL do Navegador Interno (somente leitura)"
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

      {/* Area dos Iframes e Seleção de Aplicação */}
      <div className="flex-1 bg-white relative">
        {tabs.map(tab => {
          const isTabActive = activeTabId === tab.id

          // Se a aba ainda estiver em modo de seleção (sem URL definida)
          if (tab.isSelecting || !tab.url) {
            return (
              <div
                key={tab.id}
                className={`w-full h-full absolute inset-0 bg-neutral-900 flex flex-col items-center justify-center p-8 text-neutral-300 overflow-y-auto ${isTabActive ? 'z-10' : 'z-0 pointer-events-none opacity-0'}`}
              >
                <div className="max-w-2xl w-full text-center space-y-6">
                  <div>
                    <span className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 rounded-full border border-indigo-500/20 text-[11px] font-bold text-indigo-400 uppercase tracking-wider mb-2">
                      Nova Aba
                    </span>
                    <h2 className="text-2xl font-black text-white">Escolha o que deseja abrir</h2>
                    <p className="text-sm text-neutral-400 mt-1">Selecione o Portal do Workspace ou um Projeto específico abaixo:</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                    {availableWorkspaces.map(ws => (
                      <React.Fragment key={ws.id}>
                        {ws.has_portal_project && (
                          <div
                            onClick={() => handleSelectTarget(tab.id, `portal:${ws.slug}:${ws.name}`)}
                            className="bg-[#1a1b1e] hover:bg-[#25272c] border border-neutral-800 hover:border-indigo-500/50 rounded-2xl p-5 cursor-pointer transition-all hover:scale-[1.02] shadow-lg group"
                          >
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-3 group-hover:bg-indigo-500/20 transition-colors">
                              <Building2 className="w-5 h-5" />
                            </div>
                            <span className="text-[10px] uppercase tracking-wider font-bold text-indigo-400">Portal de Aplicações</span>
                            <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors">{ws.name}</h3>
                            <p className="text-xs text-neutral-500 mt-1">Acesso unificado aos projetos configurados no portal</p>
                          </div>
                        )}

                        {ws.projects.map(proj => (
                          <div
                            key={proj.id}
                            onClick={() => handleSelectTarget(tab.id, `project:${ws.slug}:${proj.slug}:${proj.name}`)}
                            className="bg-[#1a1b1e] hover:bg-[#25272c] border border-neutral-800 hover:border-indigo-500/50 rounded-2xl p-5 cursor-pointer transition-all hover:scale-[1.02] shadow-lg group"
                          >
                            <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center text-neutral-300 mb-3 group-hover:text-indigo-400 group-hover:bg-indigo-500/10 transition-colors">
                              <FolderKanban className="w-5 h-5" />
                            </div>
                            <span className="text-[10px] uppercase tracking-wider font-bold text-neutral-400">Projeto ({ws.name})</span>
                            <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors">{proj.name}</h3>
                            <p className="text-xs text-neutral-500 mt-1">/{ws.slug}/{proj.slug}</p>
                          </div>
                        ))}
                      </React.Fragment>
                    ))}
                  </div>

                  {availableWorkspaces.length === 0 && (
                    <div className="py-8 text-neutral-500 text-sm animate-pulse">
                      Carregando opções disponíveis...
                    </div>
                  )}
                </div>
              </div>
            )
          }

          return (
            <div
              key={tab.id}
              className={`w-full h-full absolute inset-0 ${isTabActive ? 'z-10' : 'z-0 pointer-events-none'}`}
            >
              {/* Loading overlay */}
              {loadingTabs.has(tab.id) && isTabActive && (
                <div className="absolute inset-0 z-20 bg-neutral-900 flex flex-col items-center justify-center gap-4">
                  <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                  <span className="text-sm font-medium text-indigo-400 animate-pulse">Carregando aplicação...</span>
                </div>
              )}
              <iframe 
                ref={el => { iframeRefs.current[tab.id] = el }}
                src={tab.url}
                onLoad={() => handleIframeLoad(tab.id)}
                className={`w-full h-full border-none bg-white ${isTabActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
