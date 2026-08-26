import { useState, useRef, useEffect } from 'react'
import * as tauriFs from '@tauri-apps/plugin-fs'
import { BaseDirectory } from '@tauri-apps/api/path'
import { useToast } from '@/components/ui/Toast'

export interface UseIDETabsProps {
  targetSlug?: string
  monacoRef: React.MutableRefObject<any>
}

export function useIDETabs({ targetSlug, monacoRef }: UseIDETabsProps) {
  const { toast } = useToast()
  
  const [openFiles, setOpenFiles] = useState<string[]>([])
  const [fileContents, setFileContents] = useState<Record<string, string>>({})
  const [originalFileContents, setOriginalFileContents] = useState<Record<string, string>>({})
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const activeFileRef = useRef<string | null>(null)
  
  // States related to closing and context menus
  const [unsavedFilesPrompt, setUnsavedFilesPrompt] = useState<{ pathsToClose: string[]; dirtyPaths: string[]; } | null>(null)
  const [tabContextMenu, setTabContextMenu] = useState<{ x: number, y: number, path: string } | null>(null)
  
  // Diff editor states (related to open files)
  const [diffActiveFile, setDiffActiveFile] = useState<string | null>(null)
  const [diffOriginalContent, setDiffOriginalContent] = useState<string>('')
  const [diffLocalContent, setDiffLocalContent] = useState<string>('')
  
  useEffect(() => {
    activeFileRef.current = activeFile
  }, [activeFile])

  const isDirty = (path: string) => fileContents[path] !== originalFileContents[path]

  const executeCloseFiles = (pathsToClose: string[]) => {
    if (monacoRef.current) {
      const monaco = monacoRef.current
      pathsToClose.forEach(p => {
        const models = monaco.editor.getModels()
        for (const m of models) {
          if (m.uri.toString().toLowerCase().includes(p.toLowerCase())) {
            m.dispose()
          }
        }
      })
    }
    setFileContents(prev => {
      const next = { ...prev }
      pathsToClose.forEach(p => delete next[p])
      return next
    })
    setOriginalFileContents(prev => {
      const next = { ...prev }
      pathsToClose.forEach(p => delete next[p])
      return next
    })
    setOpenFiles(prev => {
      const newFiles = prev.filter(p => !pathsToClose.includes(p))
      setActiveFile(curr => {
        if (curr && pathsToClose.includes(curr)) {
          const remaining = prev.filter(p => !pathsToClose.includes(p))
          return remaining.length > 0 ? remaining[Math.min(prev.indexOf(curr), remaining.length - 1)] : null
        }
        return curr
      })
      return newFiles
    })
  }

  const requestCloseFiles = (pathsToClose: string[]) => {
    const dirtyPaths = pathsToClose.filter(p => isDirty(p))
    if (dirtyPaths.length > 0) {
      setUnsavedFilesPrompt({ pathsToClose, dirtyPaths })
    } else {
      executeCloseFiles(pathsToClose)
    }
  }

  const handleCloseFile = (e: React.MouseEvent, path: string) => {
    e.stopPropagation()
    requestCloseFiles([path])
  }

  const handleSelectFile = async (path: string, modifier?: 'ctrl' | 'shift', onSelect?: (path: string, mod?: string) => void) => {
    // onSelect pode ser passado se a arvore de arquivos precisar atualizar seleções
    if (onSelect) onSelect(path, modifier)
    if (modifier === 'shift' || modifier === 'ctrl') return
    
    if (fileContents[path] === undefined) {
      try {
        const content = await tauriFs.readTextFile(path, { baseDir: BaseDirectory.Home })
        setFileContents(prev => ({ ...prev, [path]: content }))
        setOriginalFileContents(prev => ({ ...prev, [path]: content }))
        setOpenFiles(prev => {
          const exists = prev.includes(path)
          const newList = exists ? prev : [...prev, path]
          setTimeout(() => {
            if (!targetSlug) return
            const el = document.querySelector(`[title="${path.replace(`AGTech/MetaBuilderPRO/${targetSlug}/`, '')}"]`)
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          }, 0)
          return newList
        })
        setActiveFile(path)
      } catch (err) {
        toast('Erro ao ler arquivo', 'error')
      }
    } else {
      setOpenFiles(prev => prev.includes(path) ? prev : [...prev, path])
      setActiveFile(path)
      setTimeout(() => {
        if (!targetSlug) return
        const el = document.querySelector(`[title="${path.replace(`AGTech/MetaBuilderPRO/${targetSlug}/`, '')}"]`)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 0)
    }
  }

  const handleSaveFile = async (value: string | undefined, specificPath?: string) => {
    const targetPath = specificPath || activeFileRef.current
    if (!targetPath || value === undefined) return
    try {
      await tauriFs.writeTextFile(targetPath, value, { baseDir: BaseDirectory.Home })
      setFileContents(prev => ({ ...prev, [targetPath]: value }))
      setOriginalFileContents(prev => ({ ...prev, [targetPath]: value }))
      
      setDiffActiveFile(curr => {
        if (curr === targetPath) {
          setDiffLocalContent(value)
        }
        return curr
      })
      toast('Salvo com sucesso', 'success')
    } catch (err) {
      toast('Erro ao salvar arquivo', 'error')
    }
  }

  const handleSaveAll = async () => {
    let savedCount = 0
    for (const path of openFiles) {
      if (isDirty(path)) {
        try {
          const value = fileContents[path]
          await tauriFs.writeTextFile(path, value, { baseDir: BaseDirectory.Home })
          setOriginalFileContents(prev => ({ ...prev, [path]: value }))
          savedCount++
        } catch (err) {
          toast(`Erro ao salvar ${path}`, 'error')
        }
      }
    }
    if (savedCount > 0) {
      toast(`${savedCount} arquivo(s) salvo(s) com sucesso!`, 'success')
    }
  }

  const resetTabs = () => {
    setOpenFiles([])
    setFileContents({})
    setOriginalFileContents({})
    setActiveFile(null)
    setDiffActiveFile(null)
  }

  return {
    openFiles,
    fileContents,
    setFileContents,
    originalFileContents,
    setOriginalFileContents,
    activeFile,
    setActiveFile,
    activeFileRef,
    isDirty,
    requestCloseFiles,
    executeCloseFiles,
    handleCloseFile,
    handleSelectFile,
    handleSaveFile,
    handleSaveAll,
    resetTabs,
    unsavedFilesPrompt,
    setUnsavedFilesPrompt,
    tabContextMenu,
    setTabContextMenu,
    diffActiveFile,
    setDiffActiveFile,
    diffLocalContent,
    setDiffLocalContent,
    setOpenFiles,
    diffOriginalContent,
    setDiffOriginalContent
  }
}
