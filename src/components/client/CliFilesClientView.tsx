'use client'

import { useState, useEffect, useRef } from 'react'
import { IdeUpdaterButton } from '@/components/runtime/IdeUpdaterButton'
import { createClient } from '@/utils/supabase/client'
import { Download, File as FileIcon, Loader2, RefreshCw, Filter, X, History, FolderOpen, Play, CheckCircle, ExternalLink } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { isTauri } from '@/utils/tauriUtils'

interface Project {
  id: string
  name: string
  secret_token?: string
}

interface CliFilesClientViewProps {
  projects?: Project[]
  devOnly?: boolean // When true (dev user), only the IDE sub-tab is shown
  isPopout?: boolean
}

export function CliFilesClientView({ projects = [], devOnly = false, isPopout = false }: CliFilesClientViewProps) {
  const [files, setFiles] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Tab & Filter state â€” devOnly users are locked to the IDE tab
  const [mainTab, setMainTab] = useState<'ide' | 'utils'>('ide')
  const [filter, setFilter] = useState<'all' | 'cli-win' | 'cli-linux' | 'template' | 'manual' | 'ide-win' | 'ide-mac' | 'ide-linux'>('all')
  const [showOlderReleases, setShowOlderReleases] = useState(false)
  const [localVersion, setLocalVersion] = useState<string>('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [releaseNotesList, setReleaseNotesList] = useState<any[]>([])

  // Modal state
  const [downloadModalFile, setDownloadModalFile] = useState<any | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')

  // DB config state
  const [dbType, setDbType] = useState('postgres')
  const [dbHost, setDbHost] = useState('localhost')
  const [dbPort, setDbPort] = useState('5432')
  const [dbName, setDbName] = useState('')
  const [dbUser, setDbUser] = useState('')
  const [dbPass, setDbPass] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)

  // IDE Download modal state
  const [ideDownloadModal, setIdeDownloadModal] = useState<{
    open: boolean
    phase: 'downloading' | 'done' | 'error'
    fileName: string
    progress: number // 0-100
    savedPath: string
    savedDir: string
    canRun: boolean
  } | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const supabase = createClient()
  const { toast } = useToast()

  const fetchFiles = async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from('app_downloads')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      toast('Erro ao carregar arquivos disponíveis: ' + error.message, 'error')
    } else {
      setFiles(data || [])
    }
    setIsLoading(false)
  }

  useEffect(() => {
    fetchFiles()
    
    // Fetch release notes and local version for Auto Updater
    fetch('/api/releases')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setReleaseNotesList(data)
      })

    const checkVersion = async () => {
      const { isTauri } = await import('@tauri-apps/api/core')
      if (!isTauri()) {
        setLocalVersion('Web App Edition')
        return
      }
      try {
        const { getVersion } = await import('@tauri-apps/api/app')
        const v = await getVersion()
        setLocalVersion(`IDE Engine v${v}`)
      } catch (e: any) {
        setLocalVersion(`Erro: ${e.message || String(e)}`)
      }
    }
    checkVersion()
  }, [])

  const handleDownloadClick = async (file: any) => {
    if (file.category === 'template') {
      setDownloadModalFile(file)
      return
    }

    // Generate signed URL
    const { data, error } = await supabase.storage.from('releases').createSignedUrl(file.bucket_path, 60 * 60)
    if (error || !data) {
      toast('Erro ao gerar link de download.', 'error')
      return
    }
    const signedUrl = data.signedUrl
    const realFileName = file.bucket_path?.split('/').pop() || file.file_path?.split('/').pop() || 'download.msi'
    const labelName = (file.name || 'download').replace(/[^a-zA-Z0-9._\- ()]/g, '_')

    // â”€â”€ Tauri IDE path: download with progress â”€â”€
    if (isTauri()) {
      setIdeDownloadModal({
        open: true,
        phase: 'downloading',
        fileName: labelName,
        progress: 0,
        savedPath: '',
        savedDir: '',
        canRun: false,
      })

      try {
        const abort = new AbortController()
        abortRef.current = abort

        const response = await fetch(signedUrl, { signal: abort.signal })
        if (!response.ok) throw new Error('Falha ao iniciar download')

        const contentLength = Number(response.headers.get('content-length') || 0)
        const reader = response.body!.getReader()
        const chunks: Uint8Array[] = []
        let received = 0

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(value)
          received += value.length
          const pct = contentLength > 0 ? Math.min(Math.round((received / contentLength) * 100), 99) : 0
          setIdeDownloadModal(prev => prev ? { ...prev, progress: pct } : prev)
        }

        // Merge chunks and save via Tauri fs plugin
        const total = chunks.reduce((a, c) => a + c.length, 0)
        const merged = new Uint8Array(total)
        let offset = 0
        for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length }

        const { downloadDir } = await import('@tauri-apps/api/path')
        const { writeFile, BaseDirectory } = await import('@tauri-apps/plugin-fs')

        const dir = await downloadDir()
        // Garante separador de pasta correto no Windows (pode vir com ou sem barra)
        const separator = dir.endsWith('/') || dir.endsWith('\\') ? '' : '/'
        const fullPath = `${dir}${separator}${realFileName}`

        console.log(`[Download] Saving to: ${fullPath}`)
        console.log(`[Download] File size: ${merged.length} bytes`)

        await writeFile(realFileName, merged, { baseDir: BaseDirectory.Download })

        // Arquivo .msi no Windows sempre pode ser executado
        const canRun = file.bucket_path?.toLowerCase().endsWith('.msi') || 
                       realFileName?.toLowerCase().endsWith('.msi')

        setIdeDownloadModal({
          open: true,
          phase: 'done',
          fileName: labelName,
          progress: 100,
          savedPath: fullPath,
          savedDir: dir,
          canRun,
        })
      } catch (err: any) {
        if (err?.name === 'AbortError') return
        console.error('[Download] Error details:', err)
        console.error('[Download] Error message:', err?.message)
        console.error('[Download] Error type:', err?.constructor?.name)
        setIdeDownloadModal(prev => prev ? { ...prev, phase: 'error' } : prev)
      }
      return
    }

    // â”€â”€ Browser fallback â”€â”€
    const a = document.createElement('a')
    a.href = signedUrl
    a.download = realFileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleOpenFolder = async (dir: string, fileFullPath: string) => {
    try {
      if (fileFullPath) {
        const { revealItemInDir } = await import('@tauri-apps/plugin-opener')
        await revealItemInDir(fileFullPath)
      } else {
        const { openPath } = await import('@tauri-apps/plugin-opener')
        await openPath(dir)
      }
    } catch (e) {
      console.error('Não foi possível abrir o explorador:', e)
      // fallback: tenta abrir apenas a pasta
      try {
        const { openPath } = await import('@tauri-apps/plugin-opener')
        await openPath(dir)
      } catch {}
    }
  }

  const handleRunInstaller = async (path: string) => {
    try {
      const { openPath } = await import('@tauri-apps/plugin-opener')
      await openPath(path)

      // Auto-close the app after launching the installer so it can replace the files
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      const current = getCurrentWindow()
      await current.close()
    } catch (e) {
      console.error('Não foi possível executar o instalador:', e)
    }
  }

  const processTemplateDownload = async () => {
    if (!downloadModalFile) return
    setIsDownloading(true)
    try {
      // 1. Get signed URL
      const { data, error } = await supabase.storage.from('releases').createSignedUrl(downloadModalFile.bucket_path, 60 * 60)
      if (error || !data) throw error

      // 2. Fetch file content
      const response = await fetch(data.signedUrl)
      const jsonContent = await response.json()

      // 3. Inject Project Data
      const selectedProject = projects.find(p => p.id === selectedProjectId)
      if (selectedProject) {
        if (jsonContent.connections && jsonContent.connections.length > 0) {
          jsonContent.connections[0].projectId = selectedProject.id
          if (selectedProject.secret_token) {
            jsonContent.connections[0].secretToken = selectedProject.secret_token
          }
        }
      }

      // 4. Inject DB Data
      if (dbName && dbUser) { // only inject if user typed something
        let connectionString = ''
        if (dbType === 'postgres') {
          const passPart = dbPass ? `:${dbPass}` : ''
          connectionString = `postgresql://${dbUser}${passPart}@${dbHost}:${dbPort}/${dbName}`
        } else if (dbType === 'mysql') {
          const passPart = dbPass ? `:${dbPass}` : ''
          connectionString = `mysql://${dbUser}${passPart}@${dbHost}:${dbPort}/${dbName}`
        } else if (dbType === 'sqlserver') {
          const passPart = dbPass ? `Password=${dbPass};` : ''
          connectionString = `Server=${dbHost},${dbPort};Database=${dbName};User Id=${dbUser};${passPart}Encrypt=True;TrustServerCertificate=True;`
        }

        if (jsonContent.connections && jsonContent.connections.length > 0) {
          if (jsonContent.connections[0].connectionsString && jsonContent.connections[0].connectionsString.length > 0) {
            jsonContent.connections[0].connectionsString[0].name = 'erp'
            jsonContent.connections[0].connectionsString[0].type = dbType
            jsonContent.connections[0].connectionsString[0].connectionString = connectionString
          }
        }
      }

      // 5. Trigger Download
      const blob = new Blob([JSON.stringify(jsonContent, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'metabuilder.config.json'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast('Template baixado com sucesso!', 'success')
      setDownloadModalFile(null)
    } catch (err: any) {
      console.error(err)
      toast('Erro ao processar template: ' + err.message, 'error')
    }
    setIsDownloading(false)
  }

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'cli-win': return 'CLI (Windows)'
      case 'cli-linux': return 'CLI (Linux)'
      case 'template': return 'Template JSON'
      case 'manual': return 'Manual PDF'
      case 'ide-win': return 'App (Windows)'
      case 'ide-mac': return 'App (macOS)'
      case 'ide-linux': return 'App (Linux)'
      default: return cat
    }
  }

  const filteredFiles = files.filter(f => {
    const isIde = ['ide-win', 'ide-mac', 'ide-linux'].includes(f.category);
    if (mainTab === 'ide' && !isIde) return false;
    if (mainTab === 'utils' && isIde) return false;

    if (filter === 'all') return true;
    return f.category === filter;
  });

  const finalFilteredFiles = (() => {
    if (mainTab === 'ide' && !showOlderReleases) {
      const seen = new Set();
      return filteredFiles.filter(f => {
        if (seen.has(f.category)) return false;
        seen.add(f.category);
        return true;
      });
    }
    return filteredFiles;
  })();

  // Sync default port when dbType changes
  useEffect(() => {
    if (dbType === 'postgres') setDbPort('5432')
    else if (dbType === 'mysql') setDbPort('3306')
    else if (dbType === 'sqlserver') setDbPort('1433')
  }, [dbType])

  return (
    <div className={`flex flex-col h-full bg-neutral-50 dark:bg-black p-8 pt-10 ${isPopout ? 'mt-8' : ''}`}>
      <div className="max-w-5xl mx-auto w-full space-y-6">
        <div className="bg-gradient-to-br from-indigo-900 to-blue-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-lg border border-indigo-500/20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-white/10 border border-white/20 backdrop-blur-md uppercase tracking-widest">
                <Download className="w-3.5 h-3.5 text-cyan-400" /> Central de Downloads
              </span>
              <div className="flex items-center gap-2">
                {!isPopout && (
                  <button
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        window.open('/client/downloads/popout', '_blank', 'width=1200,height=800,menubar=no,toolbar=no,location=no,status=no')
                      }
                    }}
                    className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-md border border-white/20 transition-all flex items-center gap-2 group"
                    title="Abrir em Nova Janela (Modo Foco)"
                  >
                    <span className="hidden md:inline text-xs font-bold uppercase tracking-widest group-hover:text-white">Modo Foco</span>
                    <ExternalLink className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => fetchFiles()}
                  disabled={isLoading}
                  title="Atualizar lista"
                  className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-md border border-white/20 transition-all flex items-center justify-center disabled:opacity-50 group active:scale-95 duration-200"
                >
                  <RefreshCw className={`w-4 h-4 transition-transform duration-500 ease-out ${isLoading ? 'animate-spin' : 'group-hover:rotate-180'}`} />
                </button>
              </div>
            </div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-2">Central de Downloads</h2>
            <p className="text-indigo-100 text-sm md:text-base leading-relaxed max-w-2xl">
              Baixe aqui o CLI (Windows/Linux), Manuais em PDF e Templates JSON.
            </p>
          </div>
        </div>

        {releaseNotesList.length > 0 && localVersion && (
          (() => {
            const installed = localVersion.replace('IDE Engine v', '').trim()
            const latest = releaseNotesList[0].version.replace('v', '')
            const isOutdated = localVersion.startsWith('IDE Engine') && installed !== latest && installed !== 'Erro:' && !localVersion.includes('Erro')
            
            if (isOutdated) {
              return (
                <div className="relative flex items-center justify-center mb-10 z-10">
                  <button 
                    onClick={async () => {
                      try {
                        setIsUpdating(true)
                        const { check } = await import('@tauri-apps/plugin-updater')
                        const update = await check()
                        if (update?.available) {
                          await update.downloadAndInstall((event: any) => {
                            // Progresso opcional — mantém o spinner visível
                            if (event.event === 'Finished') {
                              // Tauri reinicia automaticamente após instalar
                            }
                          })
                        } else {
                          // Nenhuma atualização encontrada pelo updater nativo — tenta abrir a Central de Downloads
                          toast('Não foi possível atualizar automaticamente. Baixe a nova versão pela Central de Downloads.', 'error')
                          setIsUpdating(false)
                        }
                      } catch (e: any) {
                        console.error('Update failed', e)
                        toast(`Erro na atualização: ${e?.message || String(e)}`, 'error')
                        setIsUpdating(false)
                      }
                    }}
                    disabled={isUpdating}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-full shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2"
                  >
                    {isUpdating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Atualizando...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Atualizar para a versão {latest}
                      </>
                    )}
                  </button>
                </div>
              )
            }
            return null
          })()
        )}

      {/* Tabs â€” hide Utilitários for dev-only users */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800 mb-4">
        <button
          onClick={() => { setMainTab('ide'); setFilter('all'); }}
          className={`px-6 py-3 font-bold text-sm border-b-2 transition-colors ${mainTab === 'ide' ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300'}`}
        >
          App Desktop (IDE)
        </button>
        {!devOnly && (
          <button
            onClick={() => { setMainTab('utils'); setFilter('all'); }}
            className={`px-6 py-3 font-bold text-sm border-b-2 transition-colors ${mainTab === 'utils' ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300'}`}
          >
            Utilitários (CLI & JSON)
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-neutral-500 dark:text-neutral-400">
            <Filter className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Filtros:</span>
          </div>
          {(mainTab === 'ide' ? [
            { id: 'all', label: 'Todos' },
            { id: 'ide-win', label: 'Windows' },
            { id: 'ide-mac', label: 'macOS' },
            { id: 'ide-linux', label: 'Linux' }
          ] : [
            { id: 'all', label: 'Todos' },
            { id: 'cli-win', label: 'CLI Windows' },
            { id: 'cli-linux', label: 'CLI Linux' },
            { id: 'template', label: 'Templates' },
            { id: 'manual', label: 'Manuais' }
          ]).map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as any)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${filter === f.id
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                : 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {mainTab === 'ide' && (
          <button
            onClick={() => setShowOlderReleases(!showOlderReleases)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors border ${showOlderReleases
              ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-500/10 dark:border-indigo-500/20 dark:text-indigo-400'
              : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800'
              }`}
          >
            <History className="w-4 h-4" />
            {showOlderReleases ? 'Ocultar versões antigas' : 'Exibir versões anteriores'}
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Nome do Arquivo</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Categoria</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Tamanho</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400 text-right">Download</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="p-12 text-center">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
                </td>
              </tr>
            ) : finalFilteredFiles.length > 0 ? (
              finalFilteredFiles.map(file => (
                <tr key={file.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                  <td className="px-6 py-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
                      <FileIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-neutral-900 dark:text-white block">{file.name}</span>
                      <span className="text-xs font-medium text-neutral-500">v{file.version}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300">
                      {getCategoryLabel(file.category)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-neutral-600 dark:text-neutral-400">
                    {(file.size_bytes / 1024 / 1024).toFixed(2)} MB
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDownloadClick(file)}
                      className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg font-bold text-xs uppercase tracking-widest transition-colors flex items-center gap-2 ml-auto"
                    >
                      <Download className="w-4 h-4" />
                      <span>Baixar</span>
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="p-12 text-center">
                  <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Download className="w-8 h-8 text-neutral-400" />
                  </div>
                  <p className="text-sm font-bold text-neutral-500">Nenhum arquivo disponível no momento.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* IDE Download Progress Modal */}
      {ideDownloadModal?.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-neutral-200 dark:border-neutral-800">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white text-center">
              <div className="mx-auto bg-white/20 w-14 h-14 rounded-full flex items-center justify-center mb-3">
                {ideDownloadModal.phase === 'done' ? (
                  <CheckCircle className="w-7 h-7 text-white" />
                ) : ideDownloadModal.phase === 'error' ? (
                  <X className="w-7 h-7 text-white" />
                ) : (
                  <Download className="w-7 h-7 text-white" />
                )}
              </div>
              <h3 className="text-lg font-black">
                {ideDownloadModal.phase === 'downloading' && 'Baixando...'}
                {ideDownloadModal.phase === 'done' && 'Download Concluído!'}
                {ideDownloadModal.phase === 'error' && 'Erro no Download'}
              </h3>
              <p className="text-indigo-100 text-sm mt-1 truncate max-w-xs mx-auto">{ideDownloadModal.fileName}</p>
            </div>

            <div className="p-6 space-y-5">
              {/* Progress bar */}
              {ideDownloadModal.phase === 'downloading' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-neutral-500">
                    <span>Progresso</span>
                    <span>{ideDownloadModal.progress}%</span>
                  </div>
                  <div className="h-2.5 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${ideDownloadModal.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-center text-neutral-400">Salvando na pasta Downloads do sistema...</p>
                </div>
              )}

              {/* Done state */}
              {ideDownloadModal.phase === 'done' && (
                <div className="space-y-3">
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-3 text-xs text-emerald-700 dark:text-emerald-400 text-center font-medium">
                    Arquivo salvo em: <span className="font-bold">Downloads</span>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2.5">
                    <button
                      onClick={() => handleOpenFolder(ideDownloadModal.savedDir, ideDownloadModal.savedPath)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                    >
                      <FolderOpen className="w-4 h-4" />
                      Abrir Pasta
                    </button>

                    {ideDownloadModal.canRun ? (
                      <button
                        onClick={() => handleRunInstaller(ideDownloadModal.savedPath)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-colors shadow-sm"
                      >
                        <Play className="w-4 h-4" />
                        Instalar Agora
                      </button>
                    ) : (
                      <div className="flex-1 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-700 dark:text-amber-400 text-center font-medium flex items-center justify-center">
                        Feche a IDE antes de instalar
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setIdeDownloadModal(null)}
                    className="w-full text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 font-bold uppercase tracking-widest py-1 transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              )}

              {/* Error state */}
              {ideDownloadModal.phase === 'error' && (
                <div className="space-y-3">
                  <p className="text-sm text-center text-red-500 font-medium">Não foi possível completar o download. Tente novamente.</p>
                  <button
                    onClick={() => setIdeDownloadModal(null)}
                    className="w-full px-4 py-2.5 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Template Download Modal */}
      {downloadModalFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-neutral-200 dark:border-neutral-800 p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-neutral-900 dark:text-white">Configurar Template</h3>
              <button onClick={() => setDownloadModalFile(null)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors text-neutral-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-widest text-neutral-500">Vincular a um Projeto (Opcional)</label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-xl px-4 py-3 text-sm font-medium text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">Baixar sem vincular</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <p className="text-[11px] text-neutral-400">Ao selecionar, o arquivo já virá com o Project ID e Secret Token preenchidos.</p>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-widest text-neutral-500">Conexão do Banco de Dados (Opcional)</label>
                <p className="text-[11px] text-neutral-400 mb-2">Preencha se quiser que a string de conexão já venha montada no JSON.</p>

                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={dbType}
                    onChange={(e) => setDbType(e.target.value)}
                    className="w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-xl px-4 py-3 text-sm font-medium text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="postgres">PostgreSQL</option>
                    <option value="mysql">MySQL</option>
                    <option value="sqlserver">SQL Server</option>
                  </select>

                  <input
                    type="text" placeholder="Host (ex: localhost)"
                    value={dbHost} onChange={(e) => setDbHost(e.target.value)}
                    className="w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-xl px-4 py-3 text-sm font-medium text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <input
                    type="text" placeholder="Porta (ex: 5432)"
                    value={dbPort} onChange={(e) => setDbPort(e.target.value)}
                    className="w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-xl px-4 py-3 text-sm font-medium text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <input
                    type="text" placeholder="Database"
                    className="col-span-2 w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-xl px-4 py-3 text-sm font-medium text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={dbName} onChange={(e) => setDbName(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text" placeholder="Usuário"
                    value={dbUser} onChange={(e) => setDbUser(e.target.value)}
                    className="w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-xl px-4 py-3 text-sm font-medium text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <input
                    type="password" placeholder="Senha"
                    value={dbPass} onChange={(e) => setDbPass(e.target.value)}
                    className="w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-xl px-4 py-3 text-sm font-medium text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <button
                onClick={processTemplateDownload}
                disabled={isDownloading}
                className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
              >
                {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                {isDownloading ? 'Processando...' : 'Baixar Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  )
}
