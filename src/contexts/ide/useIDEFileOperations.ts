import * as tauriFs from '@tauri-apps/plugin-fs'
import { BaseDirectory } from '@tauri-apps/api/path'
import { useToast } from '@/components/ui/Toast'
import { FileNode, UndoAction } from './useIDEFileSystem'

export interface UseIDEFileOperationsProps {
  targetSlug?: string
  fileTree: FileNode[]
  loadFileTree: () => Promise<void>
  setOpenFiles: React.Dispatch<React.SetStateAction<string[]>>
  fileContents: Record<string, string>
  setFileContents: React.Dispatch<React.SetStateAction<Record<string, string>>>
  setOriginalFileContents: React.Dispatch<React.SetStateAction<Record<string, string>>>
  setActiveFile: React.Dispatch<React.SetStateAction<string | null>>
  selectedPaths: Set<string>
  setSelectedPaths: React.Dispatch<React.SetStateAction<Set<string>>>
  setExpandedFolders: React.Dispatch<React.SetStateAction<Set<string>>>
  clipboard: { nodes: FileNode[]; op: 'copy' | 'cut' } | null
  setClipboard: React.Dispatch<React.SetStateAction<{ nodes: FileNode[]; op: 'copy' | 'cut' } | null>>
  setUndoStack: React.Dispatch<React.SetStateAction<UndoAction[]>>
  setFileActionLoading: React.Dispatch<React.SetStateAction<boolean>>
  setFileActionModal: React.Dispatch<React.SetStateAction<any>>
  setDeleteConfirm: React.Dispatch<React.SetStateAction<any>>
  moveToTrash: (nodes: FileNode[]) => Promise<{ path: string; trashPath: string; isDirectory: boolean }[]>
}

export function useIDEFileOperations({
  targetSlug,
  fileTree,
  loadFileTree,
  setOpenFiles,
  fileContents,
  setFileContents,
  setOriginalFileContents,
  setActiveFile,
  selectedPaths,
  setSelectedPaths,
  setExpandedFolders,
  clipboard,
  setClipboard,
  setUndoStack,
  setFileActionLoading,
  setFileActionModal,
  setDeleteConfirm,
  moveToTrash
}: UseIDEFileOperationsProps) {
  const { toast } = useToast()

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
      setOriginalFileContents(prev => {
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

  return {
    handleDeleteNode,
    handleRenameNode,
    handleNewItem,
    handleCopyPasteNode,
    copyDirRecursive,
    expandAll,
    collapseAll
  }
}
