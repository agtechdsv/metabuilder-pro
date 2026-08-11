'use client'

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  FolderGit2, Play, DownloadCloud, AlertTriangle, 
  CheckCircle2, XCircle, FileCode2, ChevronRight, ChevronDown, Folder, History, X, Minimize2, AppWindow, LayoutDashboard, Loader2, Settings, Plus, Network, UploadCloud, Download, GitBranch,
  Package, Square, Trash2, PanelBottomOpen, PanelLeftOpen, UnfoldVertical, FoldVertical
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { isTauri } from '@/utils/tauriUtils'
import { LocalSyncManager } from '@/utils/localSyncManager'
import { IDEGitSettingsModal } from '@/components/ide/IDEGitSettingsModal'
import { GitConfigManager } from '@/utils/gitConfigManager'
import * as tauriFs from '@tauri-apps/plugin-fs'
import { BaseDirectory, homeDir } from '@tauri-apps/api/path'
import { Command } from '@tauri-apps/plugin-shell'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/utils/supabase/client'
import { usePreview } from './PreviewContext'
import { invoke } from '@tauri-apps/api/core'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

export interface IDETarget {
  type: 'project' | 'workspace'
  id: string
  name: string
  slug: string
}

interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
}

interface IDESyncContextData {
  openIDE: (target: IDETarget) => void
}

const IDESyncContext = createContext<IDESyncContextData>({
  openIDE: () => {}
})

export function useIDE() {
  return useContext(IDESyncContext)
}

