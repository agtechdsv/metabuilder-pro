'use client'

import { useState, useEffect, useRef } from 'react'
import { isTauri } from '@/utils/tauriUtils'
import { LocalSyncManager } from '@/utils/localSyncManager'
import dynamic from 'next/dynamic'
import { 
  FolderGit2, Play, DownloadCloud, AlertTriangle, 
  CheckCircle2, XCircle, FileCode2, ChevronRight, ChevronDown, Folder, History, X
} from 'lucide-react'
import * as tauriFs from '@tauri-apps/plugin-fs'
import { BaseDirectory } from '@tauri-apps/api/path'
import { Command } from '@tauri-apps/plugin-shell'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/utils/supabase/client'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
}

export function ProjectSourceClient({ project, user }: any) {
  const [isDesktop, setIsDesktop] = useState(false)
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
  
  const supabase = createClient()
  const { toast } = useToast()

  useEffect(() => {
    setIsDesktop(isTauri())
    if (isTauri()) {
      const manager = new LocalSyncManager(project.id, project.slug)
      setSyncManager(manager)
      manager.initLocalProject().then(() => loadFileTree())
    }
    
    return () => {
      if (devProcess) {
        devProcess.kill()
      }
    }
  }, [project.id, project.slug])

  const loadFileTree = async () => {
    try {
      const basePath = `MetaBuilderPro/${project.slug}`
      
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
    if (!syncManager) return
    setIsSyncing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      await syncManager.syncFromWeb('/api/project-source', `Bearer ${token}`)
      
      const mergeResult = await syncManager.startSyncSandbox()
      setSandboxMode(true)
      await loadFileTree()
      
      if (mergeResult.oid) {
        toast('Merge limpo! Nenhum conflito encontrado.', 'success')
      } else {
        toast('Atenção: Conflitos encontrados. Resolva no editor antes de confirmar.', 'info')
      }
    } catch (err: any) {
      toast(`Erro ao sincronizar: ${err.message}`, 'error')
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
    try {
      const cmd = Command.create('npm', ['run', 'dev'], { cwd: `C:/Users/Alexandre/Documents/MetaBuilderPro/${project.slug}` })
      cmd.on('close', data => {
        console.log(`npm run dev closed with code ${data.code}`)
        setDevProcess(null)
      })
      cmd.on('error', error => console.error(`command error: "${error}"`))
      cmd.stdout.on('data', line => console.log(`npm: ${line}`))
      
      const child = await cmd.spawn()
      setDevProcess(child)
      toast('Servidor Iniciado na porta 3000', 'success')
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

  if (!isDesktop) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
        <div className="w-24 h-24 rounded-full bg-indigo-500/10 flex items-center justify-center">
          <FolderGit2 className="w-12 h-12 text-indigo-500" />
        </div>
        <h1 className="text-3xl font-black text-white">Exclusivo do App Desktop</h1>
        <p className="text-neutral-400 max-w-lg">
          O "Local Sync & Eject" permite que você baixe o código fonte real, edite-o usando a IDE embutida e faça merges seguros das atualizações do Visual Builder usando nosso motor de Git Invisível.
        </p>
        <p className="text-neutral-500 text-sm">
          Baixe o MetaBuilder PRO Desktop para acessar esta funcionalidade.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#1e1e1e]">
      {/* Toolbar */}
      <div className="h-14 border-b border-neutral-800 bg-[#181818] flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-white font-bold">
            <FolderGit2 className="w-5 h-5 text-indigo-500" />
            <span>{project.name} - IDE Local</span>
          </div>
          
          {sandboxMode && (
            <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 text-amber-500 rounded-full text-xs font-bold uppercase tracking-widest border border-amber-500/20">
              <AlertTriangle className="w-3.5 h-3.5" />
              Modo Sandbox (Homologação de Merge)
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {sandboxMode ? (
            <>
              <button 
                onClick={handleAbortSync}
                className="flex items-center gap-2 px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded text-sm font-semibold transition-colors"
              >
                <XCircle className="w-4 h-4 text-red-400" /> Descartar
              </button>
              <button 
                onClick={handleConfirmSync}
                className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-sm font-bold transition-colors shadow-lg shadow-emerald-500/20"
              >
                <CheckCircle2 className="w-4 h-4" /> Confirmar Merge
              </button>
            </>
          ) : (
            <button 
              onClick={handleSyncFromWeb}
              disabled={isSyncing}
              className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm font-bold transition-colors shadow-lg shadow-indigo-500/20 disabled:opacity-50"
            >
              <DownloadCloud className="w-4 h-4" /> 
              {isSyncing ? 'Sincronizando...' : 'Atualizar da Web'}
            </button>
          )}

          <div className="w-px h-6 bg-neutral-800 mx-2" />

          <button 
            onClick={handleShowLogs}
            className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded text-sm font-semibold transition-colors"
            title="Ver Histórico (Git Log)"
          >
            <History className="w-4 h-4" /> Histórico
          </button>

          <button 
            onClick={handleRunDev}
            disabled={!!devProcess}
            className="flex items-center gap-2 px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded text-sm font-semibold transition-colors disabled:opacity-50"
          >
            <Play className="w-4 h-4 text-green-400" /> 
            {devProcess ? 'Rodando (porta 3000)' : 'Rodar Preview Local'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Sidebar Tree */}
        <div className="w-64 border-r border-neutral-800 bg-[#181818] overflow-y-auto py-2">
          {renderTree(fileTree)}
        </div>

        {/* Editor */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="h-10 bg-[#1e1e1e] border-b border-neutral-800 flex items-center px-4 text-sm text-neutral-400">
            {selectedFile ? selectedFile.replace(`MetaBuilderPro/${project.slug}/`, '') : 'Nenhum arquivo selecionado'}
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

        {/* Local Preview Iframe */}
        {devProcess && (
          <div className="w-[45%] border-l border-neutral-800 bg-white">
            <iframe 
              src="http://localhost:3000" 
              className="w-full h-full border-none"
              title="Local Preview"
            />
          </div>
        )}
      </div>

      {/* Git Log Modal */}
      {isLogModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
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
    </div>
  )
}
