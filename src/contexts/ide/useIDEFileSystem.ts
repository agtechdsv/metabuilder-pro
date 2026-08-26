import { useState, useRef, useCallback } from 'react'
import * as tauriFs from '@tauri-apps/plugin-fs'
import { BaseDirectory } from '@tauri-apps/api/path'
import { useToast } from '@/components/ui/Toast'

export interface FileNode {
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

export interface UseIDEFileSystemProps {
  targetSlug?: string
}

export function useIDEFileSystem({ targetSlug }: UseIDEFileSystemProps) {
  const { toast } = useToast()

  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
  const [lastSelectedPath, setLastSelectedPath] = useState<string | null>(null)
  
  // File Action Modals and Menus
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; node: FileNode } | null>(null)
  const [fileActionModal, setFileActionModal] = useState<{ type: 'rename' | 'new-file' | 'new-folder' | 'copy' | 'move'; node?: FileNode; destPath?: string } | null>(null)
  const [fileActionInput, setFileActionInput] = useState('')
  const [fileActionLoading, setFileActionLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ mode: 'trash' | 'permanent' | 'empty', nodes?: FileNode[] } | null>(null)
  const [clipboard, setClipboard] = useState<{ nodes: FileNode[]; op: 'copy' | 'cut' } | null>(null)
  
  // Explorer UI States
  const [explorerWidth, setExplorerWidth] = useState(256)
  const [explorerActiveTab, setExplorerActiveTab] = useState<'explorer' | 'trash'>('explorer')
  const [undoStack, setUndoStack] = useState<UndoAction[]>([])

  const getTrashDir = useCallback(() => {
    return targetSlug ? `AGTech/MetaBuilderPRO/${targetSlug}/.trash` : ''
  }, [targetSlug])

  const loadFileTree = async () => {
    if (!targetSlug) return
    try {
      const basePath = `AGTech/MetaBuilderPRO/${targetSlug}`
      
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

  const toggleFolder = (path: string, modifier?: 'ctrl' | 'shift') => {
    setCtxMenu(null)
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

  const handleTrashNodes = async (nodes: FileNode[]) => {
    try {
      setFileActionLoading(true)
      const moved = await moveToTrash(nodes)
      setUndoStack(prev => [...prev, { type: 'delete', originalPaths: moved }])
      setSelectedPaths(new Set())
      await loadFileTree()
    } catch (e: any) {
      toast('Erro ao mover para a lixeira: ' + e.message, 'error')
    } finally {
      setFileActionLoading(false)
    }
  }

  const resetFileSystem = () => {
    setFileTree([])
    setExpandedFolders(new Set())
    setSelectedPaths(new Set())
    setLastSelectedPath(null)
    setUndoStack([])
    setCtxMenu(null)
    setFileActionModal(null)
  }

  return {
    fileTree,
    setFileTree,
    loadFileTree,
    expandedFolders,
    setExpandedFolders,
    selectedPaths,
    setSelectedPaths,
    lastSelectedPath,
    setLastSelectedPath,
    ctxMenu,
    setCtxMenu,
    fileActionModal,
    setFileActionModal,
    fileActionInput,
    setFileActionInput,
    fileActionLoading,
    setFileActionLoading,
    deleteConfirm,
    setDeleteConfirm,
    clipboard,
    setClipboard,
    explorerWidth,
    setExplorerWidth,
    explorerActiveTab,
    setExplorerActiveTab,
    undoStack,
    setUndoStack,
    getNodesFromPaths,
    getVisibleNodes,
    handleSelection,
    toggleFolder,
    moveToTrash,
    handleUndo,
    handleEmptyTrash,
    handlePermanentDelete,
    handleRestoreFromTrash,
    handleTrashNodes,
    resetFileSystem
  }
}
