'use client'

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  FolderGit2, Play, DownloadCloud, AlertTriangle, 
  CheckCircle2, XCircle, FileCode2, ChevronRight, ChevronDown, Folder, History, X, Minimize2, AppWindow, LayoutDashboard, Loader2, Settings, Plus, Network, UploadCloud, Download, GitBranch,
  Package, Square, Trash2, PanelBottomOpen, PanelLeftOpen, UnfoldVertical, FoldVertical,
  FilePlus, FolderPlus, Pencil, Copy, Scissors, ClipboardPaste, MoreVertical, Undo2, Undo
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
import { useI18n } from '@/i18n'

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

export type UndoAction = 
  | { type: 'delete', originalPaths: { path: string, trashPath: string, isDirectory: boolean }[] }
  | { type: 'rename', oldPath: string, newPath: string }
  | { type: 'new', path: string, isDirectory: boolean }
  | { type: 'copy', destPaths: string[] }
  | { type: 'move', moves: { originalPath: string, newPath: string }[] }

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
  const { t } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [target, setTarget] = useState<IDETarget | null>(null)
  
  const [syncManager, setSyncManager] = useState<LocalSyncManager | null>(null)
  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [openFiles, setOpenFiles] = useState<string[]>([])
  const [fileContents, setFileContents] = useState<Record<string, string>>({})
  const [activeFile, setActiveFile] = useState<string | null>(null)
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

  // File explorer context menu state
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; node: FileNode } | null>(null)
  const [fileActionModal, setFileActionModal] = useState<{ type: 'rename' | 'new-file' | 'new-folder' | 'copy' | 'move'; node?: FileNode; destPath?: string } | null>(null)
  const [fileActionInput, setFileActionInput] = useState('')
  const [fileActionLoading, setFileActionLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ mode: 'trash' | 'permanent' | 'empty', nodes?: FileNode[] } | null>(null)
  const [clipboard, setClipboard] = useState<{ nodes: FileNode[]; op: 'copy' | 'cut' } | null>(null)
  
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
  const [lastSelectedPath, setLastSelectedPath] = useState<string | null>(null)
  const [undoStack, setUndoStack] = useState<UndoAction[]>([])
  
  const [explorerWidth, setExplorerWidth] = useState(256)
  const [consoleHeight, setConsoleHeight] = useState(200)
  const [explorerActiveTab, setExplorerActiveTab] = useState<'explorer' | 'trash'>('explorer')
  const isResizingExplorer = useRef(false)
  const isResizingConsole = useRef(false)

  const getNodesFromPaths = (paths: string[]): FileNode[] => {
    const nodes: FileNode[] = []
    const findNodes = (treeNodes: FileNode[]) => {
      for (const node of treeNodes) {
        if (paths.includes(node.path)) nodes.push(node)
        if (node.children) findNodes(node.children)
      }
    }
    findNodes(fileTree)
    return nodes
  }
  
  const [mounted, setMounted] = useState(false)
  const { toast } = useToast()
  const { openPreview } = usePreview()
  const supabase = createClient()

  useEffect(() => {
    setMounted(true)
  }, [])

  // ESC fecha menu de contexto e modais de ação de arquivo
  // Ctrl+Z para Desfazer
  // Teclado Delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCtxMenu(null)
        setDeleteConfirm(null)
        setFileActionModal(null)
        setShowDiscardConfirm(false)
      } else if (e.key === 'Enter') {
        if (deleteConfirm) {
          e.preventDefault()
          if (deleteConfirm.mode === 'trash' && deleteConfirm.nodes) handleDeleteNode(deleteConfirm.nodes)
          if (deleteConfirm.mode === 'permanent' && deleteConfirm.nodes) handlePermanentDelete(deleteConfirm.nodes)
          if (deleteConfirm.mode === 'empty') handleEmptyTrash()
          setDeleteConfirm(null)
        } else if (showDiscardConfirm) {
          e.preventDefault()
          handleAbortSync()
          setShowDiscardConfirm(false)
        }
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        if (undoStack.length > 0 && !fileActionLoading) {
          e.preventDefault()
          handleUndo()
        }
      } else if (e.key === 'Delete') {
        if (!fileActionModal && !deleteConfirm && !showDiscardConfirm && selectedPaths.size > 0 && !fileActionLoading) {
          const nodes = getNodesFromPaths(Array.from(selectedPaths))
          setDeleteConfirm({ mode: explorerActiveTab === 'trash' ? 'permanent' : 'trash', nodes })
        }
      }
    }
    
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingExplorer.current) {
        let newWidth = e.clientX - 64 // 64 is the app side nav width approx
        if (newWidth < 150) newWidth = 150
        if (newWidth > 600) newWidth = 600
        setExplorerWidth(newWidth)
      } else if (isResizingConsole.current) {
        let newHeight = window.innerHeight - e.clientY
        if (newHeight < 100) newHeight = 100
        if (newHeight > 600) newHeight = 600
        setConsoleHeight(newHeight)
      }
    }
    
    const handleMouseUp = () => {
      isResizingExplorer.current = false
      isResizingConsole.current = false
      document.body.style.cursor = 'default'
      document.body.style.userSelect = 'auto'
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [undoStack, fileActionLoading, selectedPaths, deleteConfirm, fileActionModal, explorerActiveTab, fileTree, showDiscardConfirm])

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
    setOpenFiles([])
    setFileContents({})
    setActiveFile(null)
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
          if (a.name === '.trash') return 1
          if (b.name === '.trash') return -1
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

  const getTrashDir = () => `AGTech/MetaBuilderPRO/${target?.slug}/.trash`

  const moveToTrash = async (nodes: FileNode[]): Promise<{ path: string, trashPath: string, isDirectory: boolean }[]> => {
    const trashDir = getTrashDir()
    await tauriFs.mkdir(trashDir, { baseDir: BaseDirectory.Home, recursive: true })
    const timestamp = Date.now()
    const movedFiles = []
    
    const projectRoot = trashDir.replace('/.trash', '')
    for (const node of nodes) {
      const relPath = node.path.substring(projectRoot.length + 1)
      const encodedName = relPath.replace(/\//g, '___')
      const trashPath = `${trashDir}/${timestamp}_${encodedName}`
      await tauriFs.rename(node.path, trashPath, { oldPathBaseDir: BaseDirectory.Home, newPathBaseDir: BaseDirectory.Home })
      movedFiles.push({ path: node.path, trashPath, isDirectory: node.isDirectory })
    }
    return movedFiles
  }

  const handleUndo = async () => {
    if (undoStack.length === 0) return
    const action = undoStack[undoStack.length - 1]
    const newStack = undoStack.slice(0, -1)
    setUndoStack(newStack)
    try {
      setFileActionLoading(true)
      if (action.type === 'delete') {
        for (const f of action.originalPaths) {
          if (!(await tauriFs.exists(f.trashPath, { baseDir: BaseDirectory.Home }))) continue
          const parentDir = f.path.substring(0, f.path.lastIndexOf('/'))
          await tauriFs.mkdir(parentDir, { baseDir: BaseDirectory.Home, recursive: true })
          await tauriFs.rename(f.trashPath, f.path, { oldPathBaseDir: BaseDirectory.Home, newPathBaseDir: BaseDirectory.Home })
        }
      } else if (action.type === 'rename') {
        if (await tauriFs.exists(action.newPath, { baseDir: BaseDirectory.Home })) {
          await tauriFs.rename(action.newPath, action.oldPath, { oldPathBaseDir: BaseDirectory.Home, newPathBaseDir: BaseDirectory.Home })
        }
      } else if (action.type === 'new' || action.type === 'copy') {
        const trashDir = getTrashDir()
        await tauriFs.mkdir(trashDir, { baseDir: BaseDirectory.Home, recursive: true })
        const timestamp = Date.now()
        const pathsToDelete = action.type === 'new' ? [action.path] : action.destPaths
        for (const p of pathsToDelete) {
          if (!(await tauriFs.exists(p, { baseDir: BaseDirectory.Home }))) continue
          const name = p.split('/').pop()
          await tauriFs.rename(p, `${trashDir}/${timestamp}_undo_${name}`, { oldPathBaseDir: BaseDirectory.Home, newPathBaseDir: BaseDirectory.Home })
        }
      } else if (action.type === 'move') {
        for (const m of action.moves) {
          if (!(await tauriFs.exists(m.newPath, { baseDir: BaseDirectory.Home }))) continue
          const parentDir = m.originalPath.substring(0, m.originalPath.lastIndexOf('/'))
          await tauriFs.mkdir(parentDir, { baseDir: BaseDirectory.Home, recursive: true })
          await tauriFs.rename(m.newPath, m.originalPath, { oldPathBaseDir: BaseDirectory.Home, newPathBaseDir: BaseDirectory.Home })
        }
      }
      
      await loadFileTree()
      toast('Ação desfeita com sucesso!', 'success')
    } catch (e: any) {
      toast(`Erro ao desfazer: ${e?.message || e || 'Erro desconhecido'}`, 'error')
    } finally {
      setFileActionLoading(false)
    }
  }

  const getVisibleNodes = (nodes: FileNode[]): string[] => {
    let result: string[] = []
    for (const node of nodes) {
      result.push(node.path)
      if (node.isDirectory && expandedFolders.has(node.path) && node.children) {
        result = result.concat(getVisibleNodes(node.children))
      }
    }
    return result
  }

  const handleSelection = (path: string, modifier?: 'ctrl' | 'shift') => {
    if (modifier === 'ctrl') {
      const newSel = new Set(selectedPaths)
      if (newSel.has(path)) newSel.delete(path)
      else newSel.add(path)
      setSelectedPaths(newSel)
      setLastSelectedPath(path)
    } else if (modifier === 'shift' && lastSelectedPath) {
      let rootNodes = fileTree
      if (explorerActiveTab === 'trash') {
        const trashNode = fileTree.find(n => n.name === '.trash')
        rootNodes = trashNode?.children || []
      } else {
        rootNodes = fileTree.filter(n => n.name !== '.trash')
      }
      const visible = getVisibleNodes(rootNodes)
      const idx1 = visible.indexOf(lastSelectedPath)
      const idx2 = visible.indexOf(path)
      if (idx1 !== -1 && idx2 !== -1) {
        const start = Math.min(idx1, idx2)
        const end = Math.max(idx1, idx2)
        const newSel = new Set(selectedPaths)
        for (let i = start; i <= end; i++) {
          newSel.add(visible[i])
        }
        setSelectedPaths(newSel)
      }
    } else {
      setSelectedPaths(new Set([path]))
      setLastSelectedPath(path)
    }
  }
  const handleEmptyTrash = async () => {
    const trashDir = getTrashDir()
    try {
      setFileActionLoading(true)
      await tauriFs.remove(trashDir, { baseDir: BaseDirectory.Home, recursive: true })
      await tauriFs.mkdir(trashDir, { baseDir: BaseDirectory.Home, recursive: true })
      await loadFileTree()
      toast('Lixeira esvaziada.', 'success')
    } catch (e: any) {
      toast('Erro ao esvaziar lixeira: ' + e.message, 'error')
    } finally {
      setFileActionLoading(false)
    }
  }

  const handlePermanentDelete = async (nodes: FileNode[]) => {
    try {
      setFileActionLoading(true)
      for (const node of nodes) {
        await tauriFs.remove(node.path, { baseDir: BaseDirectory.Home, recursive: node.isDirectory })
      }
      setSelectedPaths(new Set())
      await loadFileTree()
      toast(`${nodes.length} item(s) deletado(s) permanentemente.`, 'success')
    } catch (e: any) {
      toast('Erro ao deletar: ' + e.message, 'error')
    } finally {
      setFileActionLoading(false)
    }
  }

  const handleRestoreFromTrash = async (nodes: FileNode[]) => {
    try {
      setFileActionLoading(true)
      const projectRoot = getTrashDir().replace('/.trash', '')
      for (const node of nodes) {
        const parts = node.name.split('_')
        if (parts.length > 1) {
          parts.shift() // remove timestamp
        }
        const originalName = parts.join('_').replace(/___/g, '/')
        const newPath = `${projectRoot}/${originalName}`
        
        const parentDir = newPath.substring(0, newPath.lastIndexOf('/'))
        await tauriFs.mkdir(parentDir, { baseDir: BaseDirectory.Home, recursive: true })
        await tauriFs.rename(node.path, newPath, { oldPathBaseDir: BaseDirectory.Home, newPathBaseDir: BaseDirectory.Home })
      }
      setSelectedPaths(new Set())
      await loadFileTree()
      toast(`${nodes.length} item(s) restaurado(s).`, 'success')
    } catch (e: any) {
      toast('Erro ao restaurar: ' + e.message, 'error')
    } finally {
      setFileActionLoading(false)
    }
  }

  const handleCloseFile = (e: React.MouseEvent, path: string) => {
    e.stopPropagation()
    setOpenFiles(prev => {
      const newFiles = prev.filter(p => p !== path)
      setActiveFile(curr => {
        if (curr === path) {
          const idx = prev.indexOf(path)
          return newFiles.length > 0 ? newFiles[Math.min(idx, newFiles.length - 1)] : null
        }
        return curr
      })
      return newFiles
    })
    setFileContents(prev => {
      const newContents = { ...prev }
      delete newContents[path]
      return newContents
    })
  }

  const handleSelectFile = async (path: string, modifier?: 'ctrl' | 'shift') => {
    setCtxMenu(null) // Fecha o menu de contexto ao abrir um arquivo
    handleSelection(path, modifier)
    if (modifier === 'shift' || modifier === 'ctrl') return // Don't open file in editor for multi-select clicks
    
    setOpenFiles(prev => prev.includes(path) ? prev : [...prev, path])
    setActiveFile(path)
    if (fileContents[path] === undefined) {
      try {
        const content = await tauriFs.readTextFile(path, { baseDir: BaseDirectory.Home })
        setFileContents(prev => ({ ...prev, [path]: content }))
      } catch (err) {
        toast('Erro ao ler arquivo', 'error')
      }
    }
  }

  const handleSaveFile = async (value: string | undefined) => {
    if (!activeFile || value === undefined) return
    try {
      await tauriFs.writeTextFile(activeFile, value, { baseDir: BaseDirectory.Home })
      setFileContents(prev => ({ ...prev, [activeFile]: value }))
      toast('Salvo localmente!', 'success')
    } catch (err) {
      toast('Erro ao salvar', 'error')
    }
  }

  const toggleFolder = (path: string, modifier?: 'ctrl' | 'shift') => {
    setCtxMenu(null) // Fecha o menu de contexto ao abrir/fechar pasta
    if (modifier) {
      handleSelection(path, modifier)
      return
    }
    handleSelection(path)
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
      setFileContents({})
      setOpenFiles([])
      setActiveFile(null)
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
      setFileContents({})
      setOpenFiles([])
      setActiveFile(null)
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
        setFileContents({})
        setOpenFiles([])
        setActiveFile(null)
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

  // ── File Explorer Operations ────────────────────────────────────────────────

  const projectDir = target ? `AGTech/MetaBuilderPRO/${target.slug}` : ''

  const fsAbsPath = (relativePath: string) => {
    // relativePath is stored as relative inside the project dir
    return relativePath
  }

  const handleDeleteNode = async (nodesToDelete: FileNode[]) => {
    try {
      setFileActionLoading(true)
      const moved = await moveToTrash(nodesToDelete)
      
      setUndoStack(prev => [...prev, { type: 'delete', originalPaths: moved }])
      
      for (const node of nodesToDelete) {
        setOpenFiles(prev => {
          const newFiles = prev.filter(p => p !== node.path && !p.startsWith(node.path + '/'))
          setActiveFile(curr => (curr === node.path || (curr && curr.startsWith(node.path + '/'))) ? (newFiles.length > 0 ? newFiles[newFiles.length - 1] : null) : curr)
          return newFiles
        })
      }
      setSelectedPaths(new Set())
      await loadFileTree()
      toast(`${nodesToDelete.length} item(s) deletado(s).`, 'success')
    } catch (e: any) {
      toast('Erro ao deletar: ' + e.message, 'error')
    } finally {
      setFileActionLoading(false)
      setDeleteConfirm(null)
    }
  }

  const handleRenameNode = async (node: FileNode, newName: string) => {
    if (!newName.trim()) return
    try {
      setFileActionLoading(true)
      const parentPath = node.path.substring(0, node.path.lastIndexOf('/'))
      const newPath = `${parentPath}/${newName.trim()}`
      await tauriFs.rename(node.path, newPath, { oldPathBaseDir: BaseDirectory.Home, newPathBaseDir: BaseDirectory.Home })
      
      setUndoStack(prev => [...prev, { type: 'rename', oldPath: node.path, newPath }])
      
      setOpenFiles(prev => prev.map(p => p === node.path ? newPath : p))
      setFileContents(prev => {
        if (prev[node.path] !== undefined) {
          const newContents = { ...prev, [newPath]: prev[node.path] }
          delete newContents[node.path]
          return newContents
        }
        return prev
      })
      setActiveFile(curr => curr === node.path ? newPath : curr)
      
      const newSel = new Set(selectedPaths)
      if (newSel.has(node.path)) {
        newSel.delete(node.path)
        newSel.add(newPath)
        setSelectedPaths(newSel)
      }
      
      await loadFileTree()
      toast(`Renomeado para '${newName.trim()}'.`, 'success')
    } catch (e: any) {
      toast('Erro ao renomear: ' + e.message, 'error')
    } finally {
      setFileActionLoading(false)
      setFileActionModal(null)
    }
  }

  const handleNewItem = async (parentNode: FileNode, name: string, isDir: boolean) => {
    if (!name.trim()) return
    try {
      setFileActionLoading(true)
      const newPath = `${parentNode.path}/${name.trim()}`
      if (isDir) {
        await tauriFs.mkdir(newPath, { baseDir: BaseDirectory.Home, recursive: true })
      } else {
        await tauriFs.writeTextFile(newPath, '', { baseDir: BaseDirectory.Home })
      }
      
      setUndoStack(prev => [...prev, { type: 'new', path: newPath, isDirectory: isDir }])
      
      // Auto-expand parent
      setExpandedFolders(prev => { const s = new Set(prev); s.add(parentNode.path); return s })
      await loadFileTree()
      toast(`'${name.trim()}' criado com sucesso.`, 'success')
    } catch (e: any) {
      toast('Erro ao criar: ' + e.message, 'error')
    } finally {
      setFileActionLoading(false)
      setFileActionModal(null)
    }
  }

  // Copia recursivamente um diretório inteiro
  const copyDirRecursive = async (srcPath: string, destPath: string): Promise<void> => {
    await tauriFs.mkdir(destPath, { baseDir: BaseDirectory.Home, recursive: true })
    const entries = await tauriFs.readDir(srcPath, { baseDir: BaseDirectory.Home })
    for (const entry of entries) {
      const entrySrc = `${srcPath}/${entry.name}`
      const entryDest = `${destPath}/${entry.name}`
      if (entry.isDirectory) {
        await copyDirRecursive(entrySrc, entryDest)
      } else {
        await tauriFs.copyFile(entrySrc, entryDest, { fromPathBaseDir: BaseDirectory.Home, toPathBaseDir: BaseDirectory.Home })
      }
    }
  }

  const handleCopyPasteNode = async (dest: FileNode) => {
    if (!clipboard || clipboard.nodes.length === 0) return
    const { nodes, op } = clipboard
    try {
      setFileActionLoading(true)
      const destDir = dest.isDirectory ? dest.path : dest.path.substring(0, dest.path.lastIndexOf('/'))
      
      const newDestPaths: string[] = []
      const moves: { originalPath: string, newPath: string }[] = []
      
      for (const clipNode of nodes) {
        const newPath = `${destDir}/${clipNode.name}`
        if (clipNode.isDirectory) {
          await copyDirRecursive(clipNode.path, newPath)
        } else {
          await tauriFs.copyFile(clipNode.path, newPath, { fromPathBaseDir: BaseDirectory.Home, toPathBaseDir: BaseDirectory.Home })
        }
        if (op === 'cut') {
          await tauriFs.remove(clipNode.path, { baseDir: BaseDirectory.Home, recursive: clipNode.isDirectory })
          moves.push({ originalPath: clipNode.path, newPath })
        } else {
          newDestPaths.push(newPath)
        }
      }
      
      if (op === 'cut') {
        setUndoStack(prev => [...prev, { type: 'move', moves }])
        setClipboard(null)
      } else {
        setUndoStack(prev => [...prev, { type: 'copy', destPaths: newDestPaths }])
      }
      
      setExpandedFolders(prev => { const s = new Set(prev); s.add(destDir); return s })
      await loadFileTree()
      toast(`${nodes.length} item(s) ${op === 'copy' ? 'copiado(s)' : 'movido(s)'} com sucesso.`, 'success')
    } catch (e: any) {
      toast('Erro ao colar: ' + e.message, 'error')
    } finally {
      setFileActionLoading(false)
    }
  }

  const renderTree = (nodes: FileNode[], depth: number = 0): React.ReactNode => {
    let visibleNodes = nodes
    if (depth === 0) {
      if (explorerActiveTab === 'explorer') {
        visibleNodes = nodes.filter(n => n.name !== '.trash')
      } else {
        const trashNode = nodes.find(n => n.name === '.trash')
        visibleNodes = trashNode?.children || []
      }
    }

    return visibleNodes.map(node => {
      const isSelected = selectedPaths.has(node.path)
      const isTrashNode = node.name === '.trash'
      const displayNodeName = isTrashNode ? '🗑️ Lixeira' : node.name
      return (
      <div key={node.path} className={depth === 0 ? '' : 'ml-4'}>
        {node.isDirectory ? (
          <div>
            <div 
              className={`group flex items-center gap-1.5 py-1 px-2 hover:bg-neutral-800/50 cursor-pointer rounded text-neutral-300 text-sm ${clipboard?.nodes.find(n => n.path === node.path) && clipboard.op === 'cut' ? 'opacity-50' : ''} ${isSelected ? 'bg-indigo-600/20 text-indigo-400' : ''}`}
              onClick={(e) => toggleFolder(node.path, e.ctrlKey ? 'ctrl' : e.shiftKey ? 'shift' : undefined)}
              onContextMenu={(e) => { 
                e.preventDefault(); 
                if (!selectedPaths.has(node.path)) {
                  handleSelection(node.path) // Select if not already in multi-select
                }
                setCtxMenu({ x: e.clientX, y: e.clientY, node }) 
              }}
            >
              {expandedFolders.has(node.path) ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />}
              {!isTrashNode && <Folder className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />}
              <span className={`truncate flex-1 ${isTrashNode ? 'text-red-400 font-bold' : ''}`}>{displayNodeName}</span>
              {clipboard && !isTrashNode && (
                <button
                  className="opacity-0 group-hover:opacity-100 ml-auto p-0.5 rounded hover:bg-indigo-600/30 text-indigo-400 flex-shrink-0"
                  title="Colar aqui"
                  onClick={(e) => { e.stopPropagation(); handleCopyPasteNode(node) }}
                ><ClipboardPaste className="w-3 h-3" /></button>
              )}
              <button
                className="opacity-0 group-hover:opacity-100 ml-1 p-0.5 rounded hover:bg-neutral-700"
                title="Mais ações"
                onClick={(e) => { 
                  e.stopPropagation(); 
                  if (!selectedPaths.has(node.path)) handleSelection(node.path);
                  setCtxMenu({ x: e.currentTarget.getBoundingClientRect().right, y: e.currentTarget.getBoundingClientRect().bottom, node }) 
                }}
              ><MoreVertical className="w-3 h-3 text-neutral-500" /></button>
            </div>
            {expandedFolders.has(node.path) && node.children && (
              <div>{renderTree(node.children, depth + 1)}</div>
            )}
          </div>
        ) : (
          <div 
            className={`group flex items-center gap-1.5 py-1 px-2 ml-4 cursor-pointer rounded text-sm ${isSelected ? 'bg-indigo-600/20 text-indigo-400' : 'text-neutral-400 hover:bg-neutral-800/50'} ${clipboard?.nodes.find(n => n.path === node.path) && clipboard.op === 'cut' ? 'opacity-50' : ''}`}
            onClick={(e) => handleSelectFile(node.path, e.ctrlKey ? 'ctrl' : e.shiftKey ? 'shift' : undefined)}
            onContextMenu={(e) => { 
              e.preventDefault(); 
              if (!selectedPaths.has(node.path)) handleSelection(node.path);
              setCtxMenu({ x: e.clientX, y: e.clientY, node }) 
            }}
          >
            <FileCode2 className="w-3.5 h-3.5 opacity-70 flex-shrink-0" />
            <span className="truncate flex-1">{node.name}</span>
            <button
              className="opacity-0 group-hover:opacity-100 ml-auto p-0.5 rounded hover:bg-neutral-700 flex-shrink-0"
              title="Mais ações"
              onClick={(e) => { 
                e.stopPropagation(); 
                if (!selectedPaths.has(node.path)) handleSelection(node.path);
                setCtxMenu({ x: e.currentTarget.getBoundingClientRect().right, y: e.currentTarget.getBoundingClientRect().bottom, node }) 
              }}
            ><MoreVertical className="w-3 h-3 text-neutral-500" /></button>
          </div>
        )}
      </div>
    )})
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
                      <span className="text-sm font-bold text-white leading-tight">{t('workspace_components.ide_local.title', 'IDE Local')}</span>
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
                            <XCircle className="w-3.5 h-3.5 text-red-400" /> {isDiscarding ? t('workspace_components.ide_local.discarding', 'Descartando...') : t('workspace_components.ide_local.discard', 'Descartar')}
                          </button>
                          <button 
                            onClick={handleConfirmSync}
                            disabled={isDiscarding || isConfirming}
                            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                          >
                            {isConfirming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} {isConfirming ? t('workspace_components.ide_local.confirming', 'Confirmando...') : t('workspace_components.ide_local.confirm_merge', 'Confirmar Merge')}
                          </button>
                        </>
                      ) : (
                        <button 
                          onClick={handleSyncFromWeb}
                          disabled={isSyncing}
                          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                        >
                          <DownloadCloud className="w-3.5 h-3.5" /> 
                          {isSyncing ? t('workspace_components.ide_local.syncing', 'Sincronizando...') : t('workspace_components.ide_local.eject_sync', 'Ejetar & Sincronizar')}
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
                            {t('workspace_components.ide_local.new_branch', '+ Nova Branch...')}
                          </option>
                          <optgroup label={t('workspace_components.ide_local.branches_group', 'Branches')}>
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
                        title={t('workspace_components.ide_local.push_tooltip', 'Push para Remoto (GitHub)')}
                      >
                        {isPushing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />} Push
                      </button>

                      <button 
                        onClick={handlePullFromRemote}
                        disabled={isPulling}
                        className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                        title={t('workspace_components.ide_local.pull_tooltip', 'Pull do Remoto (GitHub)')}
                      >
                        {isPulling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Pull
                      </button>

                      <button 
                        onClick={handleShowLogs}
                        className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg text-xs font-semibold transition-colors"
                        title={t('workspace_components.ide_local.history_tooltip', 'Ver Histórico (Git Log)')}
                      >
                        <History className="w-3.5 h-3.5" /> {t('workspace_components.ide_local.history_btn', 'Histórico')}
                      </button>

                      <button 
                        onClick={() => setShowGitSettings(true)}
                        className="flex items-center justify-center w-8 h-8 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg transition-colors border border-neutral-700"
                        title={t('workspace_components.ide_local.git_settings_tooltip', 'Configurações Git (Remote & Pipeline)')}
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
                        title={showConsole ? t('workspace_components.ide_local.hide_console', 'Ocultar Console') : t('workspace_components.ide_local.show_console', 'Mostrar Console')}
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
                        title={showSidebar ? t('workspace_components.ide_local.hide_files', 'Ocultar Arquivos') : t('workspace_components.ide_local.show_files', 'Mostrar Arquivos')}
                      >
                        <PanelLeftOpen className="w-4 h-4" />
                      </button>
                    </div>

                    <button 
                      onClick={() => setIsMinimized(true)}
                      className="px-3 py-1.5 rounded-lg text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-all flex items-center gap-2 text-xs font-bold" 
                      title={t('workspace_components.ide_local.minimize_ide', 'Minimizar IDE')}
                    >
                      <Minimize2 className="w-3.5 h-3.5" />
                    </button>

                    <button 
                      onClick={closeIDE} 
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-800 hover:bg-red-500/80 text-neutral-300 hover:text-white transition-colors" 
                      title={t('workspace_components.ide_local.close_ide', 'Fechar IDE')}
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
                          animate={{ width: explorerWidth, opacity: 1 }}
                          exit={{ width: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: 'easeInOut' }}
                          className="border-r border-neutral-800 bg-[#181818] overflow-y-auto overflow-x-hidden shrink-0 flex flex-col"
                        >
                          {/* Explorer Header / Tabs */}
                          <div className="flex items-center justify-between border-b border-neutral-800/60 shrink-0">
                            <div className="flex items-center h-full">
                              <button 
                                onClick={() => setExplorerActiveTab('explorer')}
                                className={`px-2.5 py-1.5 h-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 border-r border-neutral-800/60 transition-colors ${explorerActiveTab === 'explorer' ? 'text-indigo-400 bg-neutral-800/30' : 'text-neutral-500 hover:bg-neutral-800/20'}`}
                              >
                                <Network className="w-3 h-3" /> {t('workspace_components.ide_local.explorer', 'Explorer')}
                              </button>
                              <button 
                                onClick={() => setExplorerActiveTab('trash')}
                                className={`px-2.5 py-1.5 h-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 border-r border-neutral-800/60 transition-colors ${explorerActiveTab === 'trash' ? 'text-red-400 bg-red-900/10' : 'text-neutral-500 hover:bg-neutral-800/20'}`}
                              >
                                <Trash2 className="w-3 h-3" /> {t('workspace_components.ide_local.trash', 'Lixeira')}
                              </button>
                            </div>
                            <div className="flex items-center gap-0.5 px-2">
                              {explorerActiveTab === 'trash' && (fileTree.find(n => n.name === '.trash')?.children?.length || 0) > 0 && (
                                <button
                                  onClick={() => setDeleteConfirm({ mode: 'empty' })}
                                  title={t('workspace_components.ide_local.empty_trash', 'Esvaziar Lixeira')}
                                  className="flex items-center justify-center w-5 h-5 rounded hover:bg-red-900/40 text-red-400 hover:text-red-300 transition-colors mr-1"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                              {undoStack.length > 0 && (
                                <button
                                  onClick={handleUndo}
                                  title={t('workspace_components.ide_local.undo_tooltip', 'Desfazer (Ctrl+Z)')}
                                  className="flex items-center justify-center w-5 h-5 rounded hover:bg-neutral-700 text-indigo-400 hover:text-indigo-300 transition-colors mr-1"
                                >
                                  <Undo className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={expandAll}
                                title={t('workspace_components.ide_local.expand_all', 'Expandir tudo')}
                                className="flex items-center justify-center w-5 h-5 rounded hover:bg-neutral-700 text-neutral-500 hover:text-neutral-200 transition-colors"
                              >
                                <UnfoldVertical className="w-3 h-3" />
                              </button>
                              <button
                                onClick={collapseAll}
                                title={t('workspace_components.ide_local.collapse_all', 'Retrair tudo')}
                                className="flex items-center justify-center w-5 h-5 rounded hover:bg-neutral-700 text-neutral-500 hover:text-neutral-200 transition-colors"
                              >
                                <FoldVertical className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <div className="flex-1 overflow-y-auto overflow-x-hidden py-1 select-none">
                            {renderTree(fileTree)}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Horizontal Drag Handle (Explorer vs Editor) */}
                    {showSidebar && (
                      <div 
                        className="w-1 cursor-col-resize hover:bg-indigo-500/50 transition-colors shrink-0 z-10"
                        onMouseDown={() => {
                          isResizingExplorer.current = true
                          document.body.style.cursor = 'col-resize'
                          document.body.style.userSelect = 'none'
                        }}
                      />
                    )}

                    {/* Editor */}
                    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                      <div className="h-10 bg-[#1e1e1e] border-b border-neutral-800 flex items-center overflow-x-auto whitespace-nowrap scrollbar-hide text-sm text-neutral-400 flex-shrink-0">
                        {openFiles.length === 0 && (
                          <span className="px-4 opacity-50">{t('workspace_components.ide_local.no_file_selected', 'Nenhum arquivo selecionado')}</span>
                        )}
                        {openFiles.map(path => {
                          const isActive = path === activeFile;
                          return (
                            <div 
                              key={path}
                              onClick={() => setActiveFile(path)}
                              onMouseUp={(e) => { if (e.button === 1) handleCloseFile(e, path) }}
                              className={`h-full flex items-center px-4 border-r border-neutral-800 cursor-pointer select-none transition-colors group ${isActive ? 'bg-[#252526] text-white border-t-2 border-t-indigo-500' : 'bg-[#2d2d2d] hover:bg-[#252526]'}`}
                            >
                              <span className="mr-2 truncate max-w-[200px]" title={path.replace(`AGTech/MetaBuilderPRO/${target?.slug}/`, '')}>
                                {path.split('/').pop()}
                              </span>
                              <button
                                onClick={(e) => handleCloseFile(e, path)}
                                className={`p-0.5 rounded transition-colors ${isActive ? 'text-neutral-400 hover:bg-neutral-700 hover:text-white' : 'opacity-0 group-hover:opacity-100 text-neutral-500 hover:bg-neutral-700 hover:text-white'}`}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex-1 min-h-0 relative">
                        {isSyncing ? (
                          <div className="flex flex-col items-center justify-center h-full text-neutral-500 gap-4">
                            <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                            <span className="text-sm font-medium animate-pulse text-indigo-400">{t('workspace_components.ide_local.syncing_cloud', 'Sincronizando arquivos com a nuvem...')}</span>
                          </div>
                        ) : ideLoadingState.isLoading ? (
                          <div className="flex flex-col items-center justify-center h-full text-neutral-500 gap-4">
                            <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                            <span className="text-sm font-medium animate-pulse text-indigo-400">{ideLoadingState.message}</span>
                          </div>
                        ) : activeFile ? (
                          <MonacoEditor
                            language={activeFile.endsWith('.tsx') || activeFile.endsWith('.ts') ? 'typescript' : activeFile.endsWith('.json') ? 'json' : 'javascript'}
                            theme="vs-dark"
                            value={fileContents[activeFile] || ''}
                            onChange={val => {
                              if (activeFile) {
                                setFileContents(prev => ({ ...prev, [activeFile]: val || '' }))
                              }
                            }}
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
                            {t('workspace_components.ide_local.select_file_hint', 'Selecione um arquivo na árvore ao lado')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Vertical Drag Handle (Editor vs Console) */}
                  {showConsole && (
                    <div 
                      className="h-1 cursor-row-resize hover:bg-indigo-500/50 transition-colors shrink-0 z-10"
                      onMouseDown={() => {
                        isResizingConsole.current = true
                        document.body.style.cursor = 'row-resize'
                        document.body.style.userSelect = 'none'
                      }}
                    />
                  )}

                  {/* Console Panel */}
                  <AnimatePresence>
                    {showConsole && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: consoleHeight, opacity: 1 }}
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

      {/* ──────────────── File Explorer: Context Menu ──────────────────────────────────────────────────────────── */}
      {ctxMenu && (
        <>
          <div className="fixed inset-0 z-[100000]" onClick={() => setCtxMenu(null)} />
          <div
            className="fixed z-[100001] bg-[#1e1e1e] border border-neutral-700 rounded-xl shadow-2xl py-1.5 w-52 text-sm"
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
          >
            {(() => {
              const selectedArray = Array.from(selectedPaths)
              const selectedNodes = getNodesFromPaths(selectedArray)
              
              const isTrashRoot = ctxMenu.node.name === '.trash' && ctxMenu.node.isDirectory
              const isInTrash = ctxMenu.node.path.includes('/.trash/')

              if (isTrashRoot) {
                return (
                  <button className="flex items-center gap-2.5 w-full px-3 py-1.5 hover:bg-red-900/40 text-red-400 transition-colors" onClick={() => { setDeleteConfirm({ mode: 'empty' }); setCtxMenu(null) }}>
                    <Trash2 className="w-3.5 h-3.5" /> {t('workspace_components.ide_local.empty_trash', 'Esvaziar Lixeira')}
                  </button>
                )
              }

              if (isInTrash) {
                return (
                  <>
                    <button className="flex items-center gap-2.5 w-full px-3 py-1.5 hover:bg-emerald-900/40 text-emerald-400 transition-colors" onClick={() => { handleRestoreFromTrash(selectedNodes); setCtxMenu(null) }}>
                      <Undo2 className="w-3.5 h-3.5" /> {t('workspace_components.ide_local.restore', 'Recuperar')} {selectedNodes.length > 1 ? `(${selectedNodes.length})` : ''}
                    </button>
                    <div className="border-t border-neutral-700 my-1" />
                    <button className="flex items-center gap-2.5 w-full px-3 py-1.5 hover:bg-red-900/40 text-red-400 transition-colors" onClick={() => { setDeleteConfirm({ mode: 'permanent', nodes: selectedNodes }); setCtxMenu(null) }}>
                      <Trash2 className="w-3.5 h-3.5" /> {t('workspace_components.ide_local.delete_permanent', 'Excluir Permanentemente')}
                    </button>
                  </>
                )
              }

              return (
                <>
                  {ctxMenu.node.isDirectory && selectedNodes.length <= 1 && (
                    <>
                      <button className="flex items-center gap-2.5 w-full px-3 py-1.5 hover:bg-neutral-700/60 text-neutral-200 transition-colors" onClick={() => { setFileActionModal({ type: 'new-file', node: ctxMenu.node }); setFileActionInput(''); setCtxMenu(null) }}>
                        <FilePlus className="w-3.5 h-3.5 text-blue-400" /> {t('workspace_components.ide_local.new_file', 'Novo Arquivo')}
                      </button>
                      <button className="flex items-center gap-2.5 w-full px-3 py-1.5 hover:bg-neutral-700/60 text-neutral-200 transition-colors" onClick={() => { setFileActionModal({ type: 'new-folder', node: ctxMenu.node }); setFileActionInput(''); setCtxMenu(null) }}>
                        <FolderPlus className="w-3.5 h-3.5 text-yellow-400" /> {t('workspace_components.ide_local.new_folder', 'Nova Pasta')}
                      </button>
                      {clipboard && (
                        <button className="flex items-center gap-2.5 w-full px-3 py-1.5 hover:bg-indigo-700/40 text-indigo-300 transition-colors" onClick={() => { handleCopyPasteNode(ctxMenu.node); setCtxMenu(null) }}>
                          <ClipboardPaste className="w-3.5 h-3.5" /> {t('workspace_components.ide_local.paste_here', 'Colar aqui')} {clipboard.nodes.length > 1 ? `(${clipboard.nodes.length})` : ''}
                        </button>
                      )}
                      <div className="border-t border-neutral-700 my-1" />
                    </>
                  )}
                  {selectedNodes.length <= 1 && (
                    <button className="flex items-center gap-2.5 w-full px-3 py-1.5 hover:bg-neutral-700/60 text-neutral-200 transition-colors" onClick={() => { setFileActionModal({ type: 'rename', node: ctxMenu.node }); setFileActionInput(ctxMenu.node.name); setCtxMenu(null) }}>
                      <Pencil className="w-3.5 h-3.5 text-emerald-400" /> {t('workspace_components.ide_local.rename', 'Renomear')}
                    </button>
                  )}
                  <button className="flex items-center gap-2.5 w-full px-3 py-1.5 hover:bg-neutral-700/60 text-neutral-200 transition-colors" onClick={() => { setClipboard({ nodes: selectedNodes, op: 'copy' }); setCtxMenu(null) }}>
                    <Copy className="w-3.5 h-3.5 text-sky-400" /> {t('workspace_components.ide_local.copy', 'Copiar')} {selectedNodes.length > 1 ? `(${selectedNodes.length})` : ''}
                  </button>
                  <button className="flex items-center gap-2.5 w-full px-3 py-1.5 hover:bg-neutral-700/60 text-neutral-200 transition-colors" onClick={() => { setClipboard({ nodes: selectedNodes, op: 'cut' }); setCtxMenu(null) }}>
                    <Scissors className="w-3.5 h-3.5 text-orange-400" /> {t('workspace_components.ide_local.cut', 'Recortar')} {selectedNodes.length > 1 ? `(${selectedNodes.length})` : ''}
                  </button>
                  <div className="border-t border-neutral-700 my-1" />
                  <button className="flex items-center gap-2.5 w-full px-3 py-1.5 hover:bg-neutral-700/60 text-neutral-200 transition-colors" onClick={async () => {
                    try {
                      const home = await homeDir()
                      const targetPath = ctxMenu.node.isDirectory ? ctxMenu.node.path : ctxMenu.node.path.substring(0, ctxMenu.node.path.lastIndexOf('/'))
                      const absolutePath = `${home.replace(/\\/g, '/')}/${targetPath}`
                      await invoke('open_in_explorer', { path: absolutePath })
                      setCtxMenu(null)
                    } catch (e: any) {
                      toast('Erro ao abrir no explorer: ' + (e?.message || String(e)), 'error')
                    }
                  }}>
                    <Folder className="w-3.5 h-3.5 text-blue-400" /> {t('workspace_components.ide_local.open_explorer', 'Abrir no Explorer')}
                  </button>
                  <button className="flex items-center gap-2.5 w-full px-3 py-1.5 hover:bg-red-900/40 text-red-400 transition-colors" onClick={() => { setDeleteConfirm({ mode: 'trash', nodes: selectedNodes }); setCtxMenu(null) }}>
                    <Trash2 className="w-3.5 h-3.5" /> {t('workspace_components.ide_local.delete', 'Deletar')} {selectedNodes.length > 1 ? `(${selectedNodes.length} itens)` : ctxMenu.node.isDirectory ? 'Pasta' : 'Arquivo'}
                  </button>
                </>
              )
            })()}
          </div>
        </>
      )}

      {/* ──────────────── Delete Confirm Modal ────────────────────────────────────────────────────────────────── */}
      {deleteConfirm && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 outline-none" 
          tabIndex={0} 
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (deleteConfirm.mode === 'trash' && deleteConfirm.nodes) handleDeleteNode(deleteConfirm.nodes)
              if (deleteConfirm.mode === 'permanent' && deleteConfirm.nodes) handlePermanentDelete(deleteConfirm.nodes)
              if (deleteConfirm.mode === 'empty') handleEmptyTrash()
              setDeleteConfirm(null)
            }
            if (e.key === 'Escape') {
              setDeleteConfirm(null)
            }
          }}
        >
          <div className="bg-[#1e1e1e] border border-neutral-800 rounded-xl shadow-2xl w-full max-w-sm p-6">
            <div className="w-12 h-12 rounded-full bg-red-900/20 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">
              {deleteConfirm.mode === 'empty' ? t('workspace_components.ide_local.empty_trash', 'Esvaziar Lixeira') : t('workspace_components.ide_local.confirm_delete_title', 'Confirmar Exclusão')}
            </h3>
            
            {deleteConfirm.mode === 'empty' ? (
              <p className="text-sm text-neutral-400 mb-4">Você está prestes a deletar todos os itens da lixeira permanentemente. Esta ação não pode ser desfeita.</p>
            ) : (
              <>
                <p className="text-sm text-neutral-400 mb-1">
                  Você está prestes a {deleteConfirm.mode === 'permanent' ? 'deletar permanentemente:' : 'deletar:'}
                </p>
                {deleteConfirm.nodes && deleteConfirm.nodes.length === 1 ? (
                  <p className="text-sm font-mono text-red-300 bg-red-900/10 rounded px-3 py-1.5 mb-3 break-all">{deleteConfirm.nodes[0].name}</p>
                ) : (
                  <p className="text-sm font-mono text-red-300 bg-red-900/10 rounded px-3 py-1.5 mb-3 break-all">{deleteConfirm.nodes?.length} itens selecionados</p>
                )}
                
                {deleteConfirm.mode === 'trash' && deleteConfirm.nodes?.some(n => n.isDirectory) && (
                  <p className="text-xs text-amber-400 bg-amber-900/20 rounded px-3 py-2 mb-4">⚠️ Todos os arquivos, subpastas e seu conteúdo serão movidos para a Lixeira.</p>
                )}
                
                {deleteConfirm.mode === 'permanent' && (
                  <p className="text-xs text-red-400 bg-red-900/20 rounded px-3 py-2 mb-4">⚠️ Os itens serão removidos permanentemente. Esta ação não pode ser desfeita.</p>
                )}
              </>
            )}

            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setDeleteConfirm(null)} disabled={fileActionLoading} className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors">{t('workspace_components.ide_local.cancel', 'Cancelar')}</button>
              <button 
                onClick={() => {
                  if (deleteConfirm.mode === 'trash' && deleteConfirm.nodes) handleDeleteNode(deleteConfirm.nodes)
                  if (deleteConfirm.mode === 'permanent' && deleteConfirm.nodes) handlePermanentDelete(deleteConfirm.nodes)
                  if (deleteConfirm.mode === 'empty') handleEmptyTrash()
                  setDeleteConfirm(null)
                }} 
                disabled={fileActionLoading} 
                className="flex items-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-bold transition-all disabled:opacity-50"
              >
                {fileActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} {deleteConfirm.mode === 'empty' ? 'Esvaziar' : 'Deletar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── Rename / New File / New Folder Modal ────────────────────────────────────────────────── */}
      {fileActionModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
          <div className="bg-[#1e1e1e] border border-neutral-800 rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-white mb-4">
              {fileActionModal.type === 'rename' && t('workspace_components.ide_local.rename', 'Renomear')}
              {fileActionModal.type === 'new-file' && t('workspace_components.ide_local.new_file', 'Novo Arquivo')}
              {fileActionModal.type === 'new-folder' && t('workspace_components.ide_local.new_folder', 'Nova Pasta')}
            </h3>
            <p className="text-xs text-neutral-500 mb-2">
              {fileActionModal.type === 'rename' && `Renomear "${fileActionModal.node?.name}"`}
              {fileActionModal.type === 'new-file' && `Criar dentro de "${fileActionModal.node?.name}"`}
              {fileActionModal.type === 'new-folder' && `Criar dentro de "${fileActionModal.node?.name}"`}
            </p>
            <input
              autoFocus
              type="text"
              value={fileActionInput}
              onChange={e => setFileActionInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (fileActionModal.type === 'rename' && fileActionModal.node) handleRenameNode(fileActionModal.node, fileActionInput)
                  if ((fileActionModal.type === 'new-file' || fileActionModal.type === 'new-folder') && fileActionModal.node) handleNewItem(fileActionModal.node, fileActionInput, fileActionModal.type === 'new-folder')
                }
                if (e.key === 'Escape') setFileActionModal(null)
              }}
              placeholder={fileActionModal.type === 'rename' ? 'Novo nome...' : fileActionModal.type === 'new-file' ? 'nome-do-arquivo.ts' : 'nome-da-pasta'}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 mb-4"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setFileActionModal(null)} className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors">{t('workspace_components.ide_local.cancel', 'Cancelar')}</button>
              <button
                onClick={() => {
                  if (fileActionModal.type === 'rename' && fileActionModal.node) handleRenameNode(fileActionModal.node, fileActionInput)
                  if ((fileActionModal.type === 'new-file' || fileActionModal.type === 'new-folder') && fileActionModal.node) handleNewItem(fileActionModal.node, fileActionInput, fileActionModal.type === 'new-folder')
                }}
                disabled={!fileActionInput.trim() || fileActionLoading}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold transition-all disabled:opacity-50"
              >
                {fileActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {fileActionModal.type === 'rename' ? t('workspace_components.ide_local.rename', 'Renomear') : 'Criar'}
              </button>
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
