'use client'

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  FolderGit2, Play, DownloadCloud, AlertTriangle, 
  CheckCircle2, XCircle, FileCode2, ChevronRight, ChevronDown, Folder, History, X, Minimize2, AppWindow, LayoutDashboard
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { isTauri } from '@/utils/tauriUtils'
import { LocalSyncManager } from '@/utils/localSyncManager'
import * as tauriFs from '@tauri-apps/plugin-fs'
import { BaseDirectory } from '@tauri-apps/api/path'
import { Command } from '@tauri-apps/plugin-shell'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/utils/supabase/client'
import { usePreview } from './PreviewContext'

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
  const [sandboxMode, setSandboxMode] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [devProcess, setDevProcess] = useState<any>(null)
  const [gitLogs, setGitLogs] = useState<any[]>([])
  const [isLogModalOpen, setIsLogModalOpen] = useState(false)
  
  const [mounted, setMounted] = useState(false)
  const { toast } = useToast()
  const { openPreview } = usePreview()
  const supabase = createClient()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen && target && isTauri()) {
      const manager = new LocalSyncManager(target.id, target.slug)
      setSyncManager(manager)
      manager.initLocalProject().then(() => loadFileTree())
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
      const basePath = `MetaBuilderPro/${target.slug}`
      
      const buildTree = async (dirPath: string): Promise<FileNode[]> => {
        const entries = await tauriFs.readDir(dirPath, { baseDir: BaseDirectory.Document })
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
      const content = await tauriFs.readTextFile(path, { baseDir: BaseDirectory.Document })
      setFileContent(content)
    } catch (err) {
      toast('Erro ao ler arquivo', 'error')
    }
  }

  const handleSaveFile = async (value: string | undefined) => {
    if (!selectedFile || value === undefined) return
    try {
      await tauriFs.writeTextFile(selectedFile, value, { baseDir: BaseDirectory.Document })
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
      const payload = target.type === 'project' ? { projectId: target.id } : { workspaceId: target.id }

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
    try {
      await syncManager.confirmSync()
      setSandboxMode(false)
      toast('Sincronização Efetivada', 'success')
    } catch (err: any) {
      toast(`Erro: ${err.message}`, 'error')
    }
  }

  const handleAbortSync = async () => {
    if (!syncManager) return
    try {
      await syncManager.abortSync()
      setSandboxMode(false)
      await loadFileTree()
      setFileContent('')
      setSelectedFile(null)
      toast('Sincronização Descartada', 'info')
    } catch (err: any) {
      toast(`Erro: ${err.message}`, 'error')
    }
  }

  const handleRunDev = async () => {
    if (!target) return
    try {
      const cmd = Command.create('npm', ['run', 'dev'], { cwd: `C:/Users/Alexandre/Documents/MetaBuilderPro/${target.slug}` })
      cmd.on('close', data => {
        console.log(`npm run dev closed with code ${data.code}`)
        setDevProcess(null)
      })
      cmd.on('error', error => console.error(`command error: "${error}"`))
      cmd.stdout.on('data', line => console.log(`npm: ${line}`))
      
      const child = await cmd.spawn()
      setDevProcess(child)
      toast('Servidor Iniciado na porta 3000', 'success')
      
      // Abre o Navegador Interno
      openPreview('http://localhost:3000', `Preview: ${target.name}`)
    } catch (err: any) {
      toast(`Erro ao rodar projeto: ${err.message}`, 'error')
    }
  }

  const handleShowLogs = async () => {
    if (!syncManager) return
    try {
      const logs = await syncManager.getLog()
      setGitLogs(logs)
      setIsLogModalOpen(true)
    } catch (err: any) {
      toast(`Erro ao carregar histórico: ${err.message}`, 'error')
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
                            onClick={handleAbortSync}
                            className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-semibold transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5 text-red-400" /> Descartar
                          </button>
                          <button 
                            onClick={handleConfirmSync}
                            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors shadow-lg shadow-emerald-500/20"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Confirmar Merge
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
                      
                      <button 
                        onClick={handleShowLogs}
                        className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg text-xs font-semibold transition-colors"
                        title="Ver Histórico (Git Log)"
                      >
                        <History className="w-3.5 h-3.5" /> Histórico
                      </button>

                      <button 
                        onClick={handleRunDev}
                        disabled={!!devProcess}
                        className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        <Play className="w-3.5 h-3.5 text-green-400" /> 
                        {devProcess ? 'Servidor Ativo' : 'Rodar Preview Local'}
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

                {/* Main Content IDE */}
                <div className="flex-1 flex min-h-0 bg-[#1e1e1e]">
                  {/* Sidebar Tree */}
                  <div className="w-64 border-r border-neutral-800 bg-[#181818] overflow-y-auto py-2">
                    {renderTree(fileTree)}
                  </div>

                  {/* Editor */}
                  <div className="flex-1 flex flex-col min-w-0">
                    <div className="h-10 bg-[#1e1e1e] border-b border-neutral-800 flex items-center px-4 text-sm text-neutral-400">
                      {selectedFile ? selectedFile.replace(`MetaBuilderPro/${target.slug}/`, '') : 'Nenhum arquivo selecionado'}
                    </div>
                    <div className="flex-1">
                      {selectedFile ? (
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

      {/* Git Log Modal (outside framer-motion root to prevent stacking issues) */}
      {isLogModalOpen && isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
          <div className="bg-[#1e1e1e] border border-neutral-800 rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between p-4 border-b border-neutral-800 shrink-0">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-400" /> Histórico de Sincronizações (Git Log)
              </h2>
              <button 
                onClick={() => setIsLogModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {gitLogs.length === 0 ? (
                <div className="text-center text-neutral-500 py-8">Nenhum commit encontrado.</div>
              ) : (
                gitLogs.map(log => (
                  <div key={log.oid} className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold text-white text-sm">{log.message}</div>
                      <div className="text-xs text-neutral-500 font-mono bg-neutral-950 px-2 py-1 rounded">
                        {log.oid.substring(0, 7)}
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
    </IDESyncContext.Provider>
  )
}