export function IDESyncProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [target, setTarget] = useState<IDETarget | null>(null)
  
  const [syncManager, setSyncManager] = useState<LocalSyncManager | null>(null)
  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string>('')
  const [isSyncing, setIsSyncing] = useState(false)
  const [isDiscarding, setIsDiscarding] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [sandboxMode, setSandboxMode] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [devProcess, setDevProcess] = useState<any>(null)
  const [gitLogs, setGitLogs] = useState<any[]>([])
  const [branches, setBranches] = useState<string[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('local')
  const [isLogModalOpen, setIsLogModalOpen] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [revertConfirmOid, setRevertConfirmOid] = useState<string | null>(null)
  const [isReverting, setIsReverting] = useState(false)
  const [showGitSettings, setShowGitSettings] = useState(false)
  const [isPushing, setIsPushing] = useState(false)
  const [isPulling, setIsPulling] = useState(false)
  
  const [showNewBranchModal, setShowNewBranchModal] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [isCreatingBranch, setIsCreatingBranch] = useState(false)
  const [ideLoadingState, setIdeLoadingState] = useState<{isLoading: boolean, message: string}>({ isLoading: false, message: '' })
  const [isStoppingServer, setIsStoppingServer] = useState(false)
  const [isInstalling, setIsInstalling] = useState(false)
  
  // Console panel state
  const [consoleLogs, setConsoleLogs] = useState<Array<{ts: string, text: string, type: 'info'|'error'|'warn'|'stdout'}>>([])
  const [showConsole, setShowConsole] = useState(true) // open by default
  const [showSidebar, setShowSidebar] = useState(true) // open by default
  const consoleEndRef = useRef<HTMLDivElement>(null)
  
  const [mounted, setMounted] = useState(false)
  const { toast } = useToast()
  const { openPreview } = usePreview()
  const supabase = createClient()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Helper to append a line to the console
  const addConsoleLog = (text: string, type: 'info'|'error'|'warn'|'stdout' = 'stdout') => {
    setConsoleLogs(prev => [...prev, {
      ts: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      text,
      type
    }])
  }

  // Auto-scroll console to bottom on new logs
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [consoleLogs])

  useEffect(() => {
    if (isOpen && target && isTauri()) {
      const manager = new LocalSyncManager(target.id, target.slug)
      setSyncManager(manager)
      manager.initLocalProject().then(async () => {
        const { branches, currentBranch } = await manager.getBranches()
        setBranches(branches)
        setSelectedBranch(currentBranch)
        const configManager = new GitConfigManager(target.slug)
        const config = await configManager.getConfig()
        const sandboxBranch = config.branchSandbox || 'sync-sandbox'

        if (currentBranch === sandboxBranch) {
          setSandboxMode(true)
        } else {
          setSandboxMode(false)
        }
        await loadFileTree()
      })
    }
  }, [isOpen, target])

  // Cleanup npm process when IDE is fully closed
  useEffect(() => {
    if (!isOpen && devProcess) {
      devProcess.kill()
      setDevProcess(null)
    }
  }, [isOpen, devProcess])

  const openIDE = (newTarget: IDETarget) => {
    if (!isTauri()) {
      toast('A IDE Local está disponível apenas no Desktop App', 'error')
      return
    }
    setTarget(newTarget)
    setIsOpen(true)
    setIsMinimized(false)
  }

  const closeIDE = () => {
    setIsOpen(false)
    setIsMinimized(false)
    setTarget(null)
    setFileTree([])
    setSelectedFile(null)
    setFileContent('')
    setSandboxMode(false)
  }

  const loadFileTree = async () => {
    if (!target) return
    try {
      const basePath = `AGTech/MetaBuilderPRO/${target.slug}`
      
      const buildTree = async (dirPath: string): Promise<FileNode[]> => {
        const entries = await tauriFs.readDir(dirPath, { baseDir: BaseDirectory.Home })
        const nodes: FileNode[] = []
        
        for (const entry of entries) {
          if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.next') continue
          
          const fullPath = `${dirPath}/${entry.name}`
          const isDir = entry.isDirectory
          
          nodes.push({
            name: entry.name,
            path: fullPath,
            isDirectory: isDir,
            children: isDir ? await buildTree(fullPath) : undefined
          })
        }
        
        return nodes.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1
          if (!a.isDirectory && b.isDirectory) return 1
          return a.name.localeCompare(b.name)
        })
      }
      
      const tree = await buildTree(basePath)
      setFileTree(tree)
    } catch (err) {
      console.error("Error reading file tree", err)
    }
  }

  const handleSelectFile = async (path: string) => {
    setSelectedFile(path)
    try {
      const content = await tauriFs.readTextFile(path, { baseDir: BaseDirectory.Home })
      setFileContent(content)
    } catch (err) {
      toast('Erro ao ler arquivo', 'error')
    }
  }

  const handleSaveFile = async (value: string | undefined) => {
    if (!selectedFile || value === undefined) return
    try {
      await tauriFs.writeTextFile(selectedFile, value, { baseDir: BaseDirectory.Home })
      setFileContent(value)
      toast('Salvo localmente!', 'success')
    } catch (err) {
      toast('Erro ao salvar', 'error')
    }
  }

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders)
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
    }
    setExpandedFolders(newExpanded)
  }

  const handleSyncFromWeb = async () => {
    if (!syncManager || !target) return
    setIsSyncing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      
      const apiRoute = target.type === 'project' ? '/api/project-source' : '/api/workspace-source'
      let payload: any = target.type === 'project' ? { projectId: target.id } : { workspaceId: target.id }
      
      // Lógica de injeção da configuração local de Banco de Dados (Tunnel)
      try {
        const configStr = await tauriFs.readTextFile('metabuilder.config.json', { baseDir: BaseDirectory.AppLocalData })
        if (configStr) {
          const tunnelConfig = JSON.parse(configStr)
          const projectConn = tunnelConfig?.connections?.find((c: any) => c.projectId === target.id)
          if (projectConn && projectConn.connectionsString && projectConn.connectionsString.length > 0) {
            const primaryConn = projectConn.connectionsString[0]
            
            payload.legacyDriver = primaryConn.type || 'postgres'
            payload.dbConfig = {
              url: primaryConn.connectionString
            }
            payload.dataMode = 'legacy'
            payload.authStrategy = 'legacy' // Adicionado para garantir que o LoginPortalClient use o BD local
          }
        }
      } catch (e) {
        // Arquivo pode não existir na primeira execução, ignoramos silenciosamente.
      }

      await syncManager.syncFromWeb(apiRoute, `Bearer ${token}`, payload)
      
      const mergeResult = await syncManager.startSyncSandbox()
      setSandboxMode(true)
      await loadFileTree()
      
      if (mergeResult.oid) {
        toast('Merge limpo! Nenhum conflito encontrado.', 'success')
      } else {
        toast('Atenção: Conflitos encontrados. Resolva no editor antes de confirmar.', 'info')
      }
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err.message;
      toast(`Erro ao sincronizar: ${msg}`, 'error')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleConfirmSync = async () => {
    if (!syncManager) return
    setIsConfirming(true)
    try {
      await syncManager.confirmSync()
      setSandboxMode(false)
      toast('Sincronização Efetivada', 'success')
    } catch (err: any) {
      toast(`Erro: ${err.message}`, 'error')
    } finally {
      setIsConfirming(false)
    }
  }

  const handleAbortSync = async () => {
    if (!syncManager) return
    setIsDiscarding(true)
    try {
      await syncManager.abortSync()
      setSandboxMode(false)
      await loadFileTree()
      setFileContent('')
      setSelectedFile(null)
      setShowDiscardConfirm(false)
      toast('Sincronização Descartada', 'info')
    } catch (err: any) {
      toast(`Erro: ${err.message}`, 'error')
    } finally {
      setIsDiscarding(false)
    }
  }

  const handleRevertCommit = async () => {
    if (!syncManager || !revertConfirmOid) return
    setIsReverting(true)
    try {
      await syncManager.revertToCommit(revertConfirmOid)
      await loadFileTree()
      setFileContent('')
      setSelectedFile(null)
      setIsLogModalOpen(false)
      setRevertConfirmOid(null)
      toast('Código revertido com sucesso!', 'success')
    } catch (err: any) {
      toast(`Erro ao reverter: ${err.message}`, 'error')
    } finally {
      setIsReverting(false)
    }
  }

  const getProjectPath = async () => {
    const home = await homeDir()
    return `${home.replace(/\\/g, '/')}/AGTech/MetaBuilderPRO/${target!.slug}`
  }

  const handleInstall = async () => {
    if (!target || isInstalling || devProcess) return
    setIsInstalling(true)
    setShowConsole(true)
    addConsoleLog('▶ Iniciando npm install...', 'info')
    try {
      const projectPath = await getProjectPath()
      const { listen } = await import('@tauri-apps/api/event')
      
      await new Promise<void>(async (resolve, reject) => {
        const unlistenInstall = await listen<boolean>('npm-install-done', (event) => {
          unlistenInstall()
          if (event.payload) resolve(); else reject(new Error('npm install falhou'))
        })
        try {
          await invoke('start_npm_install', { projectPath })
        } catch (e) {
          unlistenInstall()
          reject(e)
        }
      })

      addConsoleLog('✓ Dependências instaladas com sucesso!', 'info')
    } catch (err: any) {
      addConsoleLog(`✗ Erro no build: ${err?.message || err}`, 'error')
      toast('Erro ao instalar dependências', 'error')
    } finally {
      setIsInstalling(false)
    }
  }

  const handleStart = async () => {
    if (!target || devProcess || isInstalling) return
    setShowConsole(true)
    addConsoleLog('▶ Iniciando servidor Next.js...', 'info')
    try {
      const projectPath = await getProjectPath()
      await invoke('start_nextjs_server', { projectPath })

      const { listen } = await import('@tauri-apps/api/event')
      let serverReady = false
      const unlisten = await listen<string>('nextjs-dev-log', (event) => {
        const text = event.payload
        const lower = text.toLowerCase()
        const type = lower.includes('error') ? 'error' : lower.includes('warn') ? 'warn' : 'stdout'
        addConsoleLog(text, type)

        if (!serverReady && lower.includes('ready in')) {
          serverReady = true
          addConsoleLog('⚙ Compilando a aplicação... Aguardando primeira resposta.', 'info')

          // Warm-up: wait for first successful HTTP response before enabling open-in-browser
          const warmUp = async () => {
            for (let i = 0; i < 40; i++) {
              try {
                const res = await fetch('http://localhost:3000', { 
                  mode: 'no-cors',
                  signal: AbortSignal.timeout(8000), 
                  cache: 'no-store' 
                })
                // mode: 'no-cors' returns an opaque response with status 0, which means the server responded!
                if (res.status === 0 || res.status < 500) {
                  addConsoleLog('✓ Aplicação pronta em localhost:3000', 'info')
                  toast('Servidor pronto!', 'success')
                  return
                }
              } catch (_) {}
              await new Promise(r => setTimeout(r, 3000))
            }
          }
          warmUp()
        }

        if (text.includes('Encerrado com código')) {
          setDevProcess(null)
          setIsStoppingServer(false)
          addConsoleLog('■ Servidor encerrado.', 'info')
          unlisten()
        }
      })

      setDevProcess({
        kill: async () => {
          setIsStoppingServer(true)
          await invoke('stopcli')
          setTimeout(() => {
            setDevProcess(null)
            setIsStoppingServer(false)
          }, 5000)
        }
      } as any)

    } catch (err: any) {
      addConsoleLog(`✗ Erro ao iniciar servidor: ${err?.message || err}`, 'error')
      toast(`Erro ao iniciar servidor: ${err?.message || err}`, 'error')
    }
  }

  const handleStop = async () => {
    if (!devProcess || isStoppingServer) return
    devProcess.kill()
  }

  const handleOpenBrowser = async () => {
    addConsoleLog('↗ Abrindo localhost:3000 no browser...', 'info')
    import('@tauri-apps/plugin-shell').then(({ open }) => {
      open('http://localhost:3000')
    }).catch(() => {
      openPreview('http://localhost:3000', `Preview: ${target?.name}`)
    })
  }

  // Keep the original handleRunDev for backward compat (used by old sync flow if needed)
  const handleRunDev = handleStart


  const handleShowLogs = async () => {
    if (!syncManager) return
    try {
      const { branches: allBranches, currentBranch } = await syncManager.getBranches()
      setBranches(allBranches)
      setSelectedBranch(currentBranch)
      const logs = await syncManager.getLog(50, currentBranch)
      setGitLogs(logs)
      setIsLogModalOpen(true)
    } catch (err: any) {
      toast(`Erro ao carregar histórico: ${err.message}`, 'error')
    }
  }

  const handleBranchChange = async (branchName: string) => {
    if (!syncManager) return
    
    if (branchName === '__NEW_BRANCH__') {
      setNewBranchName('')
      setShowNewBranchModal(true)
      setSelectedBranch(selectedBranch) // Reset select value visually
      return
    }

    setSelectedBranch(branchName)
    try {
      if (isLogModalOpen) {
        const logs = await syncManager.getLog(50, branchName)
        setGitLogs(logs)
      } else {
        await syncManager.checkoutBranch(branchName)
        await loadFileTree()
        setFileContent('')
        setSelectedFile(null)
      }
    } catch (err: any) {
      toast(`Erro ao trocar branch: ${err.message}`, 'error')
    }
  }

  const handleCreateBranchSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newBranchName.trim() || !syncManager) return
    setIsCreatingBranch(true)
    const name = newBranchName.trim()
    try {
      await syncManager.createBranch(name)
      const { branches, currentBranch } = await syncManager.getBranches()
      setBranches(branches)
      setSelectedBranch(currentBranch)
      await loadFileTree()
      toast(`Branch ${name} criada com sucesso!`, 'success')
      setShowNewBranchModal(false)
    } catch (err: any) {
      toast(`Erro ao criar branch: ${err.message}`, 'error')
    } finally {
      setIsCreatingBranch(false)
    }
  }

  const handlePushToRemote = async () => {
    if (!syncManager || !target) return
    setIsPushing(true)
    try {
      const configManager = new GitConfigManager(target.slug)
      const config = await configManager.getConfig()
      if (!config.remoteUrl || !config.accessToken) {
        toast('Configure a URL e o Token do GitHub nas Configurações Git primeiro.', 'error')
        setShowGitSettings(true)
        return
      }
      await syncManager.pushToRemote(config.remoteUrl, config.accessToken, selectedBranch)
      toast(`Branch ${selectedBranch} enviada para o remoto com sucesso!`, 'success')
    } catch (err: any) {
      toast(`Erro no Push: ${err.message}`, 'error')
    } finally {
      setIsPushing(false)
    }
  }

  const handlePullFromRemote = async () => {
    if (!syncManager || !target) return
    setIsPulling(true)
    try {
      const configManager = new GitConfigManager(target.slug)
      const config = await configManager.getConfig()
      if (!config.remoteUrl || !config.accessToken) {
        toast('Configure a URL e o Token do GitHub nas Configurações Git primeiro.', 'error')
        setShowGitSettings(true)
        return
      }
      await syncManager.pullFromRemote(config.remoteUrl, config.accessToken, selectedBranch)
      await loadFileTree()
      toast(`Branch ${selectedBranch} atualizada com sucesso!`, 'success')
    } catch (err: any) {
      toast(`Erro no Pull: ${err.message}`, 'error')
    } finally {
      setIsPulling(false)
    }
  }

  const renderTree = (nodes: FileNode[]) => {
    return nodes.map(node => (
      <div key={node.path} className="ml-4">
        {node.isDirectory ? (
          <div>
            <div 
              className="flex items-center gap-1.5 py-1 px-2 hover:bg-neutral-800/50 cursor-pointer rounded text-neutral-300 text-sm"
              onClick={() => toggleFolder(node.path)}
            >
              {expandedFolders.has(node.path) ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              <Folder className="w-3.5 h-3.5 text-blue-400" />
              {node.name}
            </div>
            {expandedFolders.has(node.path) && node.children && (
              <div>{renderTree(node.children)}</div>
            )}
          </div>
        ) : (
          <div 
            className={`flex items-center gap-1.5 py-1 px-2 ml-4 cursor-pointer rounded text-sm ${selectedFile === node.path ? 'bg-indigo-600/20 text-indigo-400' : 'text-neutral-400 hover:bg-neutral-800/50'}`}
            onClick={() => handleSelectFile(node.path)}
          >
            <FileCode2 className="w-3.5 h-3.5 opacity-70" />
            {node.name}
          </div>
        )}
      </div>
    ))
  }

  const expandAll = () => {
    const allDirs = new Set<string>()
    const collect = (nodes: FileNode[]) => {
      nodes.forEach(node => {
        if (node.isDirectory) {
          allDirs.add(node.path)
          if (node.children) collect(node.children)
        }
      })
    }
    collect(fileTree)
    setExpandedFolders(allDirs)
  }

  const collapseAll = () => {
    setExpandedFolders(new Set())
  }

  return (
    <IDESyncContext.Provider value={{ openIDE }}>
      {children}
      {mounted && createPortal(
        <AnimatePresence>
          {isOpen && target && (
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
                className={`fixed inset-0 z-[99998] flex flex-col bg-[#1e1e1e] ${isMinimized ? 'pointer-events-none' : 'pointer-events-auto'}`}
              >
                {/* Header Superior - Similar ao Preview */}
                <div className="bg-[#1a1b1e] border-b border-neutral-800 flex items-center justify-between px-4 py-2 shrink-0 shadow-lg relative">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400">
                      <FolderGit2 className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-white leading-tight">IDE Local</span>
                      <span className="text-xs text-neutral-500">{target.type === 'workspace' ? 'Workspace' : 'Projeto'}: {target.name}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Botões de Ação da IDE */}
                    <div className="flex items-center gap-2 mr-4 border-r border-neutral-800 pr-4">
                      {sandboxMode ? (
                        <>
                          <button 
                            onClick={() => setShowDiscardConfirm(true)}
                            disabled={isDiscarding || isConfirming}
                            className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                          >
                            <XCircle className="w-3.5 h-3.5 text-red-400" /> {isDiscarding ? 'Descartando...' : 'Descartar'}
                          </button>
                          <button 
                            onClick={handleConfirmSync}
                            disabled={isDiscarding || isConfirming}
                            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                          >
                            {isConfirming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} {isConfirming ? 'Confirmando...' : 'Confirmar Merge'}
                          </button>
                        </>
                      ) : (
                        <button 
                          onClick={handleSyncFromWeb}
                          disabled={isSyncing}
                          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                        >
                          <DownloadCloud className="w-3.5 h-3.5" /> 
                          {isSyncing ? 'Sincronizando...' : 'Ejetar & Sincronizar'}
                        </button>
                      )}
                      
                      <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden h-8">
                        <div className="px-2 bg-neutral-800 text-neutral-400 border-r border-neutral-700 flex items-center h-full">
                          <FolderGit2 className="w-3.5 h-3.5" />
                        </div>
                        <select 
                          value={selectedBranch}
                          onChange={(e) => handleBranchChange(e.target.value)}
                          className="bg-transparent text-xs text-neutral-300 font-mono px-2 py-1 outline-none min-w-[120px] h-full"
                        >
                          <option value="__NEW_BRANCH__" className="text-emerald-400 font-bold bg-neutral-900">
                            + Nova Branch...
                          </option>
                          <optgroup label="Branches">
                            {branches.map(b => (
                              <option key={b} value={b} className="bg-neutral-900 text-neutral-300">
                                {b}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                      </div>

                      <button 
                        onClick={handlePushToRemote}
                        disabled={isPushing}
                        className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                        title="Push para Remoto (GitHub)"
                      >
                        {isPushing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />} Push
                      </button>

                      <button 
                        onClick={handlePullFromRemote}
                        disabled={isPulling}
                        className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                        title="Pull do Remoto (GitHub)"
                      >
                        {isPulling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Pull
                      </button>

                      <button 
                        onClick={handleShowLogs}
                        className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg text-xs font-semibold transition-colors"
                        title="Ver Histórico (Git Log)"
                      >
                        <History className="w-3.5 h-3.5" /> Histórico
                      </button>

                      <button 
                        onClick={() => setShowGitSettings(true)}
                        className="flex items-center justify-center w-8 h-8 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg transition-colors border border-neutral-700"
                        title="Configurações Git (Remote & Pipeline)"
                      >
                        <Settings className="w-4 h-4" />
                      </button>

                      {/* Console toggle button */}
                      <button
                        onClick={() => setShowConsole(v => !v)}
                        className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors border ${
                          showConsole
                            ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400'
                            : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white hover:bg-neutral-700'
                        }`}
                        title={showConsole ? 'Ocultar Console' : 'Mostrar Console'}
                      >
                        <PanelBottomOpen className="w-4 h-4" />
                      </button>

                      {/* Sidebar toggle button */}
                      <button
                        onClick={() => setShowSidebar(v => !v)}
                        className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors border ${
                          showSidebar
                            ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400'
                            : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white hover:bg-neutral-700'
                        }`}
                        title={showSidebar ? 'Ocultar Arquivos' : 'Mostrar Arquivos'}
                      >
                        <PanelLeftOpen className="w-4 h-4" />
                      </button>
                    </div>

                    <button 
                      onClick={() => setIsMinimized(true)}
                      className="px-3 py-1.5 rounded-lg text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-all flex items-center gap-2 text-xs font-bold" 
                      title="Minimizar IDE"
                    >
                      <Minimize2 className="w-3.5 h-3.5" />
                    </button>

                    <button 
                      onClick={closeIDE} 
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-800 hover:bg-red-500/80 text-neutral-300 hover:text-white transition-colors" 
                      title="Fechar IDE"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Main Content IDE — editor + console */}
                <div className="flex-1 flex flex-col min-h-0 bg-[#1e1e1e]">

                  {/* Editor Row */}
                  <div className="flex flex-1 min-h-0">
                    {/* Sidebar Tree */}
                    <AnimatePresence initial={false}>
                      {showSidebar && (
                        <motion.div
                          initial={{ width: 0, opacity: 0 }}
                          animate={{ width: 256, opacity: 1 }}
                          exit={{ width: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: 'easeInOut' }}
                          className="border-r border-neutral-800 bg-[#181818] overflow-y-auto overflow-x-hidden shrink-0 flex flex-col"
                        >
                          {/* Expand/Collapse all toolbar */}
                          <div className="flex items-center justify-between px-2 py-1 border-b border-neutral-800/60 shrink-0">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-600">Explorer</span>
                            <div className="flex items-center gap-0.5">
                              <button
                                onClick={expandAll}
                                title="Expandir tudo"
                                className="flex items-center justify-center w-5 h-5 rounded hover:bg-neutral-700 text-neutral-500 hover:text-neutral-200 transition-colors"
                              >
                                <UnfoldVertical className="w-3 h-3" />
                              </button>
                              <button
                                onClick={collapseAll}
                                title="Retrair tudo"
                                className="flex items-center justify-center w-5 h-5 rounded hover:bg-neutral-700 text-neutral-500 hover:text-neutral-200 transition-colors"
                              >
                                <FoldVertical className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <div className="flex-1 overflow-y-auto overflow-x-hidden py-1">
                            {renderTree(fileTree)}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Editor */}
                    <div className="flex-1 flex flex-col min-w-0">
                      <div className="h-10 bg-[#1e1e1e] border-b border-neutral-800 flex items-center justify-between px-4 text-sm text-neutral-400">
                        <span>{selectedFile ? selectedFile.replace(`AGTech/MetaBuilderPRO/${target.slug}/`, '') : 'Nenhum arquivo selecionado'}</span>
                        {selectedFile && (
                          <button
                            onClick={() => {
                              setSelectedFile(null)
                              setFileContent('')
                            }}
                            className="p-1 hover:bg-neutral-800 rounded text-neutral-500 hover:text-white transition-colors"
                            title="Fechar arquivo"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="flex-1">
                        {isSyncing ? (
                          <div className="flex flex-col items-center justify-center h-full text-neutral-500 gap-4">
                            <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                            <span className="text-sm font-medium animate-pulse text-indigo-400">Sincronizando arquivos com a nuvem...</span>
                          </div>
                        ) : ideLoadingState.isLoading ? (
                          <div className="flex flex-col items-center justify-center h-full text-neutral-500 gap-4">
                            <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                            <span className="text-sm font-medium animate-pulse text-indigo-400">{ideLoadingState.message}</span>
                          </div>
                        ) : selectedFile ? (
                          <MonacoEditor
                            language={selectedFile.endsWith('.tsx') || selectedFile.endsWith('.ts') ? 'typescript' : selectedFile.endsWith('.json') ? 'json' : 'javascript'}
                            theme="vs-dark"
                            value={fileContent}
                            onChange={val => setFileContent(val || '')}
                            options={{
                              minimap: { enabled: false },
                              fontSize: 13,
                              wordWrap: 'on',
                              padding: { top: 16 }
                            }}
                            onMount={(editor, monaco) => {
                              editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                                handleSaveFile(editor.getValue())
                              })
                            }}
                          />
                        ) : (
                          <div className="h-full flex items-center justify-center text-neutral-600">
                            Selecione um arquivo na árvore ao lado
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Console Panel */}
                  <AnimatePresence>
                    {showConsole && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 220, opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="border-t border-neutral-800 bg-[#0d0d0d] flex flex-col overflow-hidden shrink-0"
                      >
                        {/* Console toolbar */}
                        <div className="flex items-center justify-between px-3 py-1.5 border-b border-neutral-800 shrink-0 bg-[#141414]">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mr-2">Console</span>

                            {/* Build */}
                            <button
                              onClick={handleInstall}
                              disabled={isInstalling || !!devProcess || isSyncing}
                              title="Build (npm install)"
                              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition-colors disabled:opacity-40 hover:bg-neutral-800 text-neutral-400 hover:text-amber-400"
                            >
                              {isInstalling
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Package className="w-3.5 h-3.5" />}
                              <span className="hidden sm:inline">Build</span>
                            </button>

                            {/* Start / Stop toggle */}
                            {!devProcess ? (
                              <button
                                onClick={handleStart}
                                disabled={isInstalling || isSyncing}
                                title="Start (npm run dev)"
                                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition-colors disabled:opacity-40 hover:bg-neutral-800 text-neutral-400 hover:text-green-400"
                              >
                                <Play className="w-3.5 h-3.5 text-green-400" />
                                <span className="hidden sm:inline">Start</span>
                              </button>
                            ) : (
                              <button
                                onClick={handleStop}
                                disabled={isStoppingServer}
                                title="Stop servidor"
                                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition-colors disabled:opacity-40 hover:bg-neutral-800 text-neutral-400 hover:text-red-400"
                              >
                                {isStoppingServer
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  : <Square className="w-3.5 h-3.5 fill-red-400 text-red-400" />}
                                <span className="hidden sm:inline">{isStoppingServer ? 'Parando...' : 'Stop'}</span>
                              </button>
                            )}

                            {/* Open Browser */}
                            <button
                              onClick={handleOpenBrowser}
                              disabled={!devProcess}
                              title="Abrir no Browser"
                              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition-colors disabled:opacity-40 hover:bg-neutral-800 text-neutral-400 hover:text-indigo-400"
                            >
                              <AppWindow className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Browser</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-1">
                            {/* Clear */}
                            <button
                              onClick={() => setConsoleLogs([])}
                              title="Limpar Console"
                              className="flex items-center justify-center w-6 h-6 rounded hover:bg-neutral-800 text-neutral-500 hover:text-white transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            {/* Close */}
                            <button
                              onClick={() => setShowConsole(false)}
                              title="Fechar Console"
                              className="flex items-center justify-center w-6 h-6 rounded hover:bg-neutral-800 text-neutral-500 hover:text-white transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Log lines */}
                        <div className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed space-y-0.5">
                          {consoleLogs.length === 0 && (
                            <span className="text-neutral-600">Console pronto. Use os ícones acima para iniciar.</span>
                          )}
                          {consoleLogs.map((log, i) => (
                            <div key={i} className={`flex gap-2 ${
                              log.type === 'error' ? 'text-red-400'
                              : log.type === 'warn' ? 'text-yellow-400'
                              : log.type === 'info' ? 'text-cyan-400'
                              : 'text-neutral-300'
                            }`}>
                              <span className="text-neutral-600 shrink-0">{log.ts}</span>
                              <span className="break-all whitespace-pre-wrap">{log.text}</span>
                            </div>
                          ))}
                          <div ref={consoleEndRef} />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                </div>

              </motion.div>

              {/* Floating Restore Button when minimized */}
              <AnimatePresence>
                {isMinimized && (
                  <motion.div 
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 50, scale: 0.9 }}
                    className="fixed bottom-6 right-6 z-[99999] pointer-events-auto"
                  >
                    <div className="flex items-center gap-3 bg-neutral-900/90 backdrop-blur-xl border border-indigo-500/30 p-2 pl-4 pr-2 rounded-full shadow-2xl">
                      <div className="flex items-center gap-2">
                        <FolderGit2 className="w-5 h-5 text-indigo-400" />
                        <div className="flex flex-col max-w-[150px] mr-2">
                          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">IDE Local</span>
                          <span className="text-sm font-semibold text-white truncate">{target.name}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => setIsMinimized(false)}
                        className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-full text-xs font-bold transition-all shadow-lg"
                      >
                        <LayoutDashboard className="w-4 h-4" />
                        Retornar
                      </button>
                      <button 
                        onClick={closeIDE}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-500/20 text-neutral-400 hover:text-red-400 transition-colors"
                        title="Fechar IDE"
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

      {/* Git Log Modal */}
      {isLogModalOpen && isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
          <div className="bg-[#1e1e1e] border border-neutral-800 rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[80vh]">
              <div className="flex items-center justify-between p-4 border-b border-neutral-800 shrink-0 bg-neutral-900/50">
                <div className="flex items-center gap-4">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <History className="w-5 h-5 text-indigo-400" /> Histórico
                  </h2>
                  <div className="h-6 w-px bg-neutral-700 mx-2"></div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-400 font-semibold uppercase tracking-wider">Branch:</span>
                    <select
                      value={selectedBranch}
                      onChange={(e) => handleBranchChange(e.target.value)}
                      className="bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-1.5 min-w-[120px] outline-none"
                    >
                      {branches.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button 
                  onClick={() => setIsLogModalOpen(false)}
                  className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {gitLogs.length === 0 ? (
                <div className="text-center text-neutral-500 py-8">Nenhum commit encontrado.</div>
              ) : (
                gitLogs.map(log => (
                  <div key={log.oid} className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 group">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold text-white text-sm">{log.message}</div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setRevertConfirmOid(log.oid)}
                          className="opacity-0 group-hover:opacity-100 px-3 py-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 hover:text-red-300 rounded text-xs font-bold transition-all"
                        >
                          Reverter para esta versão
                        </button>
                        <div className="flex items-center gap-1.5 text-xs text-neutral-500 font-mono bg-neutral-950 px-2 py-1 rounded border border-neutral-800/50" title="Código de Hash (Identificador Único do Commit)">
                          <span className="text-neutral-600">ID:</span> {log.oid.substring(0, 7)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-neutral-400">
                      <span className="flex items-center gap-1.5"><FolderGit2 className="w-3.5 h-3.5" /> {log.author}</span>
                      <span>•</span>
                      <span>{log.timestamp}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Descarte */}
      {showDiscardConfirm && isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
          <div className="bg-[#1e1e1e] border border-neutral-800 rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-red-900/20 flex items-center justify-center mb-4">
                <XCircle className="w-6 h-6 text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Descartar Sincronização?</h2>
              <p className="text-sm text-neutral-400">
                Tem certeza que deseja descartar esta sincronização? Todas as alterações não confirmadas serão perdidas e seus arquivos voltarão ao estado anterior. Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="bg-neutral-900/50 p-4 border-t border-neutral-800 flex justify-end gap-3">
              <button 
                onClick={() => setShowDiscardConfirm(false)}
                disabled={isDiscarding}
                className="px-4 py-2 text-sm font-semibold text-neutral-300 hover:text-white transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button 
                onClick={handleAbortSync}
                disabled={isDiscarding}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-bold transition-colors shadow-lg shadow-red-500/20 disabled:opacity-50"
              >
                {isDiscarding ? 'Descartando...' : 'Sim, Descartar Tudo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Reversão */}
      {revertConfirmOid && isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
          <div className="bg-[#1e1e1e] border border-neutral-800 rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-orange-900/20 flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-orange-500" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Reverter para Commit Anterior?</h2>
              <div className="text-sm text-neutral-400 space-y-3">
                <p>
                  Amigo dev, preste muita atenção:
                </p>
                <p>
                  Se você confirmar, o seu HD será forçado a <strong>voltar no tempo</strong> exatamente para o código deste commit. 
                </p>
                <p className="text-red-400 font-semibold">
                  Se você tiver alterações pendentes que não foram comitadas, elas serão sumariamente apagadas. A responsabilidade é inteiramente sua. 
                </p>
              </div>
            </div>
            <div className="bg-neutral-900/50 p-4 border-t border-neutral-800 flex justify-end gap-3">
              <button 
                onClick={() => setRevertConfirmOid(null)}
                disabled={isReverting}
                className="px-4 py-2 text-sm font-semibold text-neutral-300 hover:text-white transition-colors disabled:opacity-50"
              >
                Vou pensar melhor
              </button>
              <button 
                onClick={handleRevertCommit}
                disabled={isReverting}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm font-bold transition-colors shadow-lg shadow-orange-500/20 disabled:opacity-50"
              >
                {isReverting ? 'Revertendo...' : 'Sim, Reverter e Apagar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nova Branch */}
      {showNewBranchModal && isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999999] flex items-center justify-center p-4">
          <div className="bg-[#1e1e1e] border border-neutral-800 rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-emerald-900/20 flex items-center justify-center mb-4">
                <GitBranch className="w-6 h-6 text-emerald-500" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Criar Nova Branch</h2>
              <p className="text-sm text-neutral-400 mb-6">
                Digite um nome para a sua nova branch. Ela será criada a partir da branch atual e você já será movido para ela.
              </p>
              
              <form onSubmit={handleCreateBranchSubmit}>
                <input 
                  type="text" 
                  value={newBranchName}
                  onChange={e => setNewBranchName(e.target.value)}
                  placeholder="Ex: feat/nova-tela"
                  autoFocus
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono mb-6"
                />

                <div className="flex justify-end gap-3">
                  <button 
                    type="button"
                    onClick={() => setShowNewBranchModal(false)}
                    disabled={isCreatingBranch}
                    className="px-4 py-2 text-sm font-semibold text-neutral-400 hover:text-white transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={!newBranchName.trim() || isCreatingBranch}
                    className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                  >
                    {isCreatingBranch ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Criar Branch
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <IDEGitSettingsModal 
        isOpen={showGitSettings} 
        onClose={() => setShowGitSettings(false)} 
        projectSlug={target?.slug || ''} 
      />
    </IDESyncContext.Provider>
  )
}
