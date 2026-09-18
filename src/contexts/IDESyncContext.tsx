'use client'

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { isTauri } from '@/utils/tauriUtils'
import { LocalSyncManager } from '@/utils/localSyncManager'
import { GitConfigManager } from '@/utils/gitConfigManager'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/i18n'
import { useIDEConsole } from './ide/useIDEConsole'
import { useIDETabs } from './ide/useIDETabs'
import { useIDEFileSystem, FileNode, UndoAction } from './ide/useIDEFileSystem'
import { useIDEFileOperations } from './ide/useIDEFileOperations'
import { useIDEGit } from './ide/useIDEGit'
import { useIDEServer } from './ide/useIDEServer'
import { handleMonacoBeforeMount, updateJavaClasses, updateJavaClassSource } from '@/components/ide/ideUtils'
import { registerEntityPath, updateEntityCache, parseEntitySource } from '@/components/ide/entityParser'
import * as tauriFs from '@tauri-apps/plugin-fs'
import { BaseDirectory } from '@tauri-apps/api/path'
import { IDEModal } from '@/components/ide/IDEModal'

export interface IDETarget {
  type: 'project' | 'workspace'
  id: string
  name: string
  slug: string
}

export type { FileNode, UndoAction }

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
  const { toast } = useToast()

  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [target, setTarget] = useState<IDETarget | null>(null)
  const [syncManager, setSyncManager] = useState<LocalSyncManager | null>(null)

  // Injected specialized hooks
  const consoleState = useIDEConsole()
  const fsState = useIDEFileSystem({ targetSlug: target?.slug })
  const monacoRef = useRef<any>(null)
  const tabsState = useIDETabs({ targetSlug: target?.slug, monacoRef })

  const gitState = useIDEGit({
    target,
    syncManager,
    loadFileTree: fsState.loadFileTree,
    resetTabs: tabsState.resetTabs,
    fileContents: tabsState.fileContents,
    setDiffActiveFile: tabsState.setDiffActiveFile,
    setDiffOriginalContent: tabsState.setDiffOriginalContent,
    setDiffLocalContent: tabsState.setDiffLocalContent
  })

  const fileOps = useIDEFileOperations({
    targetSlug: target?.slug,
    fileTree: fsState.fileTree,
    loadFileTree: fsState.loadFileTree,
    setOpenFiles: tabsState.setOpenFiles,
    fileContents: tabsState.fileContents,
    setFileContents: tabsState.setFileContents,
    setOriginalFileContents: tabsState.setOriginalFileContents,
    setActiveFile: tabsState.setActiveFile,
    selectedPaths: fsState.selectedPaths,
    setSelectedPaths: fsState.setSelectedPaths,
    setExpandedFolders: fsState.setExpandedFolders,
    clipboard: fsState.clipboard,
    setClipboard: fsState.setClipboard,
    setUndoStack: fsState.setUndoStack,
    setFileActionLoading: fsState.setFileActionLoading,
    setFileActionModal: fsState.setFileActionModal,
    setDeleteConfirm: fsState.setDeleteConfirm,
    moveToTrash: fsState.moveToTrash
  })

  const isJavaSpringProject = fsState.fileTree.some(f => 
    f.name === 'pom.xml' || 
    (f.name === 'backend' && f.children?.some(c => c.name === 'pom.xml' || c.name === 'mvnw'))
  )

  const serverState = useIDEServer({
    target,
    addConsoleLog: consoleState.addConsoleLog,
    setShowConsole: consoleState.setShowConsole,
    isSyncing: gitState.isSyncing,
    isJavaSpringProject
  })

  // IDE UI State
  const [mounted, setMounted] = useState(false)
  const [consoleHeight, setConsoleHeight] = useState(200)
  const [showNativeExport, setShowNativeExport] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true)
  const [ideLoadingState] = useState<{ isLoading: boolean; message: string }>({ isLoading: false, message: '' })

  const isResizingExplorer = useRef(false)
  const isResizingConsole = useRef(false)
  const tabsContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Extração inteligente de classes Java para auto-import e autocomplete no Monaco Editor
  useEffect(() => {
    const javaClassItems: { name: string; packageName?: string; fullPath?: string }[] = []
    
    const extractJavaClasses = (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (node.name === '.trash') continue
        if (!node.isDirectory && node.name.endsWith('.java')) {
          const className = node.name.replace('.java', '')
          
          let pkg = ''
          const normalizedPath = node.path.replace(/\\/g, '/')
          const javaIdx = normalizedPath.lastIndexOf('/java/')
          if (javaIdx !== -1) {
            const rel = normalizedPath.substring(javaIdx + 6)
            const parts = rel.split('/')
            parts.pop() // remove o nome do arquivo .java
            pkg = parts.join('.')
          } else {
            const parts = normalizedPath.split('/')
            parts.pop()
            const parentFolder = parts[parts.length - 1]
            if (parentFolder && parentFolder !== 'src') {
              pkg = parentFolder
            }
          }
          
          javaClassItems.push({ name: className, packageName: pkg, fullPath: node.path })

          // Registra entidades
          if (normalizedPath.includes('/entities/') || pkg.endsWith('entities')) {
            registerEntityPath(className, node.path)
          }
        } else if (node.isDirectory && node.children) {
          extractJavaClasses(node.children)
        }
      }
    }
    
    if (fsState.fileTree && fsState.fileTree.length > 0) {
      extractJavaClasses(fsState.fileTree)
      // Remove duplicatas pelo nome da classe
      const uniqueItems = Array.from(
        new Map(javaClassItems.map(item => [item.name, item])).values()
      )
      updateJavaClasses(uniqueItems)

      // Carga em background das classes e entidades Java para preencher o cache do Monaco
      if (isTauri() && uniqueItems.length > 0) {
        setTimeout(async () => {
          for (const item of uniqueItems) {
            if (!item.fullPath) continue
            try {
              const src = await tauriFs.readTextFile(item.fullPath, { baseDir: BaseDirectory.Home })
              if (src) {
                updateJavaClassSource(item.name, src)
                const norm = item.fullPath.replace(/\\/g, '/')
                if (norm.includes('/entities/') || (item.packageName && item.packageName.endsWith('entities'))) {
                  updateEntityCache(item.name, parseEntitySource(src, item.name, item.fullPath))
                }
              }
            } catch {
              // Silencioso se der erro na leitura em background
            }
          }
        }, 100)
      }
    }
  }, [fsState.fileTree])

  // Global keyboard shortcuts (ESC, Enter, Ctrl+Z, Delete)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        fsState.setCtxMenu(null)
        fsState.setDeleteConfirm(null)
        fsState.setFileActionModal(null)
        gitState.setShowDiscardConfirm(false)
        tabsState.setUnsavedFilesPrompt(null)
        tabsState.setTabContextMenu(null)
      } else if (e.key === 'Enter') {
        if (fsState.deleteConfirm) {
          e.preventDefault()
          if (fsState.deleteConfirm.mode === 'trash' && fsState.deleteConfirm.nodes) {
            fileOps.handleDeleteNode(fsState.deleteConfirm.nodes)
          }
          if (fsState.deleteConfirm.mode === 'permanent' && fsState.deleteConfirm.nodes) {
            fsState.handlePermanentDelete(fsState.deleteConfirm.nodes)
          }
          if (fsState.deleteConfirm.mode === 'empty') {
            fsState.handleEmptyTrash()
          }
          fsState.setDeleteConfirm(null)
        } else if (gitState.showDiscardConfirm) {
          e.preventDefault()
          gitState.handleAbortSync()
          gitState.setShowDiscardConfirm(false)
        }
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        if (fsState.undoStack.length > 0 && !fsState.fileActionLoading) {
          e.preventDefault()
          fsState.handleUndo()
        }
      } else if (e.key === 'Delete') {
        if (
          !fsState.fileActionModal &&
          !fsState.deleteConfirm &&
          !gitState.showDiscardConfirm &&
          fsState.selectedPaths.size > 0 &&
          !fsState.fileActionLoading
        ) {
          const nodes = fsState.getNodesFromPaths(Array.from(fsState.selectedPaths))
          fsState.setDeleteConfirm({
            mode: fsState.explorerActiveTab === 'trash' ? 'permanent' : 'trash',
            nodes
          })
        }
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingExplorer.current) {
        let newWidth = e.clientX - 64
        if (newWidth < 150) newWidth = 150
        if (newWidth > 600) newWidth = 600
        fsState.setExplorerWidth(newWidth)
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
  }, [
    fsState.undoStack,
    fsState.fileActionLoading,
    fsState.selectedPaths,
    fsState.deleteConfirm,
    fsState.fileActionModal,
    fsState.explorerActiveTab,
    gitState.showDiscardConfirm
  ])

  // Local Sync initialization
  useEffect(() => {
    if (isOpen && target && isTauri()) {
      const manager = new LocalSyncManager(target.id, target.slug)
      setSyncManager(manager)
      manager.initLocalProject().then(async () => {
        const { branches, currentBranch } = await manager.getBranches()
        gitState.setBranches(branches)
        gitState.setSelectedBranch(currentBranch)
        const configManager = new GitConfigManager(target.slug)
        const config = await configManager.getConfig()
        const sandboxBranch = config.branchSandbox || 'sync-sandbox'

        gitState.setSandboxMode(currentBranch === sandboxBranch)
        await fsState.loadFileTree()
      })
    }
  }, [isOpen, target])

  // Cleanup npm dev server process when IDE modal is fully closed
  useEffect(() => {
    if (!isOpen && serverState.devProcess) {
      serverState.devProcess.kill()
      serverState.setDevProcess(null)
    }
  }, [isOpen, serverState.devProcess])

  // Limpa o console quando a IDE fecha ou na descarga/fechamento da janela
  useEffect(() => {
    if (!isOpen) {
      consoleState.clearConsole()
    }
  }, [isOpen])

  useEffect(() => {
    const handleBeforeUnload = () => {
      consoleState.clearConsole()
      if (serverState.devProcess) {
        serverState.devProcess.kill()
        serverState.setDevProcess(null)
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [serverState.devProcess])

  const openIDE = (newTarget: IDETarget) => {
    if (!isTauri()) {
      toast('A IDE Local está disponível apenas no Desktop App', 'error')
      return
    }
    consoleState.clearConsole()
    setTarget(newTarget)
    setIsOpen(true)
    setIsMinimized(false)
  }

  const closeIDE = () => {
    setIsOpen(false)
    setIsMinimized(false)
    setTarget(null)
    fsState.resetFileSystem()
    tabsState.resetTabs()
    gitState.resetGit()
    consoleState.clearConsole()
  }

  const handleResetProjectToCleanState = async () => {
    if (!syncManager || !target) return
    try {
      if (serverState.devProcess) {
        try {
          await serverState.devProcess.kill()
        } catch (e) {}
        serverState.setDevProcess(null)
      }
      if (serverState.springProcess) {
        try {
          await serverState.springProcess.kill()
        } catch (e) {}
        serverState.setSpringProcess(null)
      }

      // Parada direta via invoke para garantir que nenhuma porta (3000/8080) fique presa
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('stopcli')
        await invoke('stop_spring_boot')
      } catch (_) {}

      tabsState.resetTabs()
      consoleState.clearConsole()
      gitState.setSandboxMode(false)

      await syncManager.resetProjectToCleanState()

      const { branches, currentBranch } = await syncManager.getBranches()
      gitState.setBranches(branches)
      gitState.setSelectedBranch(currentBranch)
      await fsState.loadFileTree()

      toast(t('ide_git_settings.reset_success', 'Projeto local reiniciado do zero com sucesso!'), 'success')
      gitState.setShowGitSettings(false)
    } catch (err: any) {
      toast(`${t('ide_git_settings.reset_error', 'Erro ao reiniciar projeto:')} ${err.message}`, 'error')
    }
  }

  return (
    <IDESyncContext.Provider value={{ openIDE }}>
      {children}
      {mounted &&
        createPortal(
          <IDEModal
            isOpen={isOpen}
            isMinimized={isMinimized}
            setIsMinimized={setIsMinimized}
            closeIDE={closeIDE}
            target={target}
            syncManager={syncManager}
            showSidebar={showSidebar}
            setShowSidebar={setShowSidebar}
            showNativeExport={showNativeExport}
            setShowNativeExport={setShowNativeExport}
            consoleHeight={consoleHeight}
            ideLoadingState={ideLoadingState}
            isResizingExplorer={isResizingExplorer}
            isResizingConsole={isResizingConsole}
            tabsContainerRef={tabsContainerRef}
            monacoRef={monacoRef}
            handleMonacoBeforeMount={handleMonacoBeforeMount}
            handleResetProjectToCleanState={handleResetProjectToCleanState}
            fs={fsState}
            fileOps={fileOps}
            tabs={tabsState}
            git={gitState}
            server={serverState}
            consoleState={consoleState}
          />,
          document.body
        )}
    </IDESyncContext.Provider>
  )
}
